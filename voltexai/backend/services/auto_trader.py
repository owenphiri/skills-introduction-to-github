"""
VoltexAI - Auto-Trader (scanner-anchored execution, risk-gated)

Consumes the signal engine's *quality* trades (wide-scope: CFDs, metals, futures,
crypto and Deriv synthetic indices) and executes them automatically behind a
server-side risk layer. It is SAFE BY DEFAULT:

  * mode defaults to "paper" — trades hit a simulated book, never real money;
  * live routing (e.g. Deriv) is gated behind BOTH a broker token AND an explicit
    AUTOTRADE_ALLOW_LIVE flag; without them the executor stays in paper mode;
  * a kill switch, max-open, per-trade risk %, daily-loss limit and an optional
    symbol allowlist bound every run;
  * the engine itself is disabled unless AUTOTRADE_ENABLED is set.

The risk layer here mirrors the MCP order-tools risk layer (Phase 2): the model /
scanner can never place a trade the risk layer rejected.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from . import signal_engine, market_service
from ..data import instruments


# ----------------------------- config -----------------------------
def _flag(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


def _f(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _i(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


BOOK_PATH = os.getenv("AUTOTRADE_BOOK", "voltex_autotrade_book.json").strip()


def config() -> dict:
    """Live view of the operator-set guardrails (env-driven; not model-editable)."""
    live_requested = os.getenv("AUTOTRADE_MODE", "paper").strip().lower() == "live"
    has_token = bool(os.getenv("DERIV_API_TOKEN", "").strip())
    allow_live = _flag("AUTOTRADE_ALLOW_LIVE", False)
    # live is only effective with an explicit opt-in AND a broker token
    mode = "live" if (live_requested and allow_live and has_token) else "paper"
    return {
        "enabled": _flag("AUTOTRADE_ENABLED", False),
        "mode": mode,
        "live_gated": {
            "requested": live_requested, "allow_live": allow_live,
            "broker_token_present": has_token,
            "note": ("Live execution stays OFF until a broker token is set and "
                     "AUTOTRADE_ALLOW_LIVE=true. Deriv live routing arrives after "
                     "KYC / MOU — paper is used meanwhile."),
        },
        "kill_switch": _flag("AUTOTRADE_KILL_SWITCH", False),
        "max_open": _i("AUTOTRADE_MAX_OPEN", 5),
        "risk_per_trade_pct": _f("AUTOTRADE_RISK_PCT", 1.0),
        "max_daily_loss": _f("AUTOTRADE_MAX_DAILY_LOSS", 500.0),
        "min_grade": os.getenv("AUTOTRADE_MIN_GRADE", "A").strip().upper(),
        "min_rr": _f("AUTOTRADE_MIN_RR", 1.8),
        "timeframe": os.getenv("AUTOTRADE_TF", "M15").strip().upper(),
        "htf": os.getenv("AUTOTRADE_HTF", "H1").strip().upper(),
        "symbol_allowlist": [s.strip().upper() for s in
                             os.getenv("AUTOTRADE_ALLOWLIST", "").split(",") if s.strip()],
        "starting_balance": _f("AUTOTRADE_BALANCE", 10000.0),
    }


# ----------------------------- paper book -----------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _fresh() -> dict:
    return {"balance": config()["starting_balance"], "positions": [],
            "realized_by_date": {}, "trades": [], "seq": 0}


def _load() -> dict:
    if not os.path.exists(BOOK_PATH):
        return _fresh()
    try:
        b = json.load(open(BOOK_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        return _fresh()
    for k, v in _fresh().items():
        b.setdefault(k, v)
    return b


def _save(book: dict) -> None:
    tmp = f"{BOOK_PATH}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(book, fh, indent=2)
    os.replace(tmp, BOOK_PATH)


def _price(symbol: str) -> float:
    c = market_service.closes(symbol, "M5", 3)
    return float(c[-1]) if c else 0.0


def _mult(side: str) -> int:
    return 1 if side.lower() in ("long", "buy") else -1


def _unrealized(pos: dict, price: float) -> float:
    return (price - pos["entry"]) * pos["size"] * _mult(pos["side"])


# ----------------------------- risk layer -----------------------------
def _risk_check(sig: dict, book: dict, cfg: dict) -> tuple[bool, str]:
    if cfg["kill_switch"]:
        return False, "kill switch engaged"
    open_syms = {p["symbol"] for p in book["positions"]}
    if sig["symbol"] in open_syms:
        return False, "position already open on symbol"
    if len(book["positions"]) >= cfg["max_open"]:
        return False, f"max_open {cfg['max_open']} reached"
    if cfg["symbol_allowlist"] and sig["symbol"] not in cfg["symbol_allowlist"]:
        return False, "symbol not in allowlist"
    realized = book["realized_by_date"].get(_today(), 0.0)
    if realized <= -abs(cfg["max_daily_loss"]):
        return False, "daily loss limit reached"
    if signal_engine._GRADE_RANK.get(sig.get("grade", "C"), 0) < \
            signal_engine._GRADE_RANK.get(cfg["min_grade"], 2):
        return False, "below min grade"
    if (sig.get("risk_reward_tp3") or 0) < cfg["min_rr"]:
        return False, "below min reward:risk"
    return True, "approved"


def _position_size(sig: dict, book: dict, cfg: dict) -> float:
    entry = sig.get("entry") or sig.get("price")
    stop = sig.get("stop_loss")
    if not entry or not stop or entry == stop:
        return 0.0
    risk_amount = float(book["balance"]) * cfg["risk_per_trade_pct"] / 100.0
    per_unit = abs(entry - stop)
    return round(risk_amount / per_unit, 4) if per_unit else 0.0


def _open(sig: dict, book: dict, cfg: dict) -> dict:
    book["seq"] += 1
    pid = f"AT{book['seq']}"
    inst = instruments.get_instrument(sig["symbol"]) or {}
    size = _position_size(sig, book, cfg)
    pos = {
        "id": pid, "symbol": sig["symbol"], "side": sig["direction"],
        "size": size, "entry": sig.get("entry") or sig.get("price"),
        "stop": sig.get("stop_loss"), "tp1": sig.get("tp1"),
        "tp2": sig.get("tp2"), "tp3": sig.get("tp3"),
        "grade": sig.get("grade"), "quality": sig.get("quality"),
        "asset_class": sig.get("asset_class"),
        "venue": inst.get("venue"), "deriv_symbol": inst.get("deriv_symbol"),
        "mode": cfg["mode"], "opened_at": _now(),
    }
    book["positions"].append(pos)
    return pos


# ----------------------------- public API -----------------------------
def run_cycle(asset_class: str = "all", timeframe: str | None = None,
              htf: str | None = None) -> dict:
    """Scan the (wide) universe for quality trades and auto-execute the approved
    ones under the risk layer. Returns what was executed and what was skipped."""
    cfg = config()
    tf = (timeframe or cfg["timeframe"]).upper()
    htf = (htf or cfg["htf"]).upper()
    if not cfg["enabled"]:
        return {"ran": False, "reason": "auto-trader disabled (set AUTOTRADE_ENABLED=true)",
                "mode": cfg["mode"], "executed": [], "skipped": [], "config": cfg}
    if cfg["kill_switch"]:
        return {"ran": False, "reason": "kill switch engaged", "mode": cfg["mode"],
                "executed": [], "skipped": [], "config": cfg}

    syms = [i["symbol"] for i in instruments.list_by_class(asset_class)]
    quality = signal_engine.quality_scan(syms, tf, htf, cfg["min_grade"], cfg["min_rr"])

    book = _load()
    executed, skipped = [], []
    for sig in quality:
        ok, reason = _risk_check(sig, book, cfg)
        if not ok:
            skipped.append({"symbol": sig["symbol"], "reason": reason})
            if reason.startswith("max_open"):
                break
            continue
        pos = _open(sig, book, cfg)
        executed.append(pos)
    _save(book)
    return {"ran": True, "mode": cfg["mode"], "asset_class": asset_class,
            "timeframe": tf, "htf": htf, "scanned": len(syms),
            "quality_found": len(quality), "executed": executed,
            "skipped": skipped, "open_after": len(book["positions"])}


def positions() -> list[dict]:
    book = _load()
    out = []
    for p in book["positions"]:
        price = _price(p["symbol"]) or p["entry"]
        out.append({**p, "current_price": round(price, 6),
                    "unrealized": round(_unrealized(p, price), 2)})
    return out


def close_position(position_id: str) -> dict:
    book = _load()
    idx = next((i for i, p in enumerate(book["positions"]) if p["id"] == position_id), None)
    if idx is None:
        return {"error": f"no open position '{position_id}'"}
    pos = book["positions"].pop(idx)
    exit_price = _price(pos["symbol"]) or pos["entry"]
    pnl = round(_unrealized(pos, exit_price), 2)
    book["balance"] = round(float(book["balance"]) + pnl, 2)
    day = _today()
    book["realized_by_date"][day] = round(book["realized_by_date"].get(day, 0.0) + pnl, 2)
    book["trades"].append({**pos, "exit": round(exit_price, 6), "pnl": pnl, "closed_at": _now()})
    _save(book)
    return {"closed": position_id, "symbol": pos["symbol"], "pnl": pnl,
            "balance": book["balance"]}


def status() -> dict:
    cfg = config()
    book = _load()
    open_pos = positions()
    unreal = round(sum(p["unrealized"] for p in open_pos), 2)
    realized_today = book["realized_by_date"].get(_today(), 0.0)
    return {
        "config": cfg,
        "balance": round(float(book["balance"]), 2),
        "equity": round(float(book["balance"]) + unreal, 2),
        "open_positions": len(open_pos),
        "unrealized": unreal,
        "realized_today": realized_today,
        "daily_loss_budget_remaining": round(
            max(0.0, cfg["max_daily_loss"] - max(0.0, -realized_today)), 2),
        "positions": open_pos,
    }
