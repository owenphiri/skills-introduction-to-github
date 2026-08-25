"""
Voltex Signal Engine — the brain of the managed signal pipeline.
Turns a raw TradingView alert into a graded, risk-bracketed VoltexAI signal:
  * Voltex Quality Score (weighted confluence, 0-100) + grade
  * TP/SL ladder from the 1:R framework
  * Risk/reward

Deterministic and dependency-free so it is easy to test and never blocks the
sub-3s webhook ack.
"""
from __future__ import annotations

# Voltex Quality Score weights (must sum to 100).
WEIGHTS = {
    "structure": 20, "liquidity": 15, "order_block": 15, "fair_value_gap": 10,
    "trend": 10, "momentum": 10, "session": 10, "risk_reward": 5, "htf": 5,
}

# Confluence flags a TradingView alert may send (bool) -> the component they fill.
_FLAG_TO_COMPONENT = {
    "structure": "structure", "liquidity": "liquidity", "ob": "order_block",
    "order_block": "order_block", "fvg": "fair_value_gap", "fair_value_gap": "fair_value_gap",
    "trend": "trend", "momentum": "momentum", "session": "session", "htf": "htf",
}


def grade(score: float) -> str:
    if score >= 90:
        return "A+"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    return "No trade"


def grade_emoji(g: str) -> str:
    return {"A+": "🔥", "A": "🟢", "B": "🟡"}.get(g, "❌")


def compute_levels(entry: float, sl: float, direction: str, targets: int = 4) -> dict:
    """TP ladder at 1..N R plus risk & realised-at-target R multiples."""
    direction = direction.lower()
    risk = round(abs(entry - sl), 8)
    sign = 1 if direction == "buy" else -1
    tps = [round(entry + sign * risk * r, 8) for r in range(1, targets + 1)]
    rr = round(abs(tps[-1] - entry) / risk, 2) if risk else 0.0
    return {"risk": risk, "tps": tps, "risk_reward": rr}


def quality_score(payload: dict, levels: dict) -> tuple[float, dict]:
    """
    Score a setup 0-100. Prefer explicit component scores in payload["components"]
    (each 0-1); else derive from boolean confluence flags; the risk_reward
    component is scored from the computed ladder (>=3R = full marks).
    """
    comps = {}
    explicit = payload.get("components") or {}
    for name, weight in WEIGHTS.items():
        if name == "risk_reward":
            rr = levels.get("risk_reward", 0)
            comps[name] = max(0.0, min(1.0, rr / 3.0))
            continue
        if name in explicit:
            comps[name] = max(0.0, min(1.0, float(explicit[name])))
        else:
            # derive from a matching boolean flag, default 0.5 (neutral/unknown)
            flag = next((v for k, v in payload.items()
                         if _FLAG_TO_COMPONENT.get(k) == name), None)
            comps[name] = 1.0 if flag is True else (0.0 if flag is False else 0.5)
    score = round(sum(comps[n] * WEIGHTS[n] for n in WEIGHTS), 1)
    breakdown = {n: round(comps[n] * WEIGHTS[n], 1) for n in WEIGHTS}
    return score, breakdown


def build_signal(payload: dict) -> dict:
    """Validate + enrich a raw alert into a full signal dict (no persistence)."""
    symbol = str(payload.get("symbol", "")).upper().strip()
    direction = str(payload.get("direction", "")).lower().strip()
    if not symbol or direction not in ("buy", "sell"):
        raise ValueError("symbol and direction (buy/sell) are required")
    try:
        entry = float(payload["entry"])
        sl = float(payload["sl"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("numeric entry and sl are required")
    if entry == sl:
        raise ValueError("entry and sl must differ")
    # stop must be on the correct side
    if (direction == "buy" and sl >= entry) or (direction == "sell" and sl <= entry):
        raise ValueError(f"stop loss is on the wrong side for a {direction}")

    levels = compute_levels(entry, sl, direction)
    score, breakdown = quality_score(payload, levels)
    g = grade(score)
    return {
        "symbol": symbol, "direction": direction,
        "timeframe": str(payload.get("timeframe", "")).upper() or None,
        "entry": entry, "sl": sl,
        "tp1": levels["tps"][0], "tp2": levels["tps"][1],
        "tp3": levels["tps"][2], "tp4": levels["tps"][3],
        "risk": levels["risk"], "risk_reward": levels["risk_reward"],
        "quality_score": score, "grade": g, "grade_emoji": grade_emoji(g),
        "breakdown": breakdown,
        "strategy": payload.get("strategy") or "Voltex AI",
        "session": payload.get("session"),
    }
