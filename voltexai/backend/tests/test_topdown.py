"""Top-down multi-timeframe analysis (HTF bias -> LTF entry)."""


def test_topdown_day_mode(client):
    d = client.get("/api/signals/topdown/EURUSD?mode=day").json()
    assert d["symbol"] == "EURUSD" and d["mode"] == "day"
    assert d["bias"]["timeframe"] == "D1"
    assert d["entry"]["timeframe"] == "H1"
    assert d["verdict"] in {"TRADE", "WAIT"}
    assert d["headline"]
    # aligned setups get a real grade; non-aligned show a dash
    if d["aligned"]:
        assert d["grade"] in {"A+", "A", "B", "C"}
    else:
        assert d["grade"] == "—"


def test_topdown_intraday_mode(client):
    d = client.get("/api/signals/topdown/XAUUSD?mode=intraday").json()
    assert d["bias"]["timeframe"] == "H4" and d["entry"]["timeframe"] == "M15"
    assert "rl_note" in d


def test_topdown_unknown_symbol_404(client):
    assert client.get("/api/signals/topdown/NOTREAL?mode=day").status_code == 404


def test_topdown_bad_mode_422(client):
    assert client.get("/api/signals/topdown/EURUSD?mode=weekly").status_code == 422
