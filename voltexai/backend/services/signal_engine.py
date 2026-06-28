"""
VoltexAI - Algorithmic signal engine
A deterministic, quant-style signal generator that runs on the OHLC candles from
market_service. It does NOT call the LLM, so it can scan the entire market cheaply
and continuously, and it never consumes a user's AI quota.

It blends classic momentum / trend / mean-reversion / volatility confluences into a
single confluence score (0-10), then derives entry, stop and three take-profits from
ATR and recent structure. The Claude-powered `/api/ai/signal` endpoint remains the
"narrative" signal; this engine is the "scanner" that powers the live Signals board.

Indicators implemented from first principles (no numpy dependency):
  EMA, SMA, RSI(14), MACD(12,26,9), ATR(14), Bollinger(20,2), swing structure.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from . import market_service


# ----------------------------- indicators -----------------------------
def sma(values: list[float], period: int) -> list[float]:
    out: list[float] = []
    s = 0.0
    for i, v in enumerate(values):
        s += v
        if i >= period:
            s -= values[i - period]
        out.append(s / period if i >= period - 1 else float("nan"))
    return out


def ema(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    k = 2 / (period + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def rsi(values: list[float], period: int = 14) -> float:
    if len(values) <= period:
        return 50.0
    gains = losses = 0.0
    for i in range(-period, 0):
        diff = values[i] - values[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(values: list[float], fast=12, slow=26, signal=9) -> tuple[float, float, float]:
    if len(values) < slow + signal:
        return 0.0, 0.0, 0.0
    ema_fast = ema(values, fast)
    ema_slow = ema(values, slow)
    macd_line = [f - s for f, s in zip(ema_fast, ema_slow)]
    signal_line = ema(macd_line, signal)
    hist = macd_line[-1] - signal_line[-1]
    return macd_line[-1], signal_line[-1], hist


def atr(candles: list[dict], period: int = 14) -> float:
    if len(candles) < period + 1:
        return 0.0
    trs = []
    for i in range(1, len(candles)):
        h, l, pc = candles[i]["high"], candles[i]["low"], candles[i - 1]["close"]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    recent = trs[-period:]
    return sum(recent) / len(recent)


def bollinger(values: list[float], period: int = 20, mult: float = 2.0):
    if len(values) < period:
        m = sum(values) / len(values)
        return m, m, m
    window = values[-period:]
    mean = sum(window) / period
    var = sum((v - mean) ** 2 for v in window) / period
    sd = var ** 0.5
    return mean + mult * sd, mean, mean - mult * sd


def swing_levels(candles: list[dict], lookback: int = 40):
    """Nearest recent swing high (resistance) and swing low (support)."""
    window = candles[-lookback:] if len(candles) >= lookback else candles
    highs = [c["high"] for c in window]
    lows = [c["low"] for c in window]
    return max(highs), min(lows)


# ----------------------------- the engine -----------------------------
def _score_to_confidence(score: float) -> int:
    return max(0, min(10, round(score)))


def generate(symbol: str, timeframe: str = "M15") -> dict:
    symbol = symbol.upper()
    inst = market_service.get_instrument(symbol)
    if not inst:
        return {"symbol": symbol, "error": "unknown instrument"}

    candles = market_service.get_candles(symbol, timeframe, 200)
    if len(candles) < 60:
        return {"symbol": symbol, "direction": "NO_TRADE",
                "reason": "insufficient data"}

    cl = [c["close"] for c in candles]
    price = cl[-1]
    pip = inst["pip_size"]

    ema20 = ema(cl, 20)[-1]
    ema50 = ema(cl, 50)[-1]
    ema200 = ema(cl, 200)[-1] if len(cl) >= 200 else ema(cl, len(cl))[-1]
    r = rsi(cl, 14)
    macd_line, signal_line, hist = macd(cl)
    upper, mid, lower = bollinger(cl)
    a = atr(candles, 14) or (price * 0.001)
    res, sup = swing_levels(candles)

    # --- confluence scoring: positive = bullish, negative = bearish ---
    factors: list[str] = []
    score = 0.0

    if ema20 > ema50:
        score += 1.5; factors.append("EMA20>EMA50 (short-term uptrend)")
    else:
        score -= 1.5; factors.append("EMA20<EMA50 (short-term downtrend)")

    if price > ema200:
        score += 1.5; factors.append("Price above EMA200 (bullish regime)")
    else:
        score -= 1.5; factors.append("Price below EMA200 (bearish regime)")

    if macd_line > signal_line and hist > 0:
        score += 1.5; factors.append("MACD bullish crossover")
    elif macd_line < signal_line and hist < 0:
        score -= 1.5; factors.append("MACD bearish crossover")

    if r < 30:
        score += 1.2; factors.append(f"RSI oversold ({r:.0f})")
    elif r > 70:
        score -= 1.2; factors.append(f"RSI overbought ({r:.0f})")
    elif 45 <= r <= 55:
        factors.append(f"RSI neutral ({r:.0f})")

    if price <= lower:
        score += 1.0; factors.append("Tagging lower Bollinger band")
    elif price >= upper:
        score -= 1.0; factors.append("Tagging upper Bollinger band")

    # proximity to structure (buy near support / sell near resistance)
    rng = max(res - sup, pip)
    if (price - sup) / rng < 0.25:
        score += 1.0; factors.append("Near swing support")
    if (res - price) / rng < 0.25:
        score -= 1.0; factors.append("Near swing resistance")

    # momentum of last 5 candles
    mom = (cl[-1] - cl[-5]) / cl[-5] if cl[-5] else 0
    if mom > 0:
        score += 0.8
    else:
        score -= 0.8

    abs_score = abs(score)
    confidence = _score_to_confidence(abs_score)

    if abs_score < 3.0:
        return {
            "symbol": symbol, "display": inst["display"],
            "asset_class": inst["asset_class"], "timeframe": timeframe,
            "direction": "NO_TRADE",
            "confidence": confidence,
            "price": round(price, _dp(pip)),
            "reason": "Confluence below threshold - no clean edge right now.",
            "indicators": _indicator_block(r, macd_line, signal_line, hist,
                                           ema20, ema50, ema200, a),
            "generated_at": _now_iso(),
        }

    direction = "LONG" if score > 0 else "SHORT"
    # ATR-based bracket; R multiples 1 / 2 / 3
    sl_dist = a * 1.5
    if direction == "LONG":
        entry = price
        stop = min(price - sl_dist, sup - pip * 2)
        risk = entry - stop
        tp1, tp2, tp3 = entry + risk, entry + 2 * risk, entry + 3 * risk
    else:
        entry = price
        stop = max(price + sl_dist, res + pip * 2)
        risk = stop - entry
        tp1, tp2, tp3 = entry - risk, entry - 2 * risk, entry - 3 * risk

    rr1 = round(abs(tp1 - entry) / risk, 2) if risk else 0
    return {
        "symbol": symbol, "display": inst["display"],
        "asset_class": inst["asset_class"], "timeframe": timeframe,
        "direction": direction,
        "confidence": confidence,
        "price": round(price, _dp(pip)),
        "entry": round(entry, _dp(pip)),
        "stop_loss": round(stop, _dp(pip)),
        "tp1": round(tp1, _dp(pip)),
        "tp2": round(tp2, _dp(pip)),
        "tp3": round(tp3, _dp(pip)),
        "risk_reward_tp1": rr1,
        "risk_reward_tp3": round(abs(tp3 - entry) / risk, 2) if risk else 0,
        "confluence_factors": factors,
        "session": _session_name(),
        "valid_until": _valid_until(timeframe),
        "indicators": _indicator_block(r, macd_line, signal_line, hist,
                                       ema20, ema50, ema200, a),
        "generated_at": _now_iso(),
    }


def scan(symbols: list[str], timeframe: str = "M15",
         min_confidence: int = 5) -> list[dict]:
    """Run the engine across many symbols, return only actionable signals, ranked."""
    out = []
    for s in symbols:
        sig = generate(s, timeframe)
        if sig.get("direction") in ("LONG", "SHORT") and \
                sig.get("confidence", 0) >= min_confidence:
            out.append(sig)
    out.sort(key=lambda x: x["confidence"], reverse=True)
    return out


# ----------------------------- helpers -----------------------------
def _dp(pip: float) -> int:
    if pip >= 1:
        return 2
    return max(2, len(str(pip).split(".")[-1]) + 1)


def _indicator_block(r, macd_line, signal_line, hist, e20, e50, e200, a) -> dict:
    return {
        "rsi14": round(r, 1),
        "macd": round(macd_line, 5),
        "macd_signal": round(signal_line, 5),
        "macd_hist": round(hist, 5),
        "ema20": round(e20, 5),
        "ema50": round(e50, 5),
        "ema200": round(e200, 5),
        "atr14": round(a, 5),
    }


def _session_name() -> str:
    hour = datetime.now(timezone.utc).hour
    if 0 <= hour < 7:
        return "Asia"
    if 7 <= hour < 12:
        return "London"
    if 12 <= hour < 16:
        return "London/NY overlap"
    if 16 <= hour < 21:
        return "New York"
    return "After-hours"


def _valid_until(timeframe: str) -> str:
    secs = market_service.TIMEFRAMES.get(timeframe.upper(), 900)
    return (datetime.now(timezone.utc) + timedelta(seconds=secs * 4)).isoformat()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
