"""Anthropic provider: Claude models through the official `anthropic` SDK."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Literal

import anthropic
from pydantic import BaseModel, SecretStr

from vachi.core.errors import (
    ModelNotFoundError,
    ProviderAuthError,
    ProviderError,
    ProviderUnavailableError,
    RateLimitError,
)
from vachi.core.interfaces import ModelProvider
from vachi.core.messages import ChatChunk, ChatRequest, ModelInfo, Usage

SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicConfig(BaseModel):
    api_key: SecretStr
    base_url: str | None = None
    default_max_tokens: int = 64000
    # How hard Claude thinks before answering. None = the model's own default.
    effort: Literal["low", "medium", "high", "xhigh", "max"] | None = None
    # If a model's safety classifier declines a request, let Anthropic retry it on a
    # suitable substitute model server-side instead of returning a refusal.
    server_fallbacks: bool = True


class AnthropicProvider(ModelProvider):
    type_name = "anthropic"
    Config = AnthropicConfig

    def __init__(self, provider_id: str, config: AnthropicConfig, client: anthropic.AsyncAnthropic | None = None):
        super().__init__(provider_id, config)
        self.config: AnthropicConfig = config
        self._client = client or anthropic.AsyncAnthropic(
            api_key=config.api_key.get_secret_value(),
            base_url=config.base_url,
        )

    async def list_models(self) -> list[ModelInfo]:
        try:
            return [
                ModelInfo(
                    id=m.id,
                    provider=self.id,
                    display_name=m.display_name,
                    context_window=getattr(m, "max_input_tokens", None),
                )
                async for m in self._client.models.list()
            ]
        except anthropic.APIError as exc:
            raise self._translate(exc, model=None) from exc

    async def chat(self, request: ChatRequest) -> AsyncIterator[ChatChunk]:
        # Current Claude models reject temperature/top_p, so request.temperature is
        # deliberately not sent. Depth is controlled with `effort` instead.
        params: dict[str, Any] = {
            "model": request.model,
            "max_tokens": request.max_tokens or self.config.default_max_tokens,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        }
        if request.system:
            params["system"] = request.system
        if self.config.effort:
            params["output_config"] = {"effort": self.config.effort}
        if self.config.server_fallbacks:
            params["betas"] = [SERVER_FALLBACK_BETA]
            params["fallbacks"] = "default"

        try:
            async with self._client.beta.messages.stream(**params) as stream:
                async for text in stream.text_stream:
                    yield ChatChunk(type="text", text=text)
                final = await stream.get_final_message()
        except anthropic.APIError as exc:
            raise self._translate(exc, model=request.model) from exc

        if final.stop_reason == "refusal":
            yield ChatChunk(type="notice", text="Claude declined to answer this request.")
        elif final.stop_reason == "max_tokens":
            yield ChatChunk(type="notice", text="The answer was cut off because it hit the max_tokens limit.")
        if final.model != request.model:
            yield ChatChunk(type="notice", text=f"Answered by fallback model {final.model}.")

        yield ChatChunk(
            type="done",
            stop_reason=final.stop_reason,
            usage=Usage(input_tokens=final.usage.input_tokens, output_tokens=final.usage.output_tokens),
        )

    async def aclose(self) -> None:
        await self._client.close()

    def _translate(self, exc: anthropic.APIError, model: str | None) -> ProviderError:
        if isinstance(exc, anthropic.AuthenticationError):
            return ProviderAuthError(self.id, "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.")
        if isinstance(exc, anthropic.PermissionDeniedError):
            return ProviderAuthError(self.id, f"This API key isn't allowed to do that: {exc.message}")
        if isinstance(exc, anthropic.NotFoundError):
            return ModelNotFoundError(self.id, f"Model '{model}' not found. Run `vachi models` to see valid names.")
        if isinstance(exc, anthropic.RateLimitError):
            return RateLimitError(self.id, "Rate limited by Anthropic. Wait a bit and try again.")
        if isinstance(exc, anthropic.APIStatusError):
            return ProviderError(self.id, f"HTTP {exc.status_code}: {exc.message}")
        if isinstance(exc, anthropic.APIConnectionError):
            return ProviderUnavailableError(self.id, "Can't reach the Anthropic API. Check your internet connection.")
        return ProviderError(self.id, str(exc))
