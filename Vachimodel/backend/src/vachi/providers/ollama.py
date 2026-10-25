"""Ollama provider: runs open-weight models on your own machine (https://ollama.com)."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import httpx
from pydantic import BaseModel

from vachi.core.errors import (
    ModelNotFoundError,
    ProviderAuthError,
    ProviderError,
    ProviderUnavailableError,
    RateLimitError,
)
from vachi.core.interfaces import ModelProvider
from vachi.core.messages import ChatChunk, ChatRequest, ModelInfo, Usage


class OllamaConfig(BaseModel):
    base_url: str = "http://localhost:11434"
    timeout_seconds: float = 300.0  # local models can be slow to load the first time


class OllamaProvider(ModelProvider):
    type_name = "ollama"
    Config = OllamaConfig

    def __init__(self, provider_id: str, config: OllamaConfig, transport: httpx.AsyncBaseTransport | None = None):
        super().__init__(provider_id, config)
        self.config: OllamaConfig = config
        self._show_limit = asyncio.Semaphore(4)
        self._client = httpx.AsyncClient(
            base_url=config.base_url.rstrip("/"),
            timeout=httpx.Timeout(config.timeout_seconds, connect=5.0),
            transport=transport,
        )

    async def list_models(self) -> list[ModelInfo]:
        try:
            response = await self._client.get("/api/tags")
        except httpx.TransportError as exc:
            raise self._unavailable(exc) from exc
        self._raise_for_status(response, model=None)
        names = [m["name"] for m in response.json().get("models", [])]
        details = await asyncio.gather(*(self._show(name) for name in names))
        return [
            ModelInfo(id=name, provider=self.id, display_name=name, context_window=ctx, capabilities=caps)
            for name, (ctx, caps) in zip(names, details, strict=True)
        ]

    async def _show(self, name: str) -> tuple[int | None, list[str]]:
        """Context length and capabilities of one model. Best effort: unknown on any failure."""
        async with self._show_limit:
            try:
                response = await self._client.post("/api/show", json={"model": name}, timeout=10)
                data = response.json() if response.status_code == 200 else {}
            except (httpx.HTTPError, ValueError):
                return None, []
        context = next((v for k, v in (data.get("model_info") or {}).items() if k.endswith(".context_length")), None)
        # Ollama reports e.g. ["completion", "vision", "tools", "thinking"]; "completion" is implied.
        capabilities = [c for c in data.get("capabilities") or [] if c != "completion"]
        return (context if isinstance(context, int) else None), capabilities

    async def chat(self, request: ChatRequest) -> AsyncIterator[ChatChunk]:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        if request.system:
            messages.insert(0, {"role": "system", "content": request.system})

        options: dict = {}
        if request.temperature is not None:
            options["temperature"] = request.temperature
        if request.max_tokens is not None:
            options["num_predict"] = request.max_tokens

        body = {"model": request.model, "messages": messages, "stream": True}
        if options:
            body["options"] = options

        try:
            async with self._client.stream("POST", "/api/chat", json=body) as response:
                if response.status_code >= 400:
                    await response.aread()
                    self._raise_for_status(response, model=request.model)

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    if "error" in data:
                        raise ProviderError(self.id, data["error"])
                    text = data.get("message", {}).get("content", "")
                    if text:
                        yield ChatChunk(type="text", text=text)
                    if data.get("done"):
                        yield ChatChunk(
                            type="done",
                            stop_reason=data.get("done_reason"),
                            usage=Usage(
                                input_tokens=data.get("prompt_eval_count", 0),
                                output_tokens=data.get("eval_count", 0),
                            ),
                        )
                        return
        except httpx.TransportError as exc:
            raise self._unavailable(exc) from exc

        raise ProviderUnavailableError(self.id, "Ollama closed the connection before the answer finished.")

    async def aclose(self) -> None:
        await self._client.aclose()

    def _unavailable(self, exc: Exception) -> ProviderUnavailableError:
        return ProviderUnavailableError(
            self.id,
            f"Can't reach Ollama at {self.config.base_url} ({type(exc).__name__}). "
            "Is it running? Start it with `ollama serve` or open the Ollama app.",
        )

    def _raise_for_status(self, response: httpx.Response, model: str | None) -> None:
        if response.status_code < 400:
            return
        try:
            detail = response.json().get("error", response.text)
        except ValueError:
            detail = response.text
        if response.status_code in (401, 403):  # e.g. Ollama behind a proxy that checks keys
            raise ProviderAuthError(self.id, f"Access denied (HTTP {response.status_code}): {detail}")
        if response.status_code == 429:
            raise RateLimitError(self.id, f"Too many requests: {detail}")
        if response.status_code == 404 and model:
            raise ModelNotFoundError(
                self.id, f"Model '{model}' isn't downloaded. Run `ollama pull {model}` first. ({detail})"
            )
        raise ProviderError(self.id, f"HTTP {response.status_code}: {detail}", retryable=response.status_code >= 500)
