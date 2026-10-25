"""Routes used by the Vachi web UI."""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from vachi.chat.service import ChatService, TurnOptions
from vachi.core.registry import ProviderRegistry

router = APIRouter(prefix="/api", tags=["chat"])

MODEL_LIST_TIMEOUT_SECONDS = 10
MODEL_CACHE_SECONDS = 60

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}  # tells Nginx not to buffer


def chat_service(request: Request) -> ChatService:
    return request.app.state.chat


class GenerationSettings(BaseModel):
    model: str | None = Field(None, description="provider/model; default: the conversation's model")
    temperature: float | None = Field(None, ge=0, le=2)
    max_tokens: int | None = Field(None, ge=1)

    def options(self) -> TurnOptions:
        return TurnOptions(model=self.model, temperature=self.temperature, max_tokens=self.max_tokens)


class SendMessage(GenerationSettings):
    content: str = Field(..., min_length=1, max_length=100_000)
    edit_message_id: int | None = Field(None, description="replace this user message and everything after it")


class NewConversation(BaseModel):
    model: str | None = None
    title: str | None = None


class UpdateConversation(BaseModel):
    title: str | None = Field(None, max_length=200)
    model: str | None = None


def sse_response(events: AsyncIterator[tuple[str, dict]]) -> StreamingResponse:
    async def body() -> AsyncIterator[str]:
        async for name, data in events:
            yield f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    return StreamingResponse(body(), media_type="text/event-stream", headers=SSE_HEADERS)


# ---------------------------------------------------------------------- models


@router.get("/models")
async def list_models(request: Request, refresh: bool = False) -> dict:
    """Models from every configured provider. Providers that fail are reported, not fatal."""
    cache = request.app.state.model_cache
    if not refresh and cache["data"] and time.monotonic() - cache["at"] < MODEL_CACHE_SECONDS:
        return cache["data"]

    registry: ProviderRegistry = request.app.state.registry

    async def one(provider_id: str) -> dict:
        try:
            provider = registry.get(provider_id)
            models = await asyncio.wait_for(provider.list_models(), MODEL_LIST_TIMEOUT_SECONDS)
            return {"id": provider_id, "type": provider.type_name, "ok": True, "models": models}
        except TimeoutError:
            return {"id": provider_id, "ok": False, "error": "Timed out listing models.", "models": []}
        except Exception as exc:
            return {"id": provider_id, "ok": False, "error": str(exc), "models": []}

    results = await asyncio.gather(*(one(pid) for pid in registry.provider_ids))
    pricing = request.app.state.usage.pricing
    data = {
        "default": request.app.state.config.models.default,
        "fallback": request.app.state.config.models.fallback,
        "models": [
            {
                "id": m.full_id,
                "provider": m.provider,
                "name": m.display_name or m.id,
                "context_window": m.context_window,
                "capabilities": m.capabilities,
                "price": price.model_dump() if (price := pricing.price(m.full_id)) else None,
            }
            for r in results
            for m in sorted(r["models"], key=lambda m: m.id)
        ],
        "providers": [{k: v for k, v in r.items() if k != "models"} for r in results],
    }
    cache.update(at=time.monotonic(), data=data)
    return data


@router.get("/usage")
async def usage(request: Request, days: int = Query(30, ge=1, le=366)) -> dict:
    """Tokens, cost and budget status: today, this month, per model and per day."""
    return await request.app.state.usage.summary(days)


# ---------------------------------------------------------------------- conversations


@router.get("/conversations")
async def list_conversations(request: Request, q: str | None = None) -> list[dict]:
    return await chat_service(request).list_conversations(q)


@router.post("/conversations", status_code=201)
async def create_conversation(request: Request, body: NewConversation) -> dict:
    return await chat_service(request).create_conversation(body.model, body.title)


@router.get("/conversations/{conversation_id}")
async def get_conversation(request: Request, conversation_id: str) -> dict:
    return await chat_service(request).get_conversation(conversation_id)


@router.patch("/conversations/{conversation_id}")
async def update_conversation(request: Request, conversation_id: str, body: UpdateConversation) -> dict:
    return await chat_service(request).update_conversation(conversation_id, title=body.title, model=body.model)


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(request: Request, conversation_id: str) -> Response:
    await chat_service(request).delete_conversation(conversation_id)
    return Response(status_code=204)


@router.get("/conversations/{conversation_id}/export")
async def export_conversation(
    request: Request, conversation_id: str, format: Literal["markdown", "json"] = "markdown"
) -> Response:
    conversation = await chat_service(request).get_conversation(conversation_id)
    filename = f"vachi-{conversation_id[:8]}"
    if format == "json":
        return Response(
            json.dumps(conversation, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
    lines = [f"# {conversation['title']}", ""]
    for m in conversation["messages"]:
        who = "You" if m["role"] == "user" else f"Vachi ({m['model']})"
        lines += [f"**{who}:**", "", m["content"], ""]
    return Response(
        "\n".join(lines),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
    )


# ---------------------------------------------------------------------- answering


@router.post("/conversations/{conversation_id}/messages")
async def send_message(request: Request, conversation_id: str, body: SendMessage) -> StreamingResponse:
    """Add a user message (or edit one) and stream the answer as Server-Sent Events.

    Events: start, model {model, fallback_reason}, delta {text}, notice {text}, done {message},
    title {title}, error {message}.
    """
    events = await chat_service(request).start_turn(
        conversation_id, content=body.content, edit_message_id=body.edit_message_id, options=body.options()
    )
    return sse_response(events)


@router.post("/conversations/{conversation_id}/regenerate")
async def regenerate(request: Request, conversation_id: str, body: GenerationSettings) -> StreamingResponse:
    events = await chat_service(request).start_turn(
        conversation_id, content=None, regenerate=True, options=body.options()
    )
    return sse_response(events)


@router.post("/conversations/{conversation_id}/stop")
async def stop(request: Request, conversation_id: str) -> dict:
    return {"stopped": await chat_service(request).stop(conversation_id)}
