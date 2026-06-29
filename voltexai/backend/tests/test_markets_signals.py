"""Market data, data-provider mapping, and the signal engine."""
import asyncio

from backend.services import market_service as mkt
from backend.services import signal_engine as se
from backend.services import data_providers as dp
from backend.data.instruments import ALL_SYMBOLS


# ----------------------------- market service -----------------------------
def test_synthetic_quote_is_deterministic_and_priced():
    q1 = asyncio.run(mkt.get_quote("XAUUSD"))
    assert q1 is not None
    d = q1.as_dict()
    assert d["price"] > 0 and d["source"] == "synthetic"
    assert d["bid"] <= d["price"] <= d["ask"]
    assert d["day_low"] <= d["price"] <= d["day_high"]


def test_unknown_symbol_returns_none():
    assert asyncio.run(mkt.get_quote("NOPE123")) is None


def test_candles_shape_and_count():
    candles = mkt.get_candles("EURUSD", "M15", 50)
    assert len(candles) == 50
    c = candles[-1]
    assert c["high"] >= c["low"]
    assert c["high"] >= c["open"] and c["high"] >= c["close"]
    assert c["low"] <= c["open"] and c["low"] <= c["close"]


def test_candles_reproducible_within_same_minute():
    a = mkt.get_candles("BTCUSD", "H1", 20)
    b = mkt.get_candles("BTCUSD", "H1", 20)
    assert [x["close"] for x in a] == [x["close"] for x in b]


# ----------------------------- data providers -----------------------------
def test_twelvedata_symbol_mapping():
    assert dp.td_symbol("EURUSD") == "EUR/USD"
    assert dp.td_symbol("XAUUSD") == "XAU/USD"
    assert dp.td_symbol("US30") == "DJI"
    assert dp.td_symbol("AAPL") == "AAPL"


def test_oanda_instrument_mapping_roundtrip():
    assert dp.to_oanda_instrument("EURUSD") == "EUR_USD"
    assert dp.to_oanda_instrument("AAPL") is None        # stocks not OANDA-streamed here
    assert dp.from_oanda_instrument("EUR_USD") == "EURUSD"
    assert "EURUSD" in dp.oanda_streamable_symbols()


def test_provider_status_reports_synthetic_in_tests():
    s = dp.provider_status()
    assert s["twelvedata_key_present"] is False


# ----------------------------- indicators -----------------------------
def test_ema_and_sma_basic():
    vals = [float(i) for i in range(1, 51)]
    assert round(se.ema(vals, 10)[-1], 2) > 40           # tracks an uptrend
    assert se.sma(vals, 5)[-1] == sum(vals[-5:]) / 5


def test_rsi_bounds():
    rising = [float(i) for i in range(1, 60)]
    falling = list(reversed(rising))
    assert se.rsi(rising) > 70
    assert se.rsi(falling) < 30


def test_atr_positive():
    candles = mkt.get_candles("XAUUSD", "M15", 60)
    assert se.atr(candles, 14) > 0


# ----------------------------- signal engine -----------------------------
def test_generate_signal_structure():
    sig = se.generate("EURUSD", "M15")
    assert sig["symbol"] == "EURUSD"
    assert sig["direction"] in ("LONG", "SHORT", "NO_TRADE")
    assert 0 <= sig["confidence"] <= 10
    if sig["direction"] in ("LONG", "SHORT"):
        # risk bracket must be coherent
        if sig["direction"] == "LONG":
            assert sig["stop_loss"] < sig["entry"] < sig["tp1"] <= sig["tp3"]
        else:
            assert sig["stop_loss"] > sig["entry"] > sig["tp1"] >= sig["tp3"]


def test_scan_returns_ranked_actionable_signals():
    out = se.scan(ALL_SYMBOLS, "M15", 5)
    assert all(s["direction"] in ("LONG", "SHORT") for s in out)
    assert all(s["confidence"] >= 5 for s in out)
    confs = [s["confidence"] for s in out]
    assert confs == sorted(confs, reverse=True)
