"""FastAPI application: `/api/*` for the Vachi web UI, `/v1/*` for OpenAI-compatible clients."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from vachi import __version__
from vachi.api import routes_chat, routes_openai
from vachi.chat.service import ChatService, ConflictError, NotFoundError
from vachi.core.config import VachiConfig
from vachi.core.errors import (
    ConfigError,
    ModelNotFoundError,
    ProviderAuthError,
    ProviderUnavailableError,
    RateLimitError,
    VachiError,
)
from vachi.core.registry import ProviderRegistry
from vachi.db.session import create_tables, make_engine, make_sessionmaker

log = logging.getLogger(__name__)

# Most specific first.
STATUS_CODES: list[tuple[type[VachiError], int]] = [
    (routes_openai.ApiKeyError, 401),
    (NotFoundError, 404),
    (ModelNotFoundError, 404),
    (ConflictError, 409),
    (ConfigError, 400),
    (RateLimitError, 429),
    (ProviderUnavailableError, 503),
    (ProviderAuthError, 502),
    (VachiError, 502),
]


def status_for(exc: VachiError) -> int:
    return next(code for cls, code in STATUS_CODES if isinstance(exc, cls))


def create_app(
    config: VachiConfig, registry: ProviderRegistry | None = None, database_url: str | None = None
) -> FastAPI:
    registry = registry or ProviderRegistry(config)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = make_engine(database_url)
        await create_tables(engine)
        app.state.engine = engine
        app.state.chat = ChatService(config, registry, make_sessionmaker(engine))
        yield
        await app.state.chat.shutdown()
        await registry.aclose()
        await engine.dispose()

    app = FastAPI(title="Vachi", version=__version__, lifespan=lifespan)
    app.state.config = config
    app.state.registry = registry
    app.state.model_cache = {"at": 0.0, "data": None}

    @app.exception_handler(VachiError)
    async def vachi_error_handler(request: Request, exc: VachiError) -> JSONResponse:
        status = status_for(exc)
        if request.url.path.startswith("/v1/"):
            return JSONResponse(status_code=status, content=routes_openai.error_body(str(exc), status))
        return JSONResponse(status_code=status, content={"detail": str(exc)})

    @app.get("/api/health", tags=["ops"])
    async def health() -> dict:
        """Liveness: the process is up."""
        return {"status": "ok", "version": __version__}

    @app.get("/api/ready", tags=["ops"])
    async def ready(request: Request) -> JSONResponse:
        """Readiness: the database answers."""
        try:
            async with request.app.state.engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as exc:
            log.warning("Readiness check failed: %s", exc)
            return JSONResponse(status_code=503, content={"status": "unavailable", "database": "down"})
        return JSONResponse({"status": "ok", "database": "up"})

    app.include_router(routes_chat.router)
    app.include_router(routes_openai.router)
    return app
