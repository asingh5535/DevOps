"""Vachi's internal message format.

Every provider adapter converts these to and from its own API format, so the rest of
the app never needs to know which provider it is talking to.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["user", "assistant"]


class Message(BaseModel):
    role: Role
    content: str


class ChatRequest(BaseModel):
    model: str  # model name inside the provider, e.g. "llama3.2" (no "provider/" prefix)
    messages: list[Message]
    system: str | None = None
    temperature: float | None = None  # None = provider default
    max_tokens: int | None = None  # None = provider default


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0


class ChatChunk(BaseModel):
    """One piece of a streamed answer.

    type="text"   -> `text` holds the next piece of the answer
    type="notice" -> `text` holds a message for the user that isn't part of the answer
    type="done"   -> the answer finished; `usage` and `stop_reason` are set when known
    type="route"  -> only from the router, before any text: `model` is the "provider/model"
                     that is answering; `text` explains why, if it's a fallback
    """

    type: Literal["text", "notice", "done", "route"]
    text: str = ""
    usage: Usage | None = None
    stop_reason: str | None = None
    model: str | None = None


class ModelInfo(BaseModel):
    id: str  # model name inside the provider
    provider: str  # provider id from config, e.g. "local"
    display_name: str | None = None
    context_window: int | None = None
    # What the model can do, as far as the provider reports it: "vision", "tools", "thinking", "pdf", ...
    capabilities: list[str] = Field(default_factory=list)
    extra: dict = Field(default_factory=dict)

    @property
    def full_id(self) -> str:
        return f"{self.provider}/{self.id}"
