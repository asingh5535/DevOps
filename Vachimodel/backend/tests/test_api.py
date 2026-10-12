"""Web API tests, using a fake provider and a temporary SQLite database."""

import asyncio
import json

import httpx
import httpx2
import openai
import pytest
from pydantic import BaseModel

from vachi.api.app import create_app
from vachi.chat.service import TITLE_PROMPT
from vachi.core.config import VachiConfig
from vachi.core.errors import ProviderError, ProviderUnavailableError
from vachi.core.interfaces import ModelProvider
from vachi.core.messages import ChatChunk, ModelInfo, Usage
from vachi.core.registry import ProviderRegistry


class FakeConfig(BaseModel):
    pass


class FakeProvider(ModelProvider):
    """Models: echo (repeats the last message), slow (never finishes), broken, halfbroken."""

    type_name = "fake"
    Config = FakeConfig

    def __init__(self, provider_id, config):
        super().__init__(provider_id, config)
        self.requests = []

    async def list_models(self):
        return [ModelInfo(id=name, provider=self.id) for name in ("echo", "slow")]

    async def chat(self, request):
        self.requests.append(request)
        if request.system == TITLE_PROMPT:
            yield ChatChunk(type="text", text="Docker Volumes Explained")
            yield ChatChunk(type="done")
            return
        if request.model == "broken":
            raise ProviderUnavailableError(self.id, "server is down")
        if request.model == "halfbroken":
            yield ChatChunk(type="text", text="partial")
            raise ProviderError(self.id, "lost connection")
        if request.model == "slow":
            yield ChatChunk(type="text", text="thinking about it ")
            await asyncio.sleep(30)
        last = request.messages[-1].content
        yield ChatChunk(type="text", text="echo: ")
        yield ChatChunk(type="text", text=last)
        yield ChatChunk(type="done", stop_reason="end_turn", usage=Usage(input_tokens=3, output_tokens=2))


@pytest.fixture
async def app(tmp_path):
    config = VachiConfig.model_validate(
        {
            "providers": [{"id": "fake", "type": "fake"}],
            "models": {"default": "fake/echo"},
            "system_prompt": "You are Vachi.",
        }
    )
    registry = ProviderRegistry(config, {"fake": FakeProvider})
    app = create_app(config, registry, database_url=f"sqlite+aiosqlite:///{tmp_path}/test.db")
    async with app.router.lifespan_context(app):
        yield app


@pytest.fixture
async def client(app):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


def provider(app) -> FakeProvider:
    return app.state.registry.get("fake")


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


async def send(client, conversation_id, content, **extra):
    response = await client.post(f"/api/conversations/{conversation_id}/messages", json={"content": content, **extra})
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-accel-buffering"] == "no"
    return parse_sse(response.text)


async def new_chat(client, **body) -> str:
    response = await client.post("/api/conversations", json=body)
    assert response.status_code == 201
    return response.json()["id"]


# ---------------------------------------------------------------------- health


async def test_health_and_ready(client):
    assert (await client.get("/api/health")).json()["status"] == "ok"
    assert (await client.get("/api/ready")).json() == {"status": "ok", "database": "up"}


# ---------------------------------------------------------------------- chatting


async def test_chat_streams_saves_and_titles(client, app):
    cid = await new_chat(client)
    events = await send(client, cid, "How do Docker volumes work?")

    names = [name for name, _ in events]
    assert names == ["start", "delta", "delta", "done", "title"]
    assert events[0][1]["user_message"]["content"] == "How do Docker volumes work?"
    assert events[0][1]["model"] == "fake/echo"
    assert "".join(d["text"] for n, d in events if n == "delta") == "echo: How do Docker volumes work?"
    done = events[3][1]["message"]
    assert done["role"] == "assistant" and done["model"] == "fake/echo" and done["output_tokens"] == 2
    assert events[4][1]["title"] == "Docker Volumes Explained"

    conversation = (await client.get(f"/api/conversations/{cid}")).json()
    assert conversation["title"] == "Docker Volumes Explained"
    assert [m["role"] for m in conversation["messages"]] == ["user", "assistant"]
    assert provider(app).requests[0].system == "You are Vachi."


