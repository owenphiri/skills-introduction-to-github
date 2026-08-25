"""Voltex RL scoring layer: scores signals, learns from outcomes, exposes model."""


def _strong(client, n):
    return client.post("/api/pro-signals/webhook", json={
        "symbol": "XAUUSD", "direction": "buy", "entry": 3400, "sl": 3390,
        "signal_id": f"RL{n}", "htf": True, "liquidity": True, "ob": True,
        "fvg": True, "trend": True, "momentum": True}).json()


def test_rl_scores_on_ingest(client, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TRADINGVIEW_WEBHOOK_SECRET", "")
    r = _strong(client, 1)
    assert r["published"] is True
    assert "rl_score" in r and "combined_score" in r
    m = client.get("/api/pro-signals/rl/model").json()
    assert set(x["feature"] for x in m["importance"]) >= {"liquidity", "trend", "momentum"}


def test_rl_learns_from_outcomes(client, admin_user, monkeypatch):
    from backend.config import settings
    monkeypatch.setattr(settings, "TRADINGVIEW_WEBHOOK_SECRET", "")
    monkeypatch.setattr(settings, "MT5_GATEWAY_KEY", "")   # force admin-JWT event path
    before = client.get("/api/pro-signals/rl/model").json()["updates"]
    for i in range(2, 8):
        _strong(client, i)
        client.post(f"/api/pro-signals/RL{i}/events",
                    json={"event": "closed", "result_r": 3.0},
                    headers=admin_user["headers"])
    m = client.get("/api/pro-signals/rl/model").json()
    assert m["updates"] == before + 6          # one SGD step per closed signal
    assert m["win_rate"] == 100.0
    # every winning component now has non-negative learned weight
    assert all(x["weight"] >= 0 for x in m["importance"])
    # a fresh strong signal now scores above the untrained 50 baseline on RL
    assert _strong(client, 99)["rl_score"] > 50

    # feed carries the RL scores
    s = client.get("/api/pro-signals/feed").json()["signals"][0]
    assert "rl_score" in s and "combined_score" in s
