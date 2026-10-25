"""Provider adapter tests. All HTTP is mocked; no real API calls are made.

The Anthropic and OpenAI tests use the real SDK clients with a mock network
transport, so they check our code against the SDKs' actual parsing.
"""

import json

import anthropic
import httpx
import httpx2
import openai
import pytest
from pydantic import SecretStr

from vachi.core.errors import (
    ModelNotFoundError,
    ProviderAuthError,
    ProviderUnavailableError,
    RateLimitError,
)
from vachi.core.messages import ChatRequest, Message
from vachi.providers.anthropic import AnthropicConfig, AnthropicProvider
from vachi.providers.ollama import OllamaConfig, OllamaProvider
from vachi.providers.openai_compat import OpenAICompatConfig, OpenAICompatProvider

REQUEST = ChatRequest(
    model="test-model",
    system="Be brief.",
    messages=[
        Message(role="user", content="Hi"),
        Message(role="assistant", content="Hello"),
        Message(role="user", content="How are you?"),
    ],
)


async def collect(provider, request=REQUEST):
    return [chunk async for chunk in provider.chat(request)]


def text_of(chunks):
    return "".join(c.text for c in chunks if c.type == "text")


def sse(events: list[tuple[str | None, dict | str]]) -> bytes:
    lines = []
    for event, data in events:
        if event:
            lines.append(f"event: {event}")
        lines.append(f"data: {data if isinstance(data, str) else json.dumps(data)}")
        lines.append("")
    return ("\n".join(lines) + "\n").encode()


# --------------------------------------------------------------------------- Ollama


def ollama(handler) -> OllamaProvider:
    return OllamaProvider("local", OllamaConfig(), transport=httpx.MockTransport(handler))


async def test_ollama_streams_text_and_usage():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        lines = [
            {"message": {"role": "assistant", "content": "I'm "}, "done": False},
            {"message": {"role": "assistant", "content": "fine."}, "done": False},
            {
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "done_reason": "stop",
                "prompt_eval_count": 12,
                "eval_count": 3,
            },
        ]
        return httpx.Response(200, content="\n".join(json.dumps(x) for x in lines).encode())

    chunks = await collect(ollama(handler))
    assert text_of(chunks) == "I'm fine."
    assert chunks[-1].type == "done"
    assert chunks[-1].usage.input_tokens == 12 and chunks[-1].usage.output_tokens == 3
    assert seen["messages"][0] == {"role": "system", "content": "Be brief."}
    assert [m["role"] for m in seen["messages"]] == ["system", "user", "assistant", "user"]
    assert "options" not in seen  # no temperature/max_tokens given


async def test_ollama_sends_generation_options():
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, content=b'{"done": true}')

    await collect(ollama(handler), REQUEST.model_copy(update={"temperature": 0.2, "max_tokens": 50}))
    assert seen["options"] == {"temperature": 0.2, "num_predict": 50}


async def test_ollama_missing_model_suggests_pull():
    provider = ollama(lambda r: httpx.Response(404, json={"error": "model 'test-model' not found"}))
    with pytest.raises(ModelNotFoundError, match="ollama pull test-model"):
        await collect(provider)


async def test_ollama_not_running():
    def handler(request):
        raise httpx.ConnectError("connection refused")

    with pytest.raises(ProviderUnavailableError, match="ollama serve"):
        await collect(ollama(handler))


async def test_ollama_lists_models():
    provider = ollama(lambda r: httpx.Response(200, json={"models": [{"name": "llama3.2:latest", "size": 1}]}))
    models = await provider.list_models()
    assert [m.full_id for m in models] == ["local/llama3.2:latest"]


# --------------------------------------------------------------------------- Anthropic


def anthropic_provider(handler, **config) -> AnthropicProvider:
    client = anthropic.AsyncAnthropic(
        api_key="sk-test",
        max_retries=0,
        http_client=anthropic.DefaultAsyncHttpxClient(transport=httpx2.MockTransport(handler)),
    )
    return AnthropicProvider("claude", AnthropicConfig(api_key=SecretStr("sk-test"), **config), client=client)


