"""Database connection.

Set VACHI_DATABASE_URL, for example:
  postgresql+asyncpg://vachi:secret@postgres:5432/vachi   (Docker Compose)
  sqlite+aiosqlite:///./vachi.db                           (default, for local development)
"""

from __future__ import annotations

import os

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from vachi.db.models import Base

DEFAULT_DATABASE_URL = "sqlite+aiosqlite:///./vachi.db"


def database_url() -> str:
    return os.environ.get("VACHI_DATABASE_URL") or DEFAULT_DATABASE_URL


def make_engine(url: str | None = None) -> AsyncEngine:
    url = url or database_url()
    engine = create_async_engine(url, pool_pre_ping=True)
    if url.startswith("sqlite"):
        # SQLite ignores foreign keys (and so ON DELETE CASCADE) unless asked.
        @event.listens_for(engine.sync_engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker:
    return async_sessionmaker(engine, expire_on_commit=False)


async def create_tables(engine: AsyncEngine) -> None:
    """Create missing tables. Schema migrations (Alembic) come in Phase 8."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
