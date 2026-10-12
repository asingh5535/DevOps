"""Picks which model answers, and recovers when one fails.

For a request to model A with `models.fallback: [B, C]` in vachi.yaml, the router tries
A, then B, then C. For each model:

1. Skip it if the provider can't be built (e.g. missing API key) or the budget is used up.
2. Start the answer and wait for its first piece (up to `first_token_timeout_seconds`).
3. Temporary failures (server down, rate limit, HTTP 5xx, timeout) are retried with
   exponential backoff: wait `backoff_seconds`, then twice that, ... up to `retries` times.
   Permanent failures (bad key, unknown model) move straight to the next model.
4. Once a model has produced its first piece, it's committed: the router yields a
   "route" chunk naming that model, then streams the rest. A failure after that point is
   reported as an error, because switching models mid-answer would mix two answers.

Every call is recorded for usage and cost tracking.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from contextlib import aclosing

from vachi.chat.usage import UsageRecord, UsageStore
from vachi.core.config import VachiConfig
from vachi.core.errors import ProviderError, ProviderUnavailableError, RoutingError, VachiError
from vachi.core.messages import ChatChunk, ChatRequest
from vachi.core.registry import ProviderRegistry

log = logging.getLogger(__name__)


class Router:
    def __init__(self, config: VachiConfig, registry: ProviderRegistry, usage: UsageStore | None = None):
        self.config = config
        self.registry = registry
        self.usage = usage
        self._sleep = asyncio.sleep  # replaced in tests

    def candidates(self, model_ref: str, fallback: bool = True) -> list[str]:
        """The requested model first, then the configured fallbacks (without duplicates)."""
        refs = [model_ref]
        if fallback:
            refs += [ref for ref in self.config.models.fallback if ref not in refs]
        return refs

    async def stream(
        self,
        model_ref: str | None,
        request: ChatRequest,
        *,
        source: str = "chat",
        conversation_id: str | None = None,
        fallback: bool = True,
    ) -> AsyncIterator[ChatChunk]:
        """Like ModelProvider.chat, but across models. `request.model` is ignored."""
        model_ref = model_ref or self.config.models.default
        self.registry.parse(model_ref)  # a malformed or unknown requested model is the caller's mistake
        routing = self.config.routing
        errors: list[tuple[str, VachiError]] = []

        for ref in self.candidates(model_ref, fallback):
            try:
                provider, model_name = self.registry.resolve(ref)
                if self.usage:
                    await self.usage.check_budget(ref)
            except VachiError as exc:
                errors.append((ref, exc))
                continue

            attempt_request = request.model_copy(update={"model": model_name})
            for attempt in range(routing.retries + 1):
                started = time.monotonic()
                chunks = provider.chat(attempt_request)
                try:
                    first = await asyncio.wait_for(anext(chunks, None), routing.first_token_timeout_seconds)
                except TimeoutError:
                    await chunks.aclose()
                    error: VachiError = ProviderUnavailableError(
                        provider.id, f"No answer within {routing.first_token_timeout_seconds:g}s."
                    )
                except VachiError as exc:
                    await chunks.aclose()
                    error = exc
                else:
                    latency_ms = round((time.monotonic() - started) * 1000)
                    reason = self._reason(model_ref, errors) if ref != model_ref else ""
                    yield ChatChunk(type="route", model=ref, text=reason)
                    rest = self._finish(chunks, first, ref, model_ref, source, conversation_id, latency_ms)
                    async with aclosing(rest):  # close it promptly if our own consumer stops early
                        async for chunk in rest:
                            yield chunk
                    return

                retryable = isinstance(error, ProviderError) and error.retryable
                if retryable and attempt < routing.retries:
                    delay = routing.backoff_seconds * 2**attempt
                    log.info("%s failed (%s); retrying in %.1fs", ref, error, delay)
                    await self._sleep(delay)
                    continue
                errors.append((ref, error))
                if self.usage:
                    await self.usage.record(
                        UsageRecord(model=ref, source=source, status="error", conversation_id=conversation_id)
                    )
                break

        if len(errors) == 1:
            raise errors[0][1]
        raise RoutingError(errors)

    async def _finish(self, chunks, first, ref, requested, source, conversation_id, latency_ms):
        """Stream the rest of a committed answer and record its usage."""
        idle_timeout = self.config.routing.idle_timeout_seconds
        usage, status = None, "ok"
        try:
            chunk = first
            while chunk is not None:
                if chunk.type == "done":
                    usage = chunk.usage
                yield chunk
                try:
                    chunk = await asyncio.wait_for(anext(chunks, None), idle_timeout)
                except TimeoutError:
                    raise ProviderUnavailableError(ref, f"The answer stalled for {idle_timeout:g}s.") from None
        except asyncio.CancelledError:
            status = "stopped"
            raise
        except GeneratorExit:
            status = "stopped"  # the consumer stopped reading (e.g. client disconnected)
            raise
        except Exception:
            status = "error"
            raise
        finally:
            await chunks.aclose()
            if self.usage:
                record = UsageRecord(
                    model=ref,
                    source=source,
                    status=status,
                    usage=usage,
                    conversation_id=conversation_id,
                    latency_ms=latency_ms,
                    fallback_from=requested if ref != requested else None,
                )
                await asyncio.shield(self.usage.record(record))

    @staticmethod
    def _reason(requested: str, errors: list[tuple[str, VachiError]]) -> str:
        failed = "; ".join(f"{ref}: {error}" for ref, error in errors)
        return f"{requested} couldn't answer ({failed})"
