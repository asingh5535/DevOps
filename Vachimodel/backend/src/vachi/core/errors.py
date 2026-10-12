"""Errors with messages written for humans.

Provider adapters translate SDK/HTTP errors into these, so the CLI (and later the API)
can show a clear message instead of a stack trace.
"""


class VachiError(Exception):
    """Base class for all Vachi errors."""


class ConfigError(VachiError):
    """The config file or environment is wrong or incomplete."""


class ProviderError(VachiError):
    """A model provider failed.

    `retryable` means trying the same model again a moment later may work
    (server overloaded, network blip). The router retries those before moving on.
    """

    retryable = False

    def __init__(self, provider: str, message: str, *, retryable: bool | None = None):
        self.provider = provider
        if retryable is not None:
            self.retryable = retryable
        super().__init__(f"[{provider}] {message}")


class ProviderAuthError(ProviderError):
    """API key missing, wrong or revoked."""


class ProviderUnavailableError(ProviderError):
    """Provider can't be reached (server down, network error, timeout)."""

    retryable = True


class ModelNotFoundError(ProviderError):
    """The provider doesn't have the requested model."""


class RateLimitError(ProviderError):
    """The provider is rate limiting us or the account is out of quota."""

    retryable = True


class BudgetExceededError(VachiError):
    """A paid model was skipped because the daily or monthly budget is used up."""


class RoutingError(VachiError):
    """Every model in the fallback list failed. `errors` holds (model, error) for each attempt."""

    def __init__(self, errors: list[tuple[str, VachiError]]):
        self.errors = errors
        details = "; ".join(f"{model}: {error}" for model, error in errors)
        super().__init__(f"No model could answer. {details}")

    @property
    def primary(self) -> VachiError:
        return self.errors[0][1]
