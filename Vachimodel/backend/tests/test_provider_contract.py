"""Contract tests: every provider adapter must behave the same way.

Each provider is run against the same scenarios through a mocked network, using the
provider's own wire format. A new provider gets added to PROVIDERS below and must pass all
of these before Vachi relies on it.
"""

import json
from dataclasses import dataclass
from typing import Any

import anthropic
import httpx
import httpx2
import openai
import pytest
from pydantic import SecretStr
from test_providers import anthropic_stream, openai_chunk, sse

from vachi.core.errors import (
    ModelNotFoundError,
    ProviderAuthError,
    ProviderError,
    ProviderUnavailableError,
    RateLimitError,
)
from vachi.core.messages import ChatRequest, Message
from vachi.providers.anthropic import AnthropicConfig, AnthropicProvider
from vachi.providers.ollama import OllamaConfig, OllamaProvider
from vachi.providers.openai_compat import OpenAICompatConfig, OpenAICompatProvider

REQUEST = ChatRequest(model="test-model", messages=[Message(role="user", content="Hi")])


@dataclass
class Kit:
    """How to fake one provider's server."""

    name: str
    http: Any  # httpx or httpx2, whichever the provider's client uses
    build: Any  # handler -> provider
    ok_body: Any  # () -> (content_type, bytes) for a streamed "Hello world" answer, usage 5 in / 2 out
    error_body: Any  # (status, message) -> dict


def ollama_ok():
    lines = [
        {"message": {"content": "Hello"}, "done": False},
        {"message": {"content": " world"}, "done": False},
        {"message": {"content": ""}, "done": True, "done_reason": "stop", "prompt_eval_count": 5, "eval_count": 2},
    ]
    return "application/x-ndjson", "\n".join(json.dumps(x) for x in lines).encode()


def anthropic_ok():
    body = anthropic_stream(["Hello", " world"]).replace(b'"output_tokens": 7', b'"output_tokens": 2')
    return "text/event-stream", body.replace(b'"input_tokens": 20', b'"input_tokens": 5')


def openai_ok():
    usage = {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7}
    body = sse(
        [
            (None, openai_chunk("Hello")),
            (None, openai_chunk(" world")),
            (None, openai_chunk(finish="stop")),
            (None, openai_chunk(choices=False, usage=usage)),
            (None, "[DONE]"),
        ]
    )
    return "text/event-stream", body


def build_anthropic(handler):
    client = anthropic.AsyncAnthropic(
        api_key="k",
        max_retries=0,
        http_client=anthropic.DefaultAsyncHttpxClient(transport=httpx2.MockTransport(handler)),
    )
    return AnthropicProvider("p", AnthropicConfig(api_key=SecretStr("k")), client=client)


def build_openai(handler):
    client = openai.AsyncOpenAI(
        api_key="k",
        base_url="http://test/v1",
        max_retries=0,
        http_client=openai.DefaultAsyncHttpxClient(transport=httpx2.MockTransport(handler)),
    )
    return OpenAICompatProvider("p", OpenAICompatConfig(), client=client)


PROVIDERS = [
    Kit(
        "ollama",
        httpx,
        lambda h: OllamaProvider("p", OllamaConfig(), transport=httpx.MockTransport(h)),
        ollama_ok,
        lambda status, msg: {"error": msg},
    ),
    Kit(
        "anthropic",
        httpx2,
        build_anthropic,
        anthropic_ok,
        lambda status, msg: {"type": "error", "error": {"type": "api_error", "message": msg}},
    ),
    Kit(
        "openai",
        httpx2,
        build_openai,
        openai_ok,
        lambda status, msg: {"error": {"message": msg, "type": "api_error"}},
    ),
]


@pytest.fixture(params=PROVIDERS, ids=lambda k: k.name)
def kit(request) -> Kit:
    return request.param


async def collect(provider):
    return [c async for c in provider.chat(REQUEST)]


async def test_streams_text_then_exactly_one_done_with_usage(kit):
    content_type, body = kit.ok_body()
    provider = kit.build(lambda r: kit.http.Response(200, headers={"content-type": content_type}, content=body))
    chunks = await collect(provider)

    assert "".join(c.text for c in chunks if c.type == "text") == "Hello world"
    assert [c.type for c in chunks].count("done") == 1 and chunks[-1].type == "done"
    assert chunks[-1].usage.input_tokens == 5 and chunks[-1].usage.output_tokens == 2
    assert all(c.type in ("text", "notice", "done") for c in chunks)  # "route" is the router's job


@pytest.mark.parametrize(
    ("status", "error", "retryable"),
    [
        (401, ProviderAuthError, False),
        (404, ModelNotFoundError, False),
        (429, RateLimitError, True),
        (500, ProviderError, True),
        (400, ProviderError, False),
    ],
)
async def test_http_errors_map_to_vachi_errors(kit, status, error, retryable):
    provider = kit.build(lambda r: kit.http.Response(status, json=kit.error_body(status, "nope")))
    with pytest.raises(error) as exc_info:
        await collect(provider)
    assert exc_info.value.retryable is retryable
    assert exc_info.value.provider == "p"


async def test_unreachable_server_is_unavailable_and_retryable(kit):
    def handler(request):
        raise kit.http.ConnectError("connection refused")

    with pytest.raises(ProviderUnavailableError) as exc_info:
        await collect(kit.build(handler))
    assert exc_info.value.retryable


async def test_consumer_can_stop_early(kit):
    content_type, body = kit.ok_body()
    provider = kit.build(lambda r: kit.http.Response(200, headers={"content-type": content_type}, content=body))
    chunks = provider.chat(REQUEST)
    first = await anext(chunks)
    assert first.type == "text"
    await chunks.aclose()  # must not raise or hang
    await provider.aclose()
