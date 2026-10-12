"""Usage and cost tracking, and spending budgets."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from vachi.core.config import BudgetConfig
from vachi.core.errors import BudgetExceededError
from vachi.core.messages import Usage
from vachi.core.pricing import Pricing
from vachi.db.models import UsageEvent

log = logging.getLogger(__name__)


@dataclass
class UsageRecord:
    model: str
    source: str  # "chat" | "title" | "api"
    status: str  # "ok" | "stopped" | "error"
    usage: Usage | None = None
    conversation_id: str | None = None
    latency_ms: int | None = None
    fallback_from: str | None = None


def start_of_day(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def start_of_month(now: datetime) -> datetime:
    return start_of_day(now).replace(day=1)


class UsageStore:
    def __init__(self, sessionmaker: async_sessionmaker, pricing: Pricing, budget: BudgetConfig):
        self.sessionmaker = sessionmaker
        self.pricing = pricing
        self.budget = budget

    async def record(self, record: UsageRecord) -> float | None:
        """Save one model call. Returns its cost in USD (None if unknown). Never raises."""
        cost = self.pricing.cost(record.model, record.usage)
        try:
            async with self.sessionmaker() as db:
                db.add(
                    UsageEvent(
                        model=record.model,
                        source=record.source,
                        status=record.status,
                        conversation_id=record.conversation_id,
                        input_tokens=record.usage.input_tokens if record.usage else None,
                        output_tokens=record.usage.output_tokens if record.usage else None,
                        cost_usd=cost,
                        latency_ms=record.latency_ms,
                        fallback_from=record.fallback_from,
                    )
                )
                await db.commit()
        except Exception:  # losing one usage row must never break a chat
            log.exception("Couldn't save usage")
        return cost

    async def spent_since(self, since: datetime) -> float:
        async with self.sessionmaker() as db:
            total = await db.scalar(
                select(func.coalesce(func.sum(UsageEvent.cost_usd), 0.0)).where(UsageEvent.created_at >= since)
            )
            return float(total or 0.0)

    async def check_budget(self, model_ref: str, now: datetime | None = None) -> None:
        """Raise BudgetExceededError if `model_ref` costs money and a budget is used up.

        Free models (price 0) are always allowed. Models without a configured price are
        allowed too (their cost can't be counted); the usage page flags them.
        """
        if self.budget.daily_usd is None and self.budget.monthly_usd is None:
            return
        price = self.pricing.price(model_ref)
        if price is None or (price.input == 0 and price.output == 0):
            return
        now = now or datetime.now(UTC)
        if self.budget.daily_usd is not None:
            spent = await self.spent_since(start_of_day(now))
            if spent >= self.budget.daily_usd:
                raise BudgetExceededError(
                    f"Daily budget of ${self.budget.daily_usd:.2f} is used up (${spent:.2f} spent today)."
                )
        if self.budget.monthly_usd is not None:
            spent = await self.spent_since(start_of_month(now))
            if spent >= self.budget.monthly_usd:
                raise BudgetExceededError(
                    f"Monthly budget of ${self.budget.monthly_usd:.2f} is used up (${spent:.2f} spent this month)."
                )

    async def summary(self, days: int = 30, now: datetime | None = None) -> dict[str, Any]:
        """Totals for the usage page: today, this month, per model and per day."""
        now = now or datetime.now(UTC)
        since = start_of_day(now) - timedelta(days=days - 1)
        async with self.sessionmaker() as db:
            rows = (
                await db.execute(
                    select(
                        UsageEvent.created_at,
                        UsageEvent.model,
                        UsageEvent.status,
                        UsageEvent.input_tokens,
                        UsageEvent.output_tokens,
                        UsageEvent.cost_usd,
                        UsageEvent.fallback_from,
                        UsageEvent.latency_ms,
                    ).where(UsageEvent.created_at >= since)
                )
            ).all()

        by_model: dict[str, dict[str, Any]] = {}
        by_day: dict[str, dict[str, Any]] = {}
        for created_at, model, status, tin, tout, cost, fallback_from, latency in rows:
            m = by_model.setdefault(
                model,
                {
                    "model": model,
                    "calls": 0,
                    "errors": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cost_usd": 0.0,
                    "unpriced_calls": 0,
                    "fallback_calls": 0,
                    "latency_ms_total": 0,
                    "latency_samples": 0,
                },
            )
            m["calls"] += 1
            m["errors"] += status == "error"
            m["input_tokens"] += tin or 0
            m["output_tokens"] += tout or 0
            m["fallback_calls"] += fallback_from is not None
            if cost is None:
                m["unpriced_calls"] += status != "error"
            else:
                m["cost_usd"] += cost
            if latency is not None:
                m["latency_ms_total"] += latency
                m["latency_samples"] += 1

            day = created_at.date().isoformat()
            d = by_day.setdefault(day, {"date": day, "calls": 0, "tokens": 0, "cost_usd": 0.0})
            d["calls"] += 1
            d["tokens"] += (tin or 0) + (tout or 0)
            d["cost_usd"] += cost or 0.0

        for m in by_model.values():
            samples = m.pop("latency_samples")
            total = m.pop("latency_ms_total")
            m["avg_first_token_ms"] = round(total / samples) if samples else None
            m["price"] = p.model_dump() if (p := self.pricing.price(m["model"])) else None

        return {
            "days": days,
            "today_usd": await self.spent_since(start_of_day(now)),
            "month_usd": await self.spent_since(start_of_month(now)),
            "budget": self.budget.model_dump(),
            "by_model": sorted(by_model.values(), key=lambda m: (-m["cost_usd"], -m["calls"])),
            "by_day": sorted(by_day.values(), key=lambda d: d["date"]),
        }
