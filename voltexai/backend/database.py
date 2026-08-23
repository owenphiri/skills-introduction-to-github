"""
VoltexAI - Database session
SQLAlchemy engine + session factory. SQLite for dev; point DATABASE_URL at a
managed Postgres (e.g. Supabase) for production.

Supabase / hosted-Postgres readiness:
  * `postgres://` URLs are normalised to `postgresql://` (SQLAlchemy 2.0 requires it).
  * TLS is required by Supabase — `sslmode=require` is added if the URL omits it.
  * Sensible pool sizing + `pool_pre_ping` so stale pooled connections are recycled
    (important behind Supabase's connection pooler / serverless backends).
Use the Supabase **Session pooler** (port 5432) or the direct connection string for
SQLAlchemy; the transaction pooler (6543) doesn't support all session features.
"""
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings


def _normalise_url(url: str) -> str:
    # Heroku/Supabase sometimes emit the legacy postgres:// scheme.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def _build_engine():
    raw = _normalise_url(settings.DATABASE_URL)
    is_sqlite = raw.startswith("sqlite")
    if is_sqlite:
        return create_engine(raw, connect_args={"check_same_thread": False},
                             pool_pre_ping=True)

    url = make_url(raw)
    connect_args = {}
    # require TLS for hosted Postgres unless the caller already specified sslmode
    if url.drivername.startswith("postgresql") and "sslmode" not in url.query:
        connect_args["sslmode"] = "require"
    return create_engine(
        raw,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_size=int(getattr(settings, "DB_POOL_SIZE", 5)),
        max_overflow=int(getattr(settings, "DB_MAX_OVERFLOW", 10)),
        pool_recycle=1800,          # recycle connections every 30 min
    )


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency for request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables at startup. In production, prefer the SQL migration in
    voltexai/supabase/schema.sql (or Alembic) over auto-create."""
    from .models import (user, subscription, conversation, payment,  # noqa: F401
                         trading, kyc, competition)
    Base.metadata.create_all(bind=engine)
