"""Engine + session factory for the analytics pipeline.

Replaces the archived ``prisma-client-py`` with SQLAlchemy 2.x (sync Core + ORM)
on top of ``psycopg3``. Scripts import ``SessionLocal`` and bracket their work in
a ``with SessionLocal() as session: ...`` block, mirroring the Prisma
``connect() / disconnect()`` pattern but with automatic cleanup on errors.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. The analytics scripts require a Postgres "
            "connection string — run via Infisical or export it explicitly."
        )
    # SQLAlchemy's Postgres dialect expects ``postgresql+psycopg://`` for psycopg3.
    # Accept the plain ``postgres://`` / ``postgresql://`` forms used by the rest
    # of the KlickerUZH stack and rewrite them so we don't need a duplicate env var.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


engine: Engine = create_engine(_database_url(), future=True)
SessionLocal: sessionmaker[Session] = sessionmaker(
    bind=engine, autoflush=False, expire_on_commit=False
)
