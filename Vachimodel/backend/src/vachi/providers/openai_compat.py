"""OpenAI-compatible provider.

Works with OpenAI itself and with any server that speaks the same API: vLLM,
llama.cpp server, LM Studio, OpenRouter, Groq, Together, and many more. Point
`base_url` at the server.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import openai
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


class OpenAICompatConfig(BaseModel):
    api_key: SecretStr = SecretStr("not-needed")  # local servers usually ignore it
    base_url: str | None = None  # None = api.openai.com


class OpenAICompatProvider(ModelProvider):
    type_name = "openai"
    Config = OpenAICompatConfig

    def __init__(self, provider_id: str, config: OpenAICompatConfig, client: openai.AsyncOpenAI | None = None):
        super().__init__(provider_id, config)
        self.config: OpenAICompatConfig = config
        self._client = client or openai.AsyncOpenAI(
            api_key=config.api_key.get_secret_value(),
            base_url=config.base_url,
        )

    async def list_models(self) -> list[ModelInfo]:
        try:
            return [ModelInfo(id=m.id, provider=self.id) async for m in self._client.models.list()]
        except openai.APIError as exc:
            raise self._translate(exc, model=None) from exc

    async def chat(self, request: ChatRequest) -> AsyncIterator[ChatChunk]:
        messages: list[dict[str, Any]] = [{"role": m.role, "content": m.content} for m in request.messages]
        if request.system:
            messages.insert(0, {"role": "system", "content": request.system})

        params: dict[str, Any] = {
            "model": request.model,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if request.temperature is not None:
            params["temperature"] = request.temperature
        if request.max_tokens is not None:
            params["max_completion_tokens"] = request.max_tokens

        usage = None
        stop_reason = None
        try:
            stream = await self._client.chat.completions.create(**params)
            async for chunk in stream:
                if chunk.usage:
                    usage = Usage(
                        input_tokens=chunk.usage.prompt_tokens or 0,
                        output_tokens=chunk.usage.completion_tokens or 0,
                    )
                for choice in chunk.choices:
                    if choice.delta and choice.delta.content:
                        yield ChatChunk(type="text", text=choice.delta.content)
                    if choice.finish_reason:
                        stop_reason = choice.finish_reason
        except openai.APIError as exc:
            raise self._translate(exc, model=request.model) from exc

        if stop_reason == "length":
            yield ChatChunk(type="notice", text="The answer was cut off because it hit the max_tokens limit.")
        yield ChatChunk(type="done", stop_reason=stop_reason, usage=usage)

    async def aclose(self) -> None:
        await self._client.close()

    def _translate(self, exc: openai.APIError, model: str | None) -> ProviderError:
        if isinstance(exc, openai.AuthenticationError):
            return ProviderAuthError(self.id, "The API key was rejected. Check the api_key setting for this provider.")
        if isinstance(exc, openai.NotFoundError):
            return ModelNotFoundError(self.id, f"Model '{model}' not found. Run `vachi models` to see valid names.")
        if isinstance(exc, openai.RateLimitError):
            return RateLimitError(self.id, "Rate limited or out of quota. Wait a bit or check your billing.")
        if isinstance(exc, openai.APIStatusError):
            return ProviderError(self.id, f"HTTP {exc.status_code}: {exc.message}")
        if isinstance(exc, openai.APIConnectionError):
            where = self.config.base_url or "the OpenAI API"
            return ProviderUnavailableError(self.id, f"Can't reach {where}. Is the server running?")
        return ProviderError(self.id, str(exc))