async def test_history_is_sent_and_model_can_change_mid_chat(client, app):
    cid = await new_chat(client)
    await send(client, cid, "first")
    events = await send(client, cid, "second", model="fake/echo", temperature=0.3, max_tokens=99)
    assert "title" not in [n for n, _ in events]  # only the first exchange gets a title

    request = provider(app).requests[-1]
    assert [m.content for m in request.messages] == ["first", "echo: first", "second"]
    assert request.temperature == 0.3 and request.max_tokens == 99


async def test_edit_message_drops_later_messages(client, app):
    cid = await new_chat(client)
    await send(client, cid, "one")
    await send(client, cid, "two")
    messages = (await client.get(f"/api/conversations/{cid}")).json()["messages"]
    second_question = messages[2]

    await send(client, cid, "two, edited", edit_message_id=second_question["id"])
    contents = [m["content"] for m in (await client.get(f"/api/conversations/{cid}")).json()["messages"]]
    assert contents == ["one", "echo: one", "two, edited", "echo: two, edited"]


async def test_regenerate_replaces_last_answer(client):
    cid = await new_chat(client)
    await send(client, cid, "hello")
    response = await client.post(f"/api/conversations/{cid}/regenerate", json={})
    events = parse_sse(response.text)
    assert events[0][1]["user_message"] is None
    messages = (await client.get(f"/api/conversations/{cid}")).json()["messages"]
    assert [m["role"] for m in messages] == ["user", "assistant"]


async def test_provider_error_is_streamed_and_question_kept(client):
    cid = await new_chat(client, model="fake/broken")
    events = await send(client, cid, "hi")
    assert events[-1] == ("error", {"message": "[fake] server is down"})
    messages = (await client.get(f"/api/conversations/{cid}")).json()["messages"]
    assert [m["role"] for m in messages] == ["user"]  # can be retried with regenerate

    await client.patch(f"/api/conversations/{cid}", json={"model": "fake/echo"})
    events = parse_sse((await client.post(f"/api/conversations/{cid}/regenerate", json={})).text)
    assert "done" in [name for name, _ in events]
    messages = (await client.get(f"/api/conversations/{cid}")).json()["messages"]
    assert [m["content"] for m in messages] == ["hi", "echo: hi"]


async def test_partial_answer_kept_on_error(client):
    cid = await new_chat(client, model="fake/halfbroken")
    await send(client, cid, "hi")
    messages = (await client.get(f"/api/conversations/{cid}")).json()["messages"]
    assert messages[-1]["content"] == "partial" and messages[-1]["stop_reason"] == "error"


async def test_stop_saves_partial_answer(app):
    service = app.state.chat
    cid = (await service.create_conversation(model="fake/slow"))["id"]
    events = await service.start_turn(cid, content="tell me a story")
    assert (await anext(events))[0] == "start"
    assert (await anext(events)) == ("delta", {"text": "thinking about it "})

    assert await service.stop(cid) is True
    rest = [e async for e in events]
    assert rest[-1][0] == "done"
    assert rest[-1][1]["message"]["stop_reason"] == "stopped"

    saved = (await service.get_conversation(cid))["messages"]
    assert saved[-1]["content"] == "thinking about it " and saved[-1]["stop_reason"] == "stopped"
    assert not service.is_running(cid)


async def test_second_message_while_answering_is_rejected(app, client):
    service = app.state.chat
    cid = (await service.create_conversation(model="fake/slow"))["id"]
    events = await service.start_turn(cid, content="first")
    await anext(events)
    response = await client.post(f"/api/conversations/{cid}/messages", json={"content": "second"})
    assert response.status_code == 409
    await service.stop(cid)


# ---------------------------------------------------------------------- conversations


