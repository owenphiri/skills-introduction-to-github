"""Wide-scope scanner + risk-gated auto-trader tests."""
from backend.data import instruments
from backend.services import signal_engine, auto_trader, deriv_exec


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
# ----------------------------- live Deriv execution -----------------------------
def _live_env(monkeypatch, tmp_path):
    monkeypatch.setattr(auto_trader, "BOOK_PATH", str(tmp_path / "book.json"))
    monkeypatch.setattr(signal_engine, "quality_scan", _fake_quality)
    monkeypatch.setenv("AUTOTRADE_ENABLED", "true")
    monkeypatch.setenv("AUTOTRADE_MODE", "live")
    monkeypatch.setenv("AUTOTRADE_ALLOW_LIVE", "true")
    monkeypatch.setenv("DERIV_API_TOKEN", "demo-token")
    monkeypatch.setenv("AUTOTRADE_MAX_OPEN", "5")


def test_live_mode_routes_to_deriv(monkeypatch, tmp_path):
    _live_env(monkeypatch, tmp_path)
    calls = []

    def fake_exec(sig, **k):
        calls.append(k["deriv_symbol"])
        return {"contract_id": "CID-" + sig["symbol"], "buy_price": 10.0,
                "multiplier": k["multiplier"], "longcode": "L", "is_virtual": True}

    monkeypatch.setattr(deriv_exec, "execute", fake_exec)
    res = auto_trader.run_cycle("synthetics")
    assert res["ran"] and res["mode"] == "live"
    assert len(res["executed"]) == 2
    p = res["executed"][0]
    assert p["mode"] == "live" and p["venue"] == "deriv" and p["contract_id"].startswith("CID-")
    assert calls and calls[0] in ("R_75", "R_100")     # routed by deriv_symbol


def test_live_execution_error_becomes_skip(monkeypatch, tmp_path):
    _live_env(monkeypatch, tmp_path)
    monkeypatch.setattr(deriv_exec, "execute", lambda sig, **k: {"error": "insufficient balance"})
    res = auto_trader.run_cycle("synthetics")
    assert res["executed"] == []
    assert res["skipped"] and all(s["reason"].startswith("live:") for s in res["skipped"])


def test_live_close_sells_contract(monkeypatch, tmp_path):
    _live_env(monkeypatch, tmp_path)
    monkeypatch.setattr(deriv_exec, "execute",
                        lambda sig, **k: {"contract_id": "CID1", "buy_price": 10.0,
                                          "multiplier": 100, "is_virtual": True})
    res = auto_trader.run_cycle("synthetics")
    pid = res["executed"][0]["id"]
    monkeypatch.setattr(deriv_exec, "close_contract",
                        lambda cid, **k: {"contract_id": cid, "sold_for": 13.5})
    closed = auto_trader.close_position(pid)
    assert closed["mode"] == "live" and closed["pnl"] == 3.5


def test_live_non_deriv_has_no_venue(monkeypatch, tmp_path):
    _live_env(monkeypatch, tmp_path)
    monkeypatch.setattr(signal_engine, "quality_scan",
                        lambda *a, **k: [{**_BASE, "symbol": "AAPL", "direction": "LONG",
                                          "asset_class": "stocks"}])
    monkeypatch.setattr(deriv_exec, "execute", lambda sig, **k: {"contract_id": "x"})
    res = auto_trader.run_cycle("stocks")
    assert res["executed"] == []
    assert any("no live venue" in s["reason"] for s in res["skipped"])


class _FakeClient:
    virtual = True

    def __init__(self, *a, **k):
        pass

    async def authorize(self):
        return {"is_virtual": 1 if _FakeClient.virtual else 0,
                "currency": "USD", "loginid": "VRTC1" if _FakeClient.virtual else "CR1"}

    async def buy_multiplier(self, deriv_symbol, direction, stake, multiplier, currency, **k):
        return {"contract_id": "C", "buy_price": stake, "longcode": "", "multiplier": multiplier}

    async def close(self):
        pass


def test_deriv_demo_gate_blocks_real_account(monkeypatch):
    _FakeClient.virtual = False
    monkeypatch.setattr(deriv_exec, "DerivExecClient", _FakeClient)
    out = deriv_exec.execute({"direction": "LONG"}, deriv_symbol="R_75", stake=10,
                             multiplier=100, allow_real=False, token="t")
    assert "real Deriv account blocked" in out["error"]


def test_deriv_allows_virtual_account(monkeypatch):
    _FakeClient.virtual = True
    monkeypatch.setattr(deriv_exec, "DerivExecClient", _FakeClient)
    out = deriv_exec.execute({"direction": "LONG"}, deriv_symbol="R_75", stake=10,
                             multiplier=100, allow_real=False, token="t")
    assert out.get("contract_id") == "C" and out["is_virtual"] is True


# ----------------------------- API surface -----------------------------
def test_autotrade_status_and_quality_endpoints(client):
    st = client.get("/api/autotrade/status").json()
    assert st["config"]["mode"] == "paper" and "positions" in st
    q = client.get("/api/signals/quality?asset_class=synthetics&min_grade=B&min_rr=0")
    assert q.status_code == 200 and "signals" in q.json()
    # run requires auth
    assert client.post("/api/autotrade/run").status_code in (401, 403)
