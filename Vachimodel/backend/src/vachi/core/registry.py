"""Finds provider plugins and builds them from config.

Provider classes are discovered through the `vachi.providers` Python entry point
group. The built-in providers register themselves there in pyproject.toml, and a
separate pip package can add new ones the same way, without changing Vachi's code.
"""

from __future__ import annotations

from importlib.metadata import entry_points

from pydantic import ValidationError

from vachi.core.config import ProviderEntry, VachiConfig, substitute_env
from vachi.core.errors import ConfigError
from vachi.core.interfaces import ModelProvider

ENTRY_POINT_GROUP = "vachi.providers"


class ProviderRegistry:
    def __init__(self, config: VachiConfig, provider_types: dict[str, type[ModelProvider]] | None = None):
        self.config = config
        self._entries = {p.id: p for p in config.providers}
        self._types = provider_types if provider_types is not None else discover_provider_types()
        self._instances: dict[str, ModelProvider] = {}

    @property
    def provider_ids(self) -> list[str]:
        return list(self._entries)

    def get(self, provider_id: str) -> ModelProvider:
        """Return the provider, constructing it on first use."""
        if provider_id in self._instances:
            return self._instances[provider_id]

        entry = self._entries.get(provider_id)
        if entry is None:
            known = ", ".join(self._entries) or "none"
            raise ConfigError(f"Unknown provider '{provider_id}'. Configured providers: {known}.")

        provider = self._build(entry)
        self._instances[provider_id] = provider
        return provider

    def parse(self, model_ref: str | None) -> tuple[str, str]:
        """Check that "provider_id/model_name" is well formed and names a configured
        provider, without building the provider (so a missing API key isn't an error yet)."""
        model_ref = model_ref or self.config.models.default
        if not model_ref:
            raise ConfigError("No model given. Pass --model provider/model or set models.default in vachi.yaml.")
        provider_id, sep, model_name = model_ref.partition("/")
        if not sep or not model_name:
            raise ConfigError(
                f"Model '{model_ref}' must look like provider/model, for example "
                f"local/llama3.2. Configured providers: {', '.join(self._entries) or 'none'}."
            )
        if provider_id not in self._entries:
            known = ", ".join(self._entries) or "none"
            raise ConfigError(f"Unknown provider '{provider_id}'. Configured providers: {known}.")
        return provider_id, model_name

    def provider_type(self, provider_id: str) -> str | None:
        entry = self._entries.get(provider_id)
        return entry.type if entry else None

    def resolve(self, model_ref: str | None) -> tuple[ModelProvider, str]:
        """Turn "provider_id/model_name" into (provider, model_name).

        Falls back to `models.default` from config when model_ref is empty. Only the
        first "/" separates the provider, so model names may contain "/" themselves.
        """
        provider_id, model_name = self.parse(model_ref)
        return self.get(provider_id), model_name

    async def aclose(self) -> None:
        for provider in self._instances.values():
            await provider.aclose()
        self._instances.clear()

    def _build(self, entry: ProviderEntry) -> ModelProvider:
        cls = self._types.get(entry.type)
        if cls is None:
            known = ", ".join(sorted(self._types)) or "none"
            raise ConfigError(f"Provider '{entry.id}' has unknown type '{entry.type}'. Available types: {known}.")

        settings = substitute_env(entry.settings(), context=f"Provider '{entry.id}'")
        try:
            provider_config = cls.Config.model_validate(settings)
        except ValidationError as exc:
            raise ConfigError(f"Provider '{entry.id}' ({entry.type}) has invalid settings:\n{exc}") from exc
        return cls(entry.id, provider_config)


def discover_provider_types() -> dict[str, type[ModelProvider]]:
    types: dict[str, type[ModelProvider]] = {}
    for ep in entry_points(group=ENTRY_POINT_GROUP):
        cls = ep.load()
        if not (isinstance(cls, type) and issubclass(cls, ModelProvider)):
            raise ConfigError(f"Entry point '{ep.name}' in {ENTRY_POINT_GROUP} is not a ModelProvider subclass.")
        types[ep.name] = cls
    return types
