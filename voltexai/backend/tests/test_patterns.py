"""VoltexAI Chart Patterns — detection + trade plan geometry."""
import pytest


@pytest.mark.parametrize("symbol,tf", [("EURUSD", "M15"), ("XAUUSD", "H1"), ("BTCUSD", "M30")])
def test_patterns_plan(client, symbol, tf):
    d = client.get(f"/api/patterns?symbol={symbol}&timeframe={tf}").json()
    assert d["symbol"] == symbol and d["timeframe"] == tf
    assert len(d["candles"]) >= 60
    p, pl = d["pattern"], d["plan"]
    assert p["name"] and p["type"] in ("bullish", "bearish") and 0 < p["confidence"] <= 100
    assert pl["direction"] in ("buy", "sell")
    # stop is on the correct side; RR positive; BE == entry
    if pl["direction"] == "buy":
        assert pl["sl"] < pl["entry"] < pl["tp1"] <= pl["tp3"]
    else:
        assert pl["sl"] > pl["entry"] > pl["tp1"] >= pl["tp3"]
    assert pl["rr"] > 0 and pl["be"] == pl["entry"]
    kinds = {l["kind"] for l in d["lines"]}
    assert {"entry", "sl", "be", "tp"} <= kinds


def test_patterns_validation(client):
    assert client.get("/api/patterns?symbol=NOPE").status_code == 404
    assert client.get("/api/patterns?symbol=EURUSD&timeframe=M1").status_code == 422
