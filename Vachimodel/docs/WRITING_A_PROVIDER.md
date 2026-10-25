# Writing a model provider

A provider connects Vachi to a source of models. Vachi ships with `ollama`, `anthropic` and
`openai` (alias `openai_compatible`, for any server that speaks OpenAI's API: vLLM,
llama.cpp, LM Studio, OpenRouter, Groq, ...). If your server speaks OpenAI's API, you don't
need a new provider. Just add it in `vachi.yaml` with `type: openai` and a `base_url`.

## 1. The class

Create `backend/src/vachi/providers/echo.py`. This complete example "answers" by repeating
the question, which is handy for trying out the plumbing:

```python
from collections.abc import AsyncIterator

from pydantic import BaseModel

from vachi.core.errors import ModelNotFoundError
from vachi.core.interfaces import ModelProvider
from vachi.core.messages import ChatChunk, ChatRequest, ModelInfo, Usage


class EchoConfig(BaseModel):
    prefix: str = "You said: "  # settings come from this provider's entry in vachi.yaml


class EchoProvider(ModelProvider):
    type_name = "echo"
    Config = EchoConfig

    async def list_models(self) -> list[ModelInfo]:
        return [ModelInfo(id="parrot", provider=self.id, context_window=4096, capabilities=[])]

    async def chat(self, request: ChatRequest) -> AsyncIterator[ChatChunk]:
        if request.model != "parrot":
            raise ModelNotFoundError(self.id, f"Model '{request.model}' not found.")
        answer = self.config.prefix + request.messages[-1].content
        for word in answer.split(" "):
            yield ChatChunk(type="text", text=word + " ")
        yield ChatChunk(type="done", stop_reason="end_turn", usage=Usage(input_tokens=1, output_tokens=len(answer.split())))
```

## 2. Register it

In `backend/pyproject.toml`:

```toml
[project.entry-points."vachi.providers"]
echo = "vachi.providers.echo:EchoProvider"
```

Then `cd backend && uv sync`. A provider can also live in its own pip package with this same
entry point; Vachi finds it without any change to Vachi's code.

## 3. Use it

```yaml
providers:
  - id: parrots          # your name; models are called parrots/<model>
    type: echo
    prefix: "Echo: "
```

```bash
uv run vachi --config ../vachi.yaml ask "hello" --model parrots/parrot
```

## The rules every provider must follow

These are checked by `backend/tests/test_provider_contract.py`. Add your provider to the
`PROVIDERS` list there and make all checks pass.

| Rule | Why |
|---|---|
| `chat()` is an async generator that yields `text` (and optional `notice`) chunks, then **exactly one** `done` chunk, last | The router, API and UI rely on this order |
| Put token counts in the `done` chunk's `usage` whenever the provider reports them | Cost tracking and budgets |
| Never yield `route` chunks | Those come from the router |
| Translate failures into `vachi.core.errors`: `ProviderAuthError` (bad key), `ModelNotFoundError`, `RateLimitError`, `ProviderUnavailableError` (can't connect, timeout), or `ProviderError(..., retryable=status >= 500)` | The router retries temporary errors and falls back on permanent ones; the API maps them to HTTP status codes |
| Never let raw SDK/HTTP exceptions or stack traces escape | Users see clear messages |
| Stopping early (`aclose()` on the generator) must not raise or hang | Stop button and disconnected clients |
| Secrets in `Config` use `SecretStr` | Keys never appear in logs or error messages |
| Don't send settings a model rejects (e.g. current Claude models reject `temperature`) | Avoids errors on otherwise valid requests |
| Release network clients in `aclose()` | Clean shutdown |

## Testing without a real server

Point the provider's HTTP client at a mock transport, as the built-in tests do:

- `httpx.MockTransport(handler)` for code using `httpx` (see the Ollama tests),
- `httpx2.MockTransport(handler)` for the official Anthropic and OpenAI SDKs, passed as
  `http_client=anthropic.DefaultAsyncHttpxClient(transport=...)`.

That way tests use the real parsing code, run in milliseconds, need no API keys, and cost nothing.
