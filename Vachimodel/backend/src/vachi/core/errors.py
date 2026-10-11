"""Errors with messages written for humans.

Provider adapters translate SDK/HTTP errors into these, so the CLI (and later the API)
can show a clear message instead of a stack trace.
"""


class VachiError(Exception):
    """Base class for all Vachi errors."""


class ConfigError(VachiError):
    """The config file or environment is wrong or incomplete."""


class ProviderError(VachiError):
    """A model provider failed."""

    def __init__(self, provider: str, message: str):
        self.provider = provider
        super().__init__(f"[{provider}] {message}")


class ProviderAuthError(ProviderError):
    """API key missing, wrong or revoked."""


class ProviderUnavailableError(ProviderError):
    """Provider can't be reached (server down, network error, timeout)."""


class ModelNotFoundError(ProviderError):
    """The provider doesn't have the requested model."""


class RateLimitError(ProviderError):
    """The provider is rate limiting us or the account is out of quota."""
