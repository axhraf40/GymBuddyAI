"""Database engine and session (SQLite locally, Postgres in production)."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    from sqlalchemy import inspect, text
    from . import models  # noqa: F401  (registers the tables)

    Base.metadata.create_all(bind=engine)
    # Lightweight migration for existing local SQLite DBs
    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "username" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(60) DEFAULT ''"))
            if "password_hash" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(200) DEFAULT ''"))
            if "plan" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR(20) DEFAULT 'free'"))
            if "avatar_url" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"))
            if "reset_code" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN reset_code VARCHAR(12) DEFAULT ''"))
            if "reset_expires" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN reset_expires VARCHAR(40) DEFAULT ''"))
            if "is_verified" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0"))


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
