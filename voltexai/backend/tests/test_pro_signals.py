"""Voltex Signals SaaS: engine, webhook ingestion, gating, lifecycle, performance."""
from backend.services import signal_score


def test_engine_levels_and_score():
    sig = signal_score.build_signal({
        "symbol": "xauusd", "direction": "buy", "entry": 3385.5, "sl": 3378.5,
        "htf": True, "liquidity": True, "ob": True, "fvg": True, "trend": True, "momentum": True})
    assert sig["risk"] == 7.0
    assert sig["tp1"] == 3392.5 and sig["tp3"] == 3406.5 and sig["tp4"] == 3413.5
    assert sig["risk_reward"] == 4.0
    assert sig["grade"] in ("A", "A+") and sig["quality_score"] >= 80


def test_engine_rejects_wrong_side_stop():
    import pytest
    with pytest.raises(ValueError):
        signal_score.build_signal({"symbol": "EURUSD", "direction": "buy", "entry": 1.10, "sl": 1.20})


def _webhook(client, **over):
    body = {"secret": "tvsecret", "symbol": "XAUUSD", "direction": "buy", "entry": 3385.5,
            "sl": 3378.5, "signal_id": "T-" + str(over.pop("n", 1)),
            "htf": True, "liquidity": True, "ob": True, "fvg": True, "trend": True, "momentum": True}
    body.update(over)
    return client.post("/api/pro-signals/webhook", json=body)


def test_webhook_secret_and_publish(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TRADINGVIEW_WEBHOOK_SECRET", "tvsecret")
    monkeypatch.setattr(settings, "MT5_GATEWAY_KEY", "gwkey")
    # bad secret
    assert client.post("/api/pro-signals/webhook",
                       json={"secret": "x", "symbol": "EURUSD", "direction": "buy",
                             "entry": 1.1, "sl": 1.09}).status_code == 401
    r = _webhook(client, n=1)
    assert r.status_code == 200 and r.json()["published"] is True
    assert r.json()["grade"] in ("A", "A+")

    # feed masks VIP detail for anonymous users
    feed = client.get("/api/pro-signals/feed").json()
    assert feed["is_vip"] is False
    s = next(x for x in feed["signals"] if x["symbol"] == "XAUUSD")
    assert s["locked"] is True and s["sl"] is None and s["tp3"] is None and s["tp1"] is not None

    # lifecycle via gateway key -> performance updates
    for ev in ({"event": "filled"}, {"event": "tp1"}, {"event": "closed", "result_r": 3.0}):
        assert client.post("/api/pro-signals/T-1/events", json=ev,
                           headers={"X-Gateway-Key": "gwkey"}).status_code == 200
    assert client.post("/api/pro-signals/T-1/events", json={"event": "be"}).status_code == 401

    perf = client.get("/api/pro-signals/performance").json()
    assert perf["graded"] >= 1 and perf["total_r"] >= 3.0 and perf["best_pair"] == "XAUUSD"


def test_low_score_not_published(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TRADINGVIEW_WEBHOOK_SECRET", "")
    r = client.post("/api/pro-signals/webhook",
                    json={"symbol": "GBPUSD", "direction": "sell", "entry": 1.27,
                          "sl": 1.28, "signal_id": "LOW-1"})
    assert r.status_code == 200 and r.json()["published"] is False


def test_admin_create_and_event(client, admin_user, free_user, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "MT5_GATEWAY_KEY", "")   # force JWT-only path
    # non-admin cannot create
    assert client.post("/api/pro-signals",
                       json={"symbol": "EURUSD", "direction": "buy", "entry": 1.10, "sl": 1.09},
                       headers=free_user["headers"]).status_code == 403
    # admin creates a strong signal
    r = client.post("/api/pro-signals", headers=admin_user["headers"], json={
        "symbol": "NAS100", "direction": "buy", "entry": 20000, "sl": 19950,
        "signal_id": "ADM-1", "htf": True, "liquidity": True, "ob": True,
        "fvg": True, "trend": True, "momentum": True})
    assert r.status_code == 201 and r.json()["published"] is True
    # admin fires a lifecycle event via JWT (no gateway key set)
    ev = client.post("/api/pro-signals/ADM-1/events",
                     json={"event": "closed", "result_r": 2.0}, headers=admin_user["headers"])
    assert ev.status_code == 200 and ev.json()["status"] == "closed"
    # /me now exposes role for client-side gating
    assert client.get("/api/auth/me", headers=admin_user["headers"]).json()["role"] == "admin"
    assert client.get("/api/auth/me", headers=free_user["headers"]).json()["role"] == "user"


def test_vip_user_sees_full_detail(client, paid_user, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TRADINGVIEW_WEBHOOK_SECRET", "")
    client.post("/api/pro-signals/webhook",
                json={"symbol": "US30", "direction": "buy", "entry": 40000, "sl": 39900,
                      "signal_id": "VIP-1", "htf": True, "liquidity": True, "ob": True,
                      "fvg": True, "trend": True, "momentum": True})
    feed = client.get("/api/pro-signals/feed", headers=paid_user["headers"]).json()
    assert feed["is_vip"] is True
    s = next(x for x in feed["signals"] if x["symbol"] == "US30")
    assert s["locked"] is False and s["sl"] is not None and s["tp4"] is not None
