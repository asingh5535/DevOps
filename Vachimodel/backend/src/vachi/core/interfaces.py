"""Plugin interfaces. Every model provider implements ModelProvider.

DataSource and Tool interfaces are added in later phases.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import ClassVar

from pydantic import BaseModel

from vachi.core.messages import ChatChunk, ChatRequest, ModelInfo


class ModelProvider(ABC):
    """A source of language models (a hosted API, a local server, ...).

    Subclasses declare their settings as a pydantic model in `Config`. The registry
    validates the YAML config against it before constructing the provider.
    """

    type_name: ClassVar[str]  # value of `type:` in vachi.yaml, e.g. "ollama"
    Config: ClassVar[type[BaseModel]]

    def __init__(self, provider_id: str, config: BaseModel):
        self.id = provider_id
        self.config = config

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """Models this provider can serve right now."""

    @abstractmethod
    def chat(self, request: ChatRequest) -> AsyncIterator[ChatChunk]:
        """Stream an answer. Yields text/notice chunks and ends with one "done" chunk.

        Implement as an `async def` generator. Raise vachi.core.errors.ProviderError
        subclasses for failures.
        """

    async def health(self) -> bool:
        try:
            await self.list_models()
            return True
        except Exception:
            return False

    async def aclose(self) -> None:  # noqa: B027 - optional hook, default does nothing
        """Release network clients. Override if the provider holds any."""
