"""
VoltexAI Top-Down Analysis — multi-timeframe day-trading strategy.

The discipline is simple: read bias on the higher timeframe, take the entry on the
lower timeframe, and only trade when the two AGREE. Two standard pairings:

  day       — D1 bias  → 1H entry
  intraday  — 4H bias  → 15M entry

Each candidate is graded; aligned setups feed the RL layer, which scrutinises real
closed outcomes and re-weights what actually works over time. Simplicity is the
point — one clear verdict: TRADE (aligned) or WAIT (no agreement).
"""
from __future__ import annotations

from . import signal_engine

MODES = {
    "day": {"htf": "D1", "ltf": "H1", "label": "Day trading · D1 bias → 1H entry"},
    "intraday": {"htf": "H4", "ltf": "M15", "label": "Intraday · 4H bias → 15M entry"},
}

_DIR_WORD = {"LONG": "bullish", "SHORT": "bearish", "NO_TRADE": "neutral"}


def analyze(symbol: str, mode: str = "day") -> dict:
    symbol = symbol.upper()
    cfg = MODES.get(mode, MODES["day"])
    htf = signal_engine.generate(symbol, cfg["htf"])
    ltf = signal_engine.generate(symbol, cfg["ltf"])
    if htf.get("error") or ltf.get("error"):
        return {"symbol": symbol, "error": htf.get("error") or ltf.get("error")}

    bias_dir = htf.get("direction", "NO_TRADE")
    entry_dir = ltf.get("direction", "NO_TRADE")
    aligned = bias_dir in ("LONG", "SHORT") and entry_dir == bias_dir

    # Combined conviction: average of the two timeframes, only meaningful when aligned.
    combined_conf = round((htf.get("confidence", 0) + ltf.get("confidence", 0)) / 2)
    grade = signal_engine._grade(combined_conf) if aligned else "—"

    if aligned:
        verdict = "TRADE"
        headline = (f"{cfg['htf']} bias {_DIR_WORD[bias_dir]} · {cfg['ltf']} entry "
                    f"{entry_dir} — aligned. Grade {grade}. Take the {entry_dir.lower()}.")
    elif bias_dir == "NO_TRADE":
        verdict = "WAIT"
        headline = f"{cfg['htf']} has no clear bias yet — stand aside until it picks a side."
    elif entry_dir == "NO_TRADE":
        verdict = "WAIT"
        headline = (f"{cfg['htf']} bias {_DIR_WORD[bias_dir]}, but {cfg['ltf']} shows no clean "
                    f"entry. Wait for a {bias_dir.lower()} trigger.")
    else:
        verdict = "WAIT"
        headline = (f"Conflict: {cfg['htf']} {_DIR_WORD[bias_dir]} vs {cfg['ltf']} "
                    f"{_DIR_WORD[entry_dir]}. Don't fight the higher timeframe — wait.")

    return {
        "symbol": symbol, "mode": mode, "label": cfg["label"],
        "verdict": verdict, "aligned": aligned, "grade": grade,
        "combined_confidence": combined_conf, "headline": headline,
        "bias": {
            "timeframe": cfg["htf"], "direction": bias_dir,
            "confidence": htf.get("confidence"), "grade": htf.get("grade"),
        },
        "entry": {
            "timeframe": cfg["ltf"], "direction": entry_dir,
            "confidence": ltf.get("confidence"), "grade": ltf.get("grade"),
            "price": ltf.get("price"), "entry": ltf.get("entry"),
            "stop_loss": ltf.get("stop_loss"),
            "tp1": ltf.get("tp1"), "tp2": ltf.get("tp2"), "tp3": ltf.get("tp3"),
            "risk_reward_tp1": ltf.get("risk_reward_tp1"),
            "confluence_factors": ltf.get("confluence_factors", []),
        },
        "session_context": ltf.get("session_context"),
        "rl_note": ("Aligned setups are scored and fed to the reinforcement-learning "
                    "layer, which re-weights confluence from real closed outcomes — so "
                    "the framework self-optimises toward the setups that actually pay."),
    }
