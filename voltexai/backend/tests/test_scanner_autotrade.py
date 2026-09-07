"""Wide-scope scanner + risk-gated auto-trader tests."""
from backend.data import instruments
from backend.services import signal_engine, auto_trader


# ----------------------------- instrument universe -----------------------------
def test_universe_has_synthetics_and_futures():
    assert "synthetics" in instruments.ASSET_CLASSES
    assert "futures" in instruments.ASSET_CLASSES
    v75 = instruments.get_instrument("V75")
    assert v75 and v75["always_on"] is True and v75["deriv_symbol"] == "R_75"
    assert v75["venue"] == "deriv"
    syn = {i["symbol"] for i in instruments.list_by_class("synthetics")}
    assert {"V75", "V100", "BOOM1000", "CRASH1000", "STEPIDX"} <= syn
    fut = {i["symbol"] for i in instruments.list_by_class("futures")}
    assert {"ES", "NQ", "GC", "CL"} <= fut


# ----------------------------- quality scan -----------------------------
def test_quality_scan_only_returns_clean_confirmed_trades():
    sigs = signal_engine.quality_scan(instruments.ALL_SYMBOLS, "M15", "H1",
                                      min_grade="A", min_rr=1.8)
    for s in sigs:
        assert s["grade"] in ("A", "A+")
        assert s["risk_reward_tp3"] >= 1.8
        assert s["direction"] in ("LONG", "SHORT")
        assert s["quality_trade"] is True
        assert "entry" in s and "stop_loss" in s and "tp3" in s
        # HTF may be neutral, but must never oppose the entry
        if s["htf_bias"] in ("LONG", "SHORT"):
            assert s["htf_bias"] == s["direction"]
        assert "exec_priority" in s


# ----------------------------- auto-trader risk layer -----------------------------
_BASE = {"grade": "A", "risk_reward_tp3": 2.5, "quality": 80,
         "asset_class": "synthetics", "price": 100.0, "entry": 100.0,
         "stop_loss": 98.0, "tp1": 102.0, "tp2": 104.0, "tp3": 106.0}


def _fake_quality(*a, **k):
    return [
        {**_BASE, "symbol": "V75", "direction": "LONG"},
        {**_BASE, "symbol": "V100", "direction": "SHORT",
         "entry": 50.0, "stop_loss": 51.0, "tp3": 47.0},
    ]


def _paper(monkeypatch, tmp_path, **env):
    monkeypatch.setattr(auto_trader, "BOOK_PATH", str(tmp_path / "book.json"))
    monkeypatch.setattr(signal_engine, "quality_scan", _fake_quality)
    monkeypatch.setenv("AUTOTRADE_ENABLED", env.get("enabled", "true"))
    for k, v in env.items():
        if k != "enabled":
            monkeypatch.setenv(k, v)


def test_disabled_by_default(monkeypatch, tmp_path):
    monkeypatch.setattr(auto_trader, "BOOK_PATH", str(tmp_path / "b.json"))
    monkeypatch.delenv("AUTOTRADE_ENABLED", raising=False)
    res = auto_trader.run_cycle()
    assert res["ran"] is False and res["mode"] == "paper"


def test_paper_execution_respects_max_open(monkeypatch, tmp_path):
    _paper(monkeypatch, tmp_path, AUTOTRADE_MAX_OPEN="1")
    res = auto_trader.run_cycle("synthetics")
    assert res["ran"] is True and res["mode"] == "paper"
    assert len(res["executed"]) == 1
    assert any(s["reason"].startswith("max_open") for s in res["skipped"])
    assert auto_trader.status()["open_positions"] == 1


def test_no_duplicate_symbol(monkeypatch, tmp_path):
    _paper(monkeypatch, tmp_path, AUTOTRADE_MAX_OPEN="5")
    auto_trader.run_cycle("synthetics")            # opens V75 + V100
    res2 = auto_trader.run_cycle("synthetics")     # both already open
    assert res2["executed"] == []
    assert all("already open" in s["reason"] for s in res2["skipped"])


def test_kill_switch_blocks(monkeypatch, tmp_path):
    _paper(monkeypatch, tmp_path, AUTOTRADE_KILL_SWITCH="true")
    res = auto_trader.run_cycle("synthetics")
    assert res["ran"] is False and "kill" in res["reason"].lower()
    assert auto_trader.status()["open_positions"] == 0


def test_position_sizing_and_close(monkeypatch, tmp_path):
    _paper(monkeypatch, tmp_path, AUTOTRADE_MAX_OPEN="5",
           AUTOTRADE_RISK_PCT="1.0", AUTOTRADE_BALANCE="10000")
    res = auto_trader.run_cycle("synthetics")
    v75 = next(p for p in res["executed"] if p["symbol"] == "V75")
    # risk 1% of 10000 = 100; stop distance 2 -> size 50
    assert v75["size"] == 50.0
    closed = auto_trader.close_position(v75["id"])
    assert "pnl" in closed and "balance" in closed


def test_live_is_gated_to_paper(monkeypatch, tmp_path):
    _paper(monkeypatch, tmp_path)
    monkeypatch.setenv("AUTOTRADE_MODE", "live")   # request live...
    monkeypatch.delenv("DERIV_API_TOKEN", raising=False)  # ...but no token / opt-in
    assert auto_trader.config()["mode"] == "paper"


# ----------------------------- API surface -----------------------------
def test_autotrade_status_and_quality_endpoints(client):
    st = client.get("/api/autotrade/status").json()
    assert st["config"]["mode"] == "paper" and "positions" in st
    q = client.get("/api/signals/quality?asset_class=synthetics&min_grade=B&min_rr=0")
    assert q.status_code == 200 and "signals" in q.json()
    # run requires auth
    assert client.post("/api/autotrade/run").status_code in (401, 403)
