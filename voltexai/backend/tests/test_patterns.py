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


def _ramp(a, b, steps):
    return [a + (b - a) * k / steps for k in range(1, steps + 1)]


def _mk(seq):
    return [{"time": i, "open": c, "high": c + 0.15, "low": c - 0.15, "close": c, "volume": 1}
            for i, c in enumerate(seq)]


def test_detect_bull_flag():
    from backend.services import chart_patterns as cp
    base = [100 + (0.1 if j % 2 else -0.1) for j in range(14)]
    pole = [100 + (j + 1) * 1.4 for j in range(18)]
    flag = [pole[-1] - j * 0.15 for j in range(12)]
    d = cp.detect(_mk(base + pole + flag), dp=2)
    assert d["pattern"]["name"] == "Bull Flag" and d["plan"]["direction"] == "buy"
    assert d["plan"]["sl"] < d["plan"]["entry"] < d["plan"]["tp3"]


def test_detect_falling_wedge():
    from backend.services import chart_patterns as cp
    seq = [90] + _ramp(90, 120, 5) + _ramp(120, 100, 5) + _ramp(100, 110, 5) + _ramp(110, 94, 5) + _ramp(94, 102, 4)
    d = cp.detect(_mk(seq), dp=2)
    assert d["pattern"]["name"] == "Falling Wedge" and d["plan"]["direction"] == "buy"


def test_detect_rising_wedge():
    from backend.services import chart_patterns as cp
    seq = [80] + _ramp(80, 115, 5) + _ramp(115, 100, 5) + _ramp(100, 118, 5) + _ramp(118, 106, 5) + _ramp(106, 112, 4)
    d = cp.detect(_mk(seq), dp=2)
    assert d["pattern"]["name"] == "Rising Wedge" and d["plan"]["direction"] == "sell"


def test_detect_triple_top_and_bottom():
    from backend.services import chart_patterns as cp
    tt = _mk([90] + _ramp(90, 120, 4) + _ramp(120, 100, 4) + _ramp(100, 120, 4) + _ramp(120, 100, 4) + _ramp(100, 120, 4) + _ramp(120, 104, 4))
    assert cp.detect(tt, dp=2)["pattern"]["name"] == "Triple Top"
    tb = _mk([130] + _ramp(130, 100, 4) + _ramp(100, 120, 4) + _ramp(120, 100, 4) + _ramp(100, 120, 4) + _ramp(120, 100, 4) + _ramp(100, 116, 4))
    assert cp.detect(tb, dp=2)["pattern"]["name"] == "Triple Bottom"


def test_detect_rectangle():
    from backend.services import chart_patterns as cp
    rect = _mk([110] + _ramp(110, 120, 3) + _ramp(120, 100, 3) + _ramp(100, 120, 3) + _ramp(120, 100, 3) + _ramp(100, 112, 3))
    assert cp.detect(rect, dp=2)["pattern"]["name"] == "Rectangle"


def test_detect_channel():
    from backend.services import chart_patterns as cp
    ch = _mk([80] + _ramp(80, 100, 4) + _ramp(100, 90, 4) + _ramp(90, 110, 4) + _ramp(110, 100, 4) + _ramp(100, 120, 4) + _ramp(120, 110, 4))
    assert cp.detect(ch, dp=2)["pattern"]["name"] == "Ascending Channel"


def test_detect_bull_pennant():
    from backend.services import chart_patterns as cp
    base = [100 + (0.1 if j % 2 else -0.1) for j in range(14)]
    pole = [100 + (j + 1) * 1.4 for j in range(18)]
    top = pole[-1]
    cons, amp = [], 3.0
    for j in range(10):
        cons.append(top - (amp if j % 2 else 0)); amp *= 0.8
    assert cp.detect(_mk(base + pole + cons), dp=2)["pattern"]["name"] == "Bull Pennant"


def test_confluence_endpoint(client):
    d = client.get("/api/patterns/confluence?symbol=EURUSD").json()
    assert d["symbol"] == "EURUSD"
    assert d["label"] in ("Strong Bullish", "Bullish", "Mixed", "Bearish", "Strong Bearish")
    assert d["direction"] in ("buy", "sell", "neutral")
    assert len(d["timeframes"]) >= 1 and 0 <= d["agreement"] <= 100
    assert client.get("/api/patterns/confluence?symbol=NOPE").status_code == 404
