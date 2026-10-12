"""OpenAI-compatible API, so existing tools and SDKs can use Vachi as a backend.

Point any OpenAI client at `http://<vachi>/v1` and use model names like
"local/llama3.2" or "anthropic/claude-opus-5-5". Stateless: nothing is saved.

If VACHI_API_KEY is set, clients must send `Authorization: Bearer <VACHI_API_KEY>`.
"""

from __future__ import annotations

import hmac
import json
import os
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict

from vachi.core.errors import ConfigError, VachiError
from vachi.core.messages import ChatChunk, ChatRequest, Message
from vachi.core.registry import ProviderRegistry

FINISH_REASONS = {
    "end_turn": "stop",
    "stop": "stop",
    "stop_sequence": "stop",
    "max_tokens": "length",
    "length": "length",
    "refusal": "content_filter",
    "content_filter": "content_filter",
}
ERROR_TYPES = {
    400: "invalid_request_error",
    401: "authentication_error",
    404: "not_found_error",
    429: "rate_limit_error",
}


class ApiKeyError(VachiError):
    """Missing or wrong Vachi API key (HTTP 401)."""


def error_body(message: str, status: int) -> dict:
    return {"error": {"message": message, "type": ERROR_TYPES.get(status, "api_error"), "code": status}}


async def require_api_key(authorization: str | None = Header(None)) -> None:
    expected = os.environ.get("VACHI_API_KEY")
    if not expected:
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token.encode(), expected.encode()):
        raise ApiKeyError("Invalid or missing API key. Send 'Authorization: Bearer <VACHI_API_KEY>'.")


router = APIRouter(prefix="/v1", tags=["openai-compatible"], dependencies=[Depends(require_api_key)])


class TextPart(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str
    text: str | None = None


class InputMessage(BaseModel):
    model_config = ConfigDict(extra="allow")
    role: Literal["system", "developer", "user", "assistant", "tool"]
    content: str | list[TextPart] | None = None

    def text(self) -> str:
        if self.content is None:
            return ""
        if isinstance(self.content, str):
            return self.content
        unsupported = {p.type for p in self.content if p.type != "text"}
        if unsupported:
            raise ConfigError(f"Content type(s) {', '.join(sorted(unsupported))} aren't supported yet; send text.")
        return "".join(p.text or "" for p in self.content)


class StreamOptions(BaseModel):
    include_usage: bool = False


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")  # ignore OpenAI parameters Vachi doesn't use yet
    model: str
    messages: list[InputMessage]
    stream: bool = False
    stream_options: StreamOptions | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    max_completion_tokens: int | None = None

    def to_chat_request(self, model_name: str) -> ChatRequest:
        system_parts, messages = [], []
        for m in self.messages:
            if m.role in ("system", "developer"):
                system_parts.append(m.text())
            elif m.role == "tool":
                raise ConfigError("Tool messages aren't supported yet (coming in Phase 5).")
            else:
                messages.append(Message(role=m.role, content=m.text()))
        if not messages:
            raise ConfigError("At least one user message is required.")
        return ChatRequest(
            model=model_name,
            messages=messages,
            system="\n\n".join(system_parts) or None,
            temperature=self.temperature,
            max_tokens=self.max_completion_tokens or self.max_tokens,
        )


@router.get("/models")
async def list_models(request: Request) -> dict:
    registry: ProviderRegistry = request.app.state.registry
    data = []
    for provider_id in registry.provider_ids:
        try:
            for m in await registry.get(provider_id).list_models():
                data.append({"id": m.full_id, "object": "model", "created": 0, "owned_by": provider_id})
        except VachiError:
            continue  # an unavailable provider just has no models listed
    return {"object": "list", "data": data}


@router.post("/chat/completions", response_model=None)
async def chat_completions(request: Request, body: ChatCompletionRequest) -> JSONResponse | StreamingResponse:
    """Answers come through the router, so fallbacks, retries, budgets and usage tracking apply.
    The response's `model` is the model that actually answered."""
    chunks = request.app.state.router.stream(body.model, body.to_chat_request(""), source="api")

    # Wait for the router to commit to a model before answering, so failures (server down,
    # bad key, unknown model, budget) become a normal HTTP error instead of a broken stream.
    route = await anext(chunks)
    answered_by = route.model or body.model
    first = await anext(chunks, None)
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"
    created = int(time.time())

    if body.stream:
        include_usage = bool(body.stream_options and body.stream_options.include_usage)
        return StreamingResponse(
            stream_completion(first, chunks, completion_id, created, answered_by, include_usage),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    parts, usage, stop_reason = [], None, None
    chunk = first
    while chunk is not None:
        if chunk.type == "text":
            parts.append(chunk.text)
        elif chunk.type == "done":
            usage, stop_reason = chunk.usage, chunk.stop_reason
        chunk = await anext(chunks, None)

    return JSONResponse(
        {
            "id": completion_id,
            "object": "chat.completion",
            "created": created,
            "model": answered_by,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "".join(parts)},
                    "finish_reason": FINISH_REASONS.get(stop_reason or "stop", "stop"),
                }
            ],
            "usage": usage_dict(usage),
        }
    )


async def stream_completion(
    first: ChatChunk | None,
    chunks: AsyncIterator[ChatChunk],
    completion_id: str,
    created: int,
    model: str,
    include_usage: bool,
) -> AsyncIterator[str]:
    def event(choices: list, usage: dict | None = None) -> str:
        payload: dict[str, Any] = {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": choices,
        }
        if include_usage:
            payload["usage"] = usage
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    yield event([{"index": 0, "delta": {"role": "assistant", "content": ""}, "finish_reason": None}])
    usage, stop_reason = None, None
    chunk = first
    try:
        while chunk is not None:
            if chunk.type == "text":
                yield event([{"index": 0, "delta": {"content": chunk.text}, "finish_reason": None}])
            elif chunk.type == "done":
                usage, stop_reason = chunk.usage, chunk.stop_reason
            chunk = await anext(chunks, None)
    except VachiError as exc:  # headers are already sent; report the error in the stream
        yield f"data: {json.dumps(error_body(str(exc), 502))}\n\n"
        yield "data: [DONE]\n\n"
        return

    finish = FINISH_REASONS.get(stop_reason or "stop", "stop")
    yield event([{"index": 0, "delta": {}, "finish_reason": finish}])
    if include_usage:
        yield event([], usage_dict(usage))
    yield "data: [DONE]\n\n"


def usage_dict(usage) -> dict:
    prompt = usage.input_tokens if usage else 0
    completion = usage.output_tokens if usage else 0
    return {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": prompt + completion}
