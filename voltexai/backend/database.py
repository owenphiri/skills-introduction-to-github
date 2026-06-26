"""
VoltexAI - Database session
SQLAlchemy engine + session factory. Default = SQLite for dev,
swap DATABASE_URL to Postgres in production.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
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
    """Create tables at startup. In production use Alembic migrations instead."""
    from .models import user, subscription, conversation, payment  # noqa: F401
    Base.metadata.create_all(bind=engine)