async def test_list_search_rename_export_delete(client):
    a = await new_chat(client)
    await send(client, a, "kubernetes pods crash")
    b = await new_chat(client, title="Holiday plans")

    listed = (await client.get("/api/conversations")).json()
    assert {c["id"] for c in listed} == {a, b}
    assert [c["id"] for c in (await client.get("/api/conversations", params={"q": "CRASH"})).json()] == [a]
    assert [c["id"] for c in (await client.get("/api/conversations", params={"q": "holiday"})).json()] == [b]

    renamed = await client.patch(f"/api/conversations/{b}", json={"title": "Goa trip"})
    assert renamed.json()["title"] == "Goa trip"

    md = await client.get(f"/api/conversations/{a}/export")
    assert "attachment" in md.headers["content-disposition"]
    assert "kubernetes pods crash" in md.text and "**You:**" in md.text
    js = await client.get(f"/api/conversations/{a}/export", params={"format": "json"})
    assert js.json()["messages"][0]["content"] == "kubernetes pods crash"

    assert (await client.delete(f"/api/conversations/{a}")).status_code == 204
    assert (await client.get(f"/api/conversations/{a}")).status_code == 404


async def test_error_status_codes(client):
    assert (await client.get("/api/conversations/missing")).status_code == 404
    bad_model = await client.post("/api/conversations", json={"model": "nope/x"})
    assert bad_model.status_code == 400 and "Unknown provider" in bad_model.json()["detail"]
    cid = await new_chat(client)
    assert (await client.post(f"/api/conversations/{cid}/messages", json={"content": ""})).status_code == 422
    edit_missing = await client.post(
        f"/api/conversations/{cid}/messages", json={"content": "x", "edit_message_id": 12345}
    )
    assert edit_missing.status_code == 404


async def test_models_endpoint(client):
    data = (await client.get("/api/models")).json()
    assert data["default"] == "fake/echo"
    assert [m["id"] for m in data["models"]] == ["fake/echo", "fake/slow"]
    assert data["providers"] == [{"id": "fake", "type": "fake", "ok": True}]


# ---------------------------------------------------------------------- OpenAI-compatible


@pytest.fixture
async def openai_client(app):
    http_client = openai.DefaultAsyncHttpxClient(transport=httpx2.ASGITransport(app=app))
    async with openai.AsyncOpenAI(
        api_key="anything", base_url="http://test/v1", http_client=http_client, max_retries=0
    ) as c:
        yield c


async def test_openai_sdk_non_streaming(openai_client, app):
    response = await openai_client.chat.completions.create(
        model="fake/echo",
        messages=[{"role": "system", "content": "Be short."}, {"role": "user", "content": "ping"}],
    )
    assert response.choices[0].message.content == "echo: ping"
    assert response.choices[0].finish_reason == "stop"
    assert response.usage.total_tokens == 5
    assert provider(app).requests[-1].system == "Be short."


async def test_openai_sdk_streaming(openai_client):
    stream = await openai_client.chat.completions.create(
        model="fake/echo",
        messages=[{"role": "user", "content": [{"type": "text", "text": "pong"}]}],
        stream=True,
        stream_options={"include_usage": True},
    )
    text, finish, usage = "", None, None
    async for chunk in stream:
        if chunk.usage:
            usage = chunk.usage
        for choice in chunk.choices:
            text += choice.delta.content or ""
            finish = choice.finish_reason or finish
    assert text == "echo: pong" and finish == "stop" and usage.completion_tokens == 2


async def test_openai_sdk_models_and_errors(openai_client):
    models = [m.id async for m in openai_client.models.list()]
    assert models == ["fake/echo", "fake/slow"]

    with pytest.raises(openai.BadRequestError):
        await openai_client.chat.completions.create(model="nope/x", messages=[{"role": "user", "content": "x"}])
    with pytest.raises(openai.APIStatusError) as exc_info:  # provider down -> 503 before streaming starts
        await openai_client.chat.completions.create(
            model="fake/broken", messages=[{"role": "user", "content": "x"}], stream=True
        )
    assert exc_info.value.status_code == 503


async def test_openai_api_key_required_when_configured(app, monkeypatch):
    monkeypatch.setenv("VACHI_API_KEY", "secret-key")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        denied = await c.get("/v1/models")
        assert denied.status_code == 401 and denied.json()["error"]["type"] == "authentication_error"
        allowed = await c.get("/v1/models", headers={"Authorization": "Bearer secret-key"})
        assert allowed.status_code == 200
