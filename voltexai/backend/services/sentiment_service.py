"""
Voltex Sentiment — market mood, computed from the algorithmic engine.
Aggregates directional bias + momentum across the instrument universe into a
Fear & Greed gauge (0-100), a bullish/bearish split, and a per-asset-class
breakdown. Deterministic and cheap (runs on the model/live feed, no LLM).
"""
from __future__ import annotations

from datetime import datetime, timezone

from . import signal_engine, market_service as mkt
from ..data.instruments import ALL_SYMBOLS, list_by_class, ASSET_CLASSES


def _label(score: int) -> str:
    if score >= 75:
        return "Extreme Greed"
    if score >= 60:
        return "Greed"
    if score >= 45:
        return "Neutral"
    if score >= 25:
        return "Fear"
    return "Extreme Fear"


def _instrument_bias(symbol: str) -> tuple[float, float]:
    """Return (signed_bias, momentum_pct) for one symbol from M15+H1 signals."""
    bias = 0.0
    for tf in ("M15", "H1"):
        sig = signal_engine.generate(symbol, tf)
        if sig.get("direction") == "LONG":
            bias += sig.get("confidence", 0)
        elif sig.get("direction") == "SHORT":
            bias -= sig.get("confidence", 0)
    closes = mkt.closes(symbol, "H1", 12)
    mom = ((closes[-1] - closes[0]) / closes[0] * 100) if closes and closes[0] else 0.0
    return bias, mom


def overview() -> dict:
    per_symbol = []
    bull = bear = 0
    total_bias = 0.0
    for s in ALL_SYMBOLS:
        bias, mom = _instrument_bias(s)
        total_bias += bias
        if bias > 0:
            bull += 1
        elif bias < 0:
            bear += 1
        per_symbol.append({"symbol": s, "bias": round(bias, 1),
                           "momentum_pct": round(mom, 2),
                           "mood": "bullish" if bias > 0 else "bearish" if bias < 0 else "neutral"})

    n = len(ALL_SYMBOLS)
    # Fear & Greed: map net bias to 0-100 (0 = max fear/bearish, 100 = max greed)
    avg_bias = total_bias / max(n, 1)
    fg = int(max(0, min(100, round(50 + avg_bias * 5))))

    # per asset class
    classes = []
    for ac in ASSET_CLASSES:
        syms = [i["symbol"] for i in list_by_class(ac)]
        rows = [r for r in per_symbol if r["symbol"] in syms]
        b = sum(1 for r in rows if r["mood"] == "bullish")
        classes.append({"asset_class": ac, "bullish": b, "total": len(rows),
                        "bullish_pct": round(b / max(len(rows), 1) * 100)})

    per_symbol.sort(key=lambda r: r["bias"], reverse=True)
    return {
        "fear_greed": fg,
        "label": _label(fg),
        "bullish": bull, "bearish": bear, "neutral": n - bull - bear,
        "bullish_pct": round(bull / max(n, 1) * 100),
        "by_class": classes,
        "top_bullish": per_symbol[:5],
        "top_bearish": list(reversed(per_symbol[-5:])),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
