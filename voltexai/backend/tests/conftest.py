"""
Shared pytest fixtures. Sets a hermetic environment (temp SQLite DB, synthetic
market feed, console email, paper broker) BEFORE any backend module is imported,
so tests are deterministic and never touch the network.
"""
import os
import tempfile
import uuid

import pytest

# --- hermetic env: must be set before importing backend.* ---
_TMP_DB = os.path.join(tempfile.gettempdir(), f"voltexai_test_{uuid.uuid4().hex}.db")
os.environ.update(
    DATABASE_URL=f"sqlite:///{_TMP_DB}",
    MARKET_DATA_PROVIDER="synthetic",   # deterministic, offline
    BROKER="paper",
    EMAIL_PROVIDER="console",
    JWT_SECRET="test-secret-key-at-least-32-characters-long",
    ENVIRONMENT="test",
)

from fastapi.testclient import TestClient  # noqa: E402
from backend.main import app  # noqa: E402
from backend.database import SessionLocal  # noqa: E402
from backend.models import User, UserRole, PlanTier, SubStatus, Provider, Subscription  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:        # context manager runs lifespan -> init_db()
        yield c
    try:
        os.remove(_TMP_DB)
    except OSError:
        pass


def _register(client, plan: PlanTier | None = None, admin: bool = False):
    email = f"u_{uuid.uuid4().hex[:10]}@test.io"
    r = client.post("/api/auth/register",
                    json={"email": email, "password": "password123",
                          "full_name": "Test Trader", "country": "Zambia"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        uid = user.id
        if admin:
            user.role = UserRole.ADMIN
        if plan:
            sub = db.query(Subscription).filter(Subscription.user_id == uid).first()
            sub.plan = plan
            sub.status = SubStatus.ACTIVE
            sub.provider = Provider.NONE
        db.commit()
    finally:
        db.close()
    return {"email": email, "user_id": uid, "token": token,
            "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def free_user(client):
    return _register(client)


@pytest.fixture
def paid_user(client):
    return _register(client, plan=PlanTier.TRADER)


@pytest.fixture
def admin_user(client):
    return _register(client, plan=PlanTier.ELITE, admin=True)