def anthropic_stream(texts, stop_reason="end_turn", model="test-model") -> bytes:
    events = [
        (
            "message_start",
            {
                "type": "message_start",
                "message": {
                    "id": "msg_1",
                    "type": "message",
                    "role": "assistant",
                    "model": model,
                    "content": [],
                    "stop_reason": None,
                    "stop_sequence": None,
                    "usage": {"input_tokens": 20, "output_tokens": 1},
                },
            },
        ),
        (
            "content_block_start",
            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        ),
    ]
    for t in texts:
        events.append(
            (
                "content_block_delta",
                {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": t}},
            )
        )
    events += [
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        (
            "message_delta",
            {
                "type": "message_delta",
                "delta": {"stop_reason": stop_reason, "stop_sequence": None},
                "usage": {"output_tokens": 7},
            },
        ),
        ("message_stop", {"type": "message_stop"}),
    ]
    return sse(events)


async def test_anthropic_streams_text_and_usage():
    seen = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen["body"] = json.loads(request.content)
        seen["beta"] = request.headers.get("anthropic-beta")
        return httpx2.Response(
            200, headers={"content-type": "text/event-stream"}, content=anthropic_stream(["Doing ", "well!"])
        )

    chunks = await collect(anthropic_provider(handler))
    assert text_of(chunks) == "Doing well!"
    assert chunks[-1].type == "done" and chunks[-1].stop_reason == "end_turn"
    assert chunks[-1].usage.input_tokens == 20 and chunks[-1].usage.output_tokens == 7
    assert not [c for c in chunks if c.type == "notice"]

    body = seen["body"]
    assert body["system"] == "Be brief."
    assert [m["role"] for m in body["messages"]] == ["user", "assistant", "user"]
    assert body["max_tokens"] == 64000
    assert "temperature" not in body  # current Claude models reject it
    assert body["fallbacks"] == "default" and "server-side-fallback" in seen["beta"]


async def test_anthropic_effort_and_no_fallbacks():
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        seen["beta"] = request.headers.get("anthropic-beta")
        return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=anthropic_stream(["ok"]))

    await collect(anthropic_provider(handler, effort="low", server_fallbacks=False))
    assert seen["body"]["output_config"] == {"effort": "low"}
    assert "fallbacks" not in seen["body"] and not seen["beta"]


async def test_anthropic_reports_refusal_and_fallback_model():
    def handler(request):
        return httpx2.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=anthropic_stream([], stop_reason="refusal", model="other-model"),
        )

    chunks = await collect(anthropic_provider(handler))
    notices = " ".join(c.text for c in chunks if c.type == "notice")
    assert "declined" in notices and "other-model" in notices


@pytest.mark.parametrize(
    ("status", "error_type", "error"),
    [
        (401, "authentication_error", ProviderAuthError),
        (404, "not_found_error", ModelNotFoundError),
        (429, "rate_limit_error", RateLimitError),
    ],
)
async def test_anthropic_errors_are_translated(status, error_type, error):
    def handler(request):
        return httpx2.Response(status, json={"type": "error", "error": {"type": error_type, "message": "nope"}})

    with pytest.raises(error):
        await collect(anthropic_provider(handler))


async def test_anthropic_connection_error():
    def handler(request):
        raise httpx2.ConnectError("offline")

    with pytest.raises(ProviderUnavailableError, match="internet"):
        await collect(anthropic_provider(handler))


# --------------------------------------------------------------------------- OpenAI-compatible


def openai_provider(handler) -> OpenAICompatProvider:
    client = openai.AsyncOpenAI(
        api_key="sk-test",
        base_url="http://test/v1",
        max_retries=0,
        http_client=openai.DefaultAsyncHttpxClient(transport=httpx2.MockTransport(handler)),
    )
    return OpenAICompatProvider("oai", OpenAICompatConfig(base_url="http://test/v1"), client=client)


def openai_chunk(content=None, finish=None, usage=None, choices=True):
    return {
        "id": "c1",
        "object": "chat.completion.chunk",
        "created": 1,
        "model": "test-model",
        "choices": [{"index": 0, "delta": {"content": content} if content else {}, "finish_reason": finish}]
        if choices
        else [],
        "usage": usage,
    }


async def test_openai_streams_text_and_usage():
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        body = sse(
            [
                (None, openai_chunk("Good, ")),
                (None, openai_chunk("thanks.")),
                (None, openai_chunk(finish="stop")),
                (
                    None,
                    openai_chunk(choices=False, usage={"prompt_tokens": 9, "completion_tokens": 4, "total_tokens": 13}),
                ),
                (None, "[DONE]"),
            ]
        )
        return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=body)

    chunks = await collect(openai_provider(handler), REQUEST.model_copy(update={"temperature": 0.5}))
    assert text_of(chunks) == "Good, thanks."
    assert chunks[-1].stop_reason == "stop"
    assert chunks[-1].usage.input_tokens == 9 and chunks[-1].usage.output_tokens == 4
    assert seen["messages"][0] == {"role": "system", "content": "Be brief."}
    assert seen["temperature"] == 0.5 and seen["stream"] is True


async def test_openai_bad_key():
    def handler(request):
        return httpx2.Response(401, json={"error": {"message": "bad key", "type": "invalid_request_error"}})

    with pytest.raises(ProviderAuthError):
        await collect(openai_provider(handler))
