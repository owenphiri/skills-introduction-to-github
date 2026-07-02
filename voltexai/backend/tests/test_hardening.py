"""Production hardening: health/readiness, security headers, throttle, config."""
import pytest
from fastapi import HTTPException

from backend.config import Settings
from backend.middleware import rate_limit


class _FakeClient:
    host = "1.2.3.4"


class _FakeRequest:
    client = _FakeClient()


def test_readiness_probe_ok(client):
    r = client.get("/health/ready")
    assert r.status_code == 200
    assert r.json()["status"] == "ready"
    assert r.json()["checks"]["database"] == "ok"


def test_health_reports_version(client):
    body = client.get("/health").json()
    assert body["status"] == "healthy" and "version" in body


def test_security_and_context_headers(client):
    r = client.get("/api/markets/instruments")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "x-request-id" in r.headers
    assert "x-response-time-ms" in r.headers


def test_throttle_blocks_after_limit(monkeypatch):
    # enable the throttle just for this test and start from a clean window
    monkeypatch.setattr(rate_limit.settings, "AUTH_THROTTLE_ENABLED", True)
    rate_limit._ATTEMPTS.clear()
    req = _FakeRequest()
    for _ in range(5):
        rate_limit.throttle(req, "unit-test", limit=5, window_s=60)  # ok
    with pytest.raises(HTTPException) as ei:
        rate_limit.throttle(req, "unit-test", limit=5, window_s=60)  # 6th -> blocked
    assert ei.value.status_code == 429


def test_throttle_disabled_is_noop(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "AUTH_THROTTLE_ENABLED", False)
    rate_limit._ATTEMPTS.clear()
    req = _FakeRequest()
    for _ in range(50):
        rate_limit.throttle(req, "noop", limit=1, window_s=60)  # never raises


def test_config_cors_merges_env():
    s = Settings(EXTRA_CORS_ORIGINS="https://voltexai.vercel.app, https://x.com")
    origins = s.cors_origins()
    assert "https://voltexai.vercel.app" in origins
    assert "https://x.com" in origins
    # no duplicates
    assert len(origins) == len(set(origins))


def test_config_validation_flags_prod_misconfig():
    s = Settings(ENVIRONMENT="production", JWT_SECRET="change-me-short",
                 DATABASE_URL="sqlite:///./x.db", ANTHROPIC_API_KEY="")
    warnings = s.validate_runtime()
    assert any("JWT_SECRET" in w for w in warnings)
    assert any("SQLite" in w for w in warnings)
    # dev env produces no warnings
    assert Settings(ENVIRONMENT="development").validate_runtime() == []
