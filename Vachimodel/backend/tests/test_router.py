"""Router tests: fallback, retries with backoff, timeouts, budgets and usage tracking."""

import asyncio
from collections import Counter
from datetime import UTC, datetime

import pytest
from pydantic import BaseModel

from vachi.api.app import status_for
from vachi.chat.router import Router
from vachi.chat.usage import UsageRecord, UsageStore, start_of_day, start_of_month
from vachi.core.config import VachiConfig
from vachi.core.errors import (
    BudgetExceededError,
    ConfigError,
    ModelNotFoundError,
    ProviderAuthError,
    ProviderError,
    ProviderUnavailableError,
    RoutingError,
)
from vachi.core.interfaces import ModelProvider
from vachi.core.messages import ChatChunk, ChatRequest, Message, Usage
from vachi.core.pricing import Pricing
from vachi.core.registry import ProviderRegistry
from vachi.db.session import create_tables, make_engine, make_sessionmaker
from vachi.providers.anthropic import AnthropicProvider

CALLS: Counter = Counter()


class ScriptedConfig(BaseModel):
    pass


class ScriptedProvider(ModelProvider):
    """The model name decides the behaviour: ok, down, auth, missing, flaky, slowstart, midfail."""

    type_name = "scripted"
    Config = ScriptedConfig

    async def list_models(self):
        return []

    async def chat(self, request):
        key = f"{self.id}/{request.model}"
        CALLS[key] += 1
        match request.model:
            case "down":
                raise ProviderUnavailableError(self.id, "server down")
            case "auth":
                raise ProviderAuthError(self.id, "bad key")
            case "missing":
                raise ModelNotFoundError(self.id, "no such model")
            case "flaky" if CALLS[key] < 3:
                raise ProviderError(self.id, "HTTP 503", retryable=True)
            case "slowstart":
                await asyncio.sleep(10)
            case "midfail":
                yield ChatChunk(type="text", text="half an ans")
                raise ProviderUnavailableError(self.id, "connection lost")
        yield ChatChunk(type="text", text=f"answer from {key}")
        yield ChatChunk(type="done", stop_reason="end_turn", usage=Usage(input_tokens=1000, output_tokens=500))


REQUEST = ChatRequest(model="", messages=[Message(role="user", content="hi")])


@pytest.fixture(autouse=True)
def reset_calls():
    CALLS.clear()


async def make_router(tmp_path, *, fallback=(), budget=None, routing=None):
    config = VachiConfig.model_validate(
        {
            "providers": [
                {"id": "paid", "type": "scripted"},
                {"id": "free", "type": "scripted"},
                {"id": "keyless", "type": "anthropic", "api_key": "${ROUTER_TEST_MISSING_KEY}"},
            ],
            "models": {"default": "paid/ok", "fallback": list(fallback)},
            "routing": {"backoff_seconds": 1.0, **(routing or {})},
            "pricing": {"paid/*": {"input": 3.0, "output": 15.0}, "free/*": {"input": 0, "output": 0}},
            "budget": budget or {},
        }
    )
    registry = ProviderRegistry(config, {"scripted": ScriptedProvider, "anthropic": AnthropicProvider})
    engine = make_engine(f"sqlite+aiosqlite:///{tmp_path}/usage.db")
    await create_tables(engine)
    usage = UsageStore(make_sessionmaker(engine), Pricing(config.pricing), config.budget)
    router = Router(config, registry, usage)
    sleeps: list[float] = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    router._sleep = fake_sleep
    return router, usage, sleeps


async def run(router, model, **kwargs):
    return [c async for c in router.stream(model, REQUEST, **kwargs)]


def text(chunks):
    return "".join(c.text for c in chunks if c.type == "text")


async def test_success_routes_to_requested_model_and_records_cost(tmp_path):
    router, usage, _ = await make_router(tmp_path)
    chunks = await run(router, "paid/ok")
    assert chunks[0].type == "route" and chunks[0].model == "paid/ok" and chunks[0].text == ""
    assert text(chunks) == "answer from paid/ok"

    summary = await usage.summary()
    [row] = summary["by_model"]
    # 1000 input tokens at $3/M + 500 output tokens at $15/M = 0.003 + 0.0075
    assert row["model"] == "paid/ok" and row["calls"] == 1
    assert row["cost_usd"] == pytest.approx(0.0105)
    assert summary["today_usd"] == pytest.approx(0.0105)
    assert row["price"] == {"input": 3.0, "output": 15.0}


async def test_falls_back_when_primary_is_down(tmp_path):
    router, usage, sleeps = await make_router(tmp_path, fallback=["free/ok"])
    chunks = await run(router, "paid/down")
    assert chunks[0].model == "free/ok"
    assert "paid/down couldn't answer" in chunks[0].text and "server down" in chunks[0].text
    assert text(chunks) == "answer from free/ok"
    assert CALLS["paid/down"] == 2  # tried once more after a backoff, because "down" is temporary
    assert sleeps == [1.0]

    rows = {r["model"]: r for r in (await usage.summary())["by_model"]}
    assert rows["paid/down"]["errors"] == 1
    assert rows["free/ok"]["fallback_calls"] == 1 and rows["free/ok"]["cost_usd"] == 0


async def test_retries_with_exponential_backoff_then_succeeds(tmp_path):
    router, _, sleeps = await make_router(tmp_path, routing={"retries": 2})
    chunks = await run(router, "paid/flaky")
    assert text(chunks) == "answer from paid/flaky"
    assert CALLS["paid/flaky"] == 3
    assert sleeps == [1.0, 2.0]
    assert chunks[0].text == ""  # same model in the end: not a fallback


