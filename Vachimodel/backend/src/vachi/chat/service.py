"""Conversation logic shared by the web API: saving messages, streaming answers,
stop / edit / regenerate, and automatic titles.

Each answer is generated in its own asyncio task that writes events into a queue.
The HTTP response just reads the queue. That keeps generation and saving
independent of the browser connection: Stop (or a closed tab) cancels the task,
and the task still saves the partial answer.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from vachi.core.config import VachiConfig
from vachi.core.errors import VachiError
from vachi.core.messages import ChatRequest, Message
from vachi.core.registry import ProviderRegistry
from vachi.db.models import DEFAULT_TITLE, ChatMessage, Conversation, utcnow

log = logging.getLogger(__name__)

TITLE_PROMPT = (
    "Write a short title (3 to 6 words) for a chat that starts with the message below. "
    "Use the same language as the message. Reply with the title only: no quotes, no full stop."
)
TITLE_TIMEOUT_SECONDS = 20


class NotFoundError(VachiError):
    pass


class ConflictError(VachiError):
    pass


@dataclass
class TurnOptions:
    model: str | None = None  # "provider/model"; None = conversation's model, then config default
    temperature: float | None = None
    max_tokens: int | None = None


Event = tuple[str, dict[str, Any]]


def message_to_dict(m: ChatMessage) -> dict[str, Any]:
    return {
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "model": m.model,
        "stop_reason": m.stop_reason,
        "input_tokens": m.input_tokens,
        "output_tokens": m.output_tokens,
        "created_at": m.created_at.isoformat(),
    }


def conversation_to_dict(c: Conversation, messages: list[ChatMessage] | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": c.id,
        "title": c.title,
        "model": c.model,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }
    if messages is not None:
        data["messages"] = [message_to_dict(m) for m in messages]
    return data


def simple_title(text: str) -> str:
    words = text.split()
    title = " ".join(words[:7])
    if len(title) > 60:
        title = title[:57].rstrip() + "..."
    return title or DEFAULT_TITLE


class ChatService:
    def __init__(self, config: VachiConfig, registry: ProviderRegistry, sessionmaker: async_sessionmaker):
        self.config = config
        self.registry = registry
        self.sessionmaker = sessionmaker
        self._running: dict[str, asyncio.Task] = {}

    # ------------------------------------------------------------------ conversations

    async def list_conversations(self, query: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        async with self.sessionmaker() as db:
            stmt = select(Conversation).order_by(Conversation.updated_at.desc()).limit(limit)
            if query:
                pattern = f"%{query}%"
                matching_messages = select(ChatMessage.conversation_id).where(ChatMessage.content.ilike(pattern))
                stmt = stmt.where(Conversation.title.ilike(pattern) | Conversation.id.in_(matching_messages))
            rows = (await db.scalars(stmt)).all()
            return [conversation_to_dict(c) for c in rows]

    async def create_conversation(self, model: str | None = None, title: str | None = None) -> dict[str, Any]:
        if model:
            self.registry.resolve(model)  # validate early
        async with self.sessionmaker() as db:
            conversation = Conversation(model=model or self.config.models.default, title=title or DEFAULT_TITLE)
            db.add(conversation)
            await db.commit()
            return conversation_to_dict(conversation, [])

    async def get_conversation(self, conversation_id: str) -> dict[str, Any]:
        async with self.sessionmaker() as db:
            conversation = await self._load(db, conversation_id)
            messages = await self._messages(db, conversation_id)
            return conversation_to_dict(conversation, messages)

    async def update_conversation(self, conversation_id: str, *, title: str | None, model: str | None) -> dict:
        if model:
            self.registry.resolve(model)
        async with self.sessionmaker() as db:
            conversation = await self._load(db, conversation_id)
            if title is not None:
                conversation.title = title.strip()[:200] or DEFAULT_TITLE
            if model is not None:
                conversation.model = model
            await db.commit()
            return conversation_to_dict(conversation)

    async def delete_conversation(self, conversation_id: str) -> None:
        await self.stop(conversation_id)
        async with self.sessionmaker() as db:
            conversation = await self._load(db, conversation_id)
            await db.delete(conversation)
            await db.commit()

    # ------------------------------------------------------------------ answering

    def is_running(self, conversation_id: str) -> bool:
        task = self._running.get(conversation_id)
        return task is not None and not task.done()

    async def start_turn(
        self,
        conversation_id: str,
        *,
        content: str | None,
        edit_message_id: int | None = None,
        regenerate: bool = False,
        options: TurnOptions | None = None,
    ) -> AsyncIterator[Event]:
        """Prepare the conversation, start generating, and return the event stream.

        - content only:               add a new user message
        - content + edit_message_id:  replace that user message and drop everything after it
        - regenerate=True:            drop the last answer and answer again
        Errors that can be detected up front (bad model, unknown conversation, ...) are
        raised here, before any streaming starts, so the API can return a proper status.
        """
        options = options or TurnOptions()
        if self.is_running(conversation_id):
            raise ConflictError("This conversation is already answering. Stop it first.")

        async with self.sessionmaker() as db:
            conversation = await self._load(db, conversation_id)
            model_ref = options.model or conversation.model or self.config.models.default
            provider, model_name = self.registry.resolve(model_ref)
            messages = await self._messages(db, conversation_id)

            if regenerate:
                if messages and messages[-1].role == "assistant":
                    await db.delete(messages.pop())
                if not messages:
                    raise ConflictError("There is no question to answer again.")
            elif edit_message_id is not None:
                index = next((i for i, m in enumerate(messages) if m.id == edit_message_id), None)
                if index is None or messages[index].role != "user":
                    raise NotFoundError(f"User message {edit_message_id} not found in this conversation.")
                await db.execute(
                    delete(ChatMessage).where(
                        ChatMessage.conversation_id == conversation_id, ChatMessage.id >= edit_message_id
                    )
                )
                messages = messages[:index]

            user_message = None
            if not regenerate:
                if not content or not content.strip():
                    raise ConflictError("The message is empty.")
                user_message = ChatMessage(conversation_id=conversation_id, role="user", content=content)
                db.add(user_message)
                messages.append(user_message)

            conversation.model = model_ref
            conversation.updated_at = utcnow()
            await db.commit()

            history = [Message(role=m.role, content=m.content) for m in messages]
            needs_title = conversation.title == DEFAULT_TITLE
            first_question = history[0].content

        request = ChatRequest(
            model=model_name,
            messages=history,
            system=self.config.system_prompt,
            temperature=options.temperature,
            max_tokens=options.max_tokens,
        )
        queue: asyncio.Queue[Event | None] = asyncio.Queue()
        queue.put_nowait(
            ("start", {"user_message": message_to_dict(user_message) if user_message else None, "model": model_ref})
        )
        task = asyncio.create_task(
            self._generate(conversation_id, provider, request, model_ref, queue, needs_title, first_question)
        )
        self._running[conversation_id] = task
        task.add_done_callback(lambda t: self._forget(conversation_id, t))
        task.add_done_callback(lambda t: queue.put_nowait(None))  # always end the stream, even if cancelled late
        return self._drain(queue, task)

    async def stop(self, conversation_id: str) -> bool:
        task = self._running.get(conversation_id)
        if task is None or task.done():
            return False
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        return True

    async def shutdown(self) -> None:
        for conversation_id in list(self._running):
            await self.stop(conversation_id)

    # ------------------------------------------------------------------ internals

    async def _drain(self, queue: asyncio.Queue, task: asyncio.Task) -> AsyncIterator[Event]:
        try:
            while True:
                event = await queue.get()
                if event is None:
                    return
                yield event
        finally:
            if not task.done():  # the client went away: stop generating
                task.cancel()

    async def _generate(self, conversation_id, provider, request, model_ref, queue, needs_title, first_question):
        parts: list[str] = []
        usage = None
        stop_reason = None
        try:
            async for chunk in provider.chat(request):
                if chunk.type == "text":
                    parts.append(chunk.text)
                    queue.put_nowait(("delta", {"text": chunk.text}))
                elif chunk.type == "notice":
                    queue.put_nowait(("notice", {"text": chunk.text}))
                elif chunk.type == "done":
                    usage, stop_reason = chunk.usage, chunk.stop_reason
        except asyncio.CancelledError:
            saved = await asyncio.shield(self._save_answer(conversation_id, parts, model_ref, "stopped", None))
            queue.put_nowait(("done", {"message": saved}))
            queue.put_nowait(None)
            raise
        except Exception as exc:  # report to the browser; keep any partial answer
            if not isinstance(exc, VachiError):
                log.exception("Unexpected error while answering")
            if parts:
                await self._save_answer(conversation_id, parts, model_ref, "error", None)
            queue.put_nowait(("error", {"message": str(exc) if isinstance(exc, VachiError) else "Unexpected error."}))
            queue.put_nowait(None)
            return

        saved = await self._save_answer(conversation_id, parts, model_ref, stop_reason, usage)
        queue.put_nowait(("done", {"message": saved}))
        if needs_title:
            title = await self._make_title(conversation_id, provider, request.model, first_question)
            queue.put_nowait(("title", {"title": title}))
        queue.put_nowait(None)

    async def _save_answer(self, conversation_id, parts, model_ref, stop_reason, usage) -> dict[str, Any] | None:
        if not parts and stop_reason == "stopped":
            return None
        async with self.sessionmaker() as db:
            message = ChatMessage(
                conversation_id=conversation_id,
                role="assistant",
                content="".join(parts),
                model=model_ref,
                stop_reason=stop_reason,
                input_tokens=usage.input_tokens if usage else None,
                output_tokens=usage.output_tokens if usage else None,
            )
            db.add(message)
            conversation = await db.get(Conversation, conversation_id)
            if conversation:
                conversation.updated_at = utcnow()
            await db.commit()
            return message_to_dict(message)

    async def _make_title(self, conversation_id, provider, model_name, first_question) -> str:
        title = simple_title(first_question)
        try:
            request = ChatRequest(
                model=model_name,
                system=TITLE_PROMPT,
                messages=[Message(role="user", content=first_question[:2000])],
                max_tokens=1000,
            )

            async def generate() -> str:
                return "".join([c.text async for c in provider.chat(request) if c.type == "text"])

            generated = (await asyncio.wait_for(generate(), TITLE_TIMEOUT_SECONDS)).strip().strip("\"'.").strip()
            if generated:
                title = simple_title(generated.splitlines()[0])
        except Exception as exc:  # a title is nice to have; never fail the chat over it
            log.info("Title generation failed, using the first words of the question: %s", exc)

        async with self.sessionmaker() as db:
            conversation = await db.get(Conversation, conversation_id)
            if conversation and conversation.title == DEFAULT_TITLE:
                conversation.title = title
                await db.commit()
        return title

    def _forget(self, conversation_id: str, task: asyncio.Task) -> None:
        if self._running.get(conversation_id) is task:
            del self._running[conversation_id]

    async def _load(self, db, conversation_id: str) -> Conversation:
        conversation = await db.get(Conversation, conversation_id)
        if conversation is None:
            raise NotFoundError(f"Conversation {conversation_id} not found.")
        return conversation

    async def _messages(self, db, conversation_id: str) -> list[ChatMessage]:
        stmt = select(ChatMessage).where(ChatMessage.conversation_id == conversation_id).order_by(ChatMessage.id)
        return list((await db.scalars(stmt)).all())