async def test_permanent_errors_are_not_retried(tmp_path):
    router, _, sleeps = await make_router(tmp_path, fallback=["free/ok"])
    chunks = await run(router, "paid/auth")
    assert CALLS["paid/auth"] == 1 and sleeps == []
    assert chunks[0].model == "free/ok"


async def test_missing_api_key_falls_back(tmp_path, monkeypatch):
    monkeypatch.delenv("ROUTER_TEST_MISSING_KEY", raising=False)
    router, _, _ = await make_router(tmp_path, fallback=["free/ok"])
    chunks = await run(router, "keyless/claude-opus-5-5")
    assert chunks[0].model == "free/ok" and "ROUTER_TEST_MISSING_KEY" in chunks[0].text


async def test_single_model_failure_keeps_its_error_type(tmp_path):
    router, _, _ = await make_router(tmp_path)
    with pytest.raises(ModelNotFoundError):
        await run(router, "paid/missing")


async def test_all_models_failing_reports_every_attempt(tmp_path):
    router, _, _ = await make_router(tmp_path, fallback=["free/auth"], routing={"retries": 0})
    with pytest.raises(RoutingError) as exc_info:
        await run(router, "paid/missing")
    error = exc_info.value
    assert [model for model, _ in error.errors] == ["paid/missing", "free/auth"]
    assert "no such model" in str(error) and "bad key" in str(error)
    assert status_for(error) == 404  # reported like the requested model's own failure


async def test_fallback_can_be_disabled(tmp_path):
    router, _, _ = await make_router(tmp_path, fallback=["free/ok"])
    with pytest.raises(ProviderAuthError):
        await run(router, "paid/auth", fallback=False)


async def test_slow_first_token_times_out_and_falls_back(tmp_path):
    router, _, _ = await make_router(
        tmp_path, fallback=["free/ok"], routing={"first_token_timeout_seconds": 0.05, "retries": 0}
    )
    chunks = await run(router, "paid/slowstart")
    assert chunks[0].model == "free/ok" and "No answer within 0.05s" in chunks[0].text


async def test_failure_after_answer_started_is_not_retried(tmp_path):
    router, usage, _ = await make_router(tmp_path, fallback=["free/ok"])
    with pytest.raises(ProviderUnavailableError, match="connection lost"):
        await run(router, "paid/midfail")
    assert CALLS["free/ok"] == 0  # no switching models mid-answer
    [row] = (await usage.summary())["by_model"]
    assert row["errors"] == 1


async def test_unknown_requested_provider_is_a_config_error(tmp_path):
    router, _, _ = await make_router(tmp_path, fallback=["free/ok"])
    with pytest.raises(ConfigError, match="Unknown provider 'nope'"):
        await run(router, "nope/x")


async def test_budget_skips_paid_models_but_free_fallback_still_works(tmp_path):
    router, usage, _ = await make_router(tmp_path, fallback=["free/ok"], budget={"daily_usd": 0.01})
    await usage.record(UsageRecord(model="paid/ok", source="chat", status="ok", usage=Usage(input_tokens=10_000)))
    # spent 10,000 x $3/M = $0.03 > $0.01

    chunks = await run(router, "paid/ok")
    assert chunks[0].model == "free/ok" and "Daily budget" in chunks[0].text
    assert CALLS["paid/ok"] == 0

    with pytest.raises(BudgetExceededError, match="Daily budget of \\$0.01"):
        await run(router, "paid/ok", fallback=False)
    assert status_for(BudgetExceededError("x")) == 402


async def test_monthly_budget(tmp_path):
    router, usage, _ = await make_router(tmp_path, budget={"monthly_usd": 0.02})
    await usage.record(UsageRecord(model="paid/ok", source="chat", status="ok", usage=Usage(output_tokens=2_000)))
    with pytest.raises(BudgetExceededError, match="Monthly budget"):
        await run(router, "paid/ok")


async def test_unpriced_models_are_counted_but_not_costed(tmp_path):
    router, usage, _ = await make_router(tmp_path)
    await usage.record(UsageRecord(model="other/x", source="api", status="ok", usage=Usage(input_tokens=5)))
    [row] = (await usage.summary())["by_model"]
    assert row["unpriced_calls"] == 1 and row["cost_usd"] == 0 and row["price"] is None


async def test_stopping_mid_answer_records_a_stopped_call(tmp_path):
    router, usage, _ = await make_router(tmp_path)
    stream = router.stream("paid/ok", REQUEST)
    await anext(stream)  # route
    await anext(stream)  # first text
    await stream.aclose()
    [row] = (await usage.summary())["by_model"]
    assert row["calls"] == 1


def test_period_boundaries():
    now = datetime(2026, 10, 12, 15, 30, tzinfo=UTC)
    assert start_of_day(now) == datetime(2026, 10, 12, tzinfo=UTC)
    assert start_of_month(now) == datetime(2026, 10, 1, tzinfo=UTC)


def test_pricing_first_match_wins():
    from vachi.core.config import Price

    pricing = Pricing(
        {"anthropic/claude-haiku-*": Price(input=0.1, output=0.5), "anthropic/*": Price(input=4, output=20)}
    )
    assert pricing.price("anthropic/claude-haiku-5-5").input == 0.1
    assert pricing.price("anthropic/claude-opus-5-5").output == 20
    assert pricing.price("local/llama3.2") is None
    assert pricing.cost("anthropic/claude-opus-5-5", Usage(input_tokens=1_000_000, output_tokens=0)) == 4
