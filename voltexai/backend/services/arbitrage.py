"""
VoltexAI - Arbitrage / spread scanner (fee-aware, paper-first)

An HONEST arbitrage layer. It does NOT pretend risk-free money exists: it models
the two spreads a real desk actually watches, then subtracts the costs that eat
them so only a genuinely positive *net* edge is ever flagged actionable — which,
as in real markets, is rare and small.

Two families:

  1. Cross-venue spread — the same instrument quoted on several venues. Each venue
     carries its own half-spread, a small deterministic price bias, and a taker /
     commission fee (bps). The gross edge is (best bid across venues) minus (best
     ask across venues); the NET edge subtracts both venues' fees plus a slippage
     buffer. Because every venue already embeds a half-spread, the net edge is
     usually negative — exactly as it should be.

  2. Basis spread — a listed future vs its spot/CFD equivalent (gold future vs
     XAUUSD, ES vs SPX500, WTI future vs spot, …). We report the basis in bps.
     This is a *carry/basis* relationship, NOT a free lunch: it converges only at
     expiry and is shown for context, never auto-traded.

Paper-first: the optional auto-executor books simulated, fully-hedged pairs into a
paper book and REUSES the auto-trader's operator guardrails (enabled flag, kill
switch, news guard, max-open). Nothing here can move real money.

No performance promises are made or implied. Simulated results have inherent
limitations (CFTC Rule 4.41). Fees, latency and slippage make most cross-venue
"opportunities" unexecutable in practice — the honest default is: there is no edge.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timezone

from . import market_service
from ..data import instruments


# ----------------------------- venues -----------------------------
# taker_bps: taker / commission cost per side, in basis points (1 bp = 0.01%).
# half_bps:  typical half-spread the venue quotes around mid, in bps.
# classes:   which asset classes the venue lists.
VENUES: dict[str, dict] = {
    "binance":  {"name": "Binance",  "taker_bps": 10.0, "half_bps": 2.0,  "classes": {"crypto"}},
    "kraken":   {"name": "Kraken",   "taker_bps": 16.0, "half_bps": 3.5,  "classes": {"crypto"}},
    "coinbase": {"name": "Coinbase", "taker_bps": 40.0, "half_bps": 4.0,  "classes": {"crypto"}},
    "deriv":    {"name": "Deriv",    "taker_bps": 5.0,  "half_bps": 5.0,  "classes": {"crypto", "metals", "forex"}},
    "oanda":    {"name": "OANDA",    "taker_bps": 0.0,  "half_bps": 6.0,  "classes": {"forex", "metals"}},
    "lmax":     {"name": "LMAX",     "taker_bps": 2.5,  "half_bps": 3.0,  "classes": {"forex", "metals"}},
}

# Symbols that are genuinely cross-listed across venues (spot/CFD equivalents).
CROSS_LISTED = ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "BNBUSD",
                "XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY"]

# Future vs spot/CFD equivalents — a basis relationship, shown for context only.
BASIS_PAIRS = [
    ("GC", "XAUUSD", "Gold future vs spot"),
    ("SI", "XAGUSD", "Silver future vs spot"),
    ("CL", "WTIUSD", "WTI future vs spot"),
    ("ES", "SPX500", "S&P 500 E-mini vs index CFD"),
    ("NQ", "NAS100", "Nasdaq 100 E-mini vs index CFD"),
    ("YM", "US30",   "Dow E-mini vs index CFD"),
    ("6E", "EURUSD", "Euro FX future vs spot"),
]

# Cost knobs (operator-tunable via env).
SLIPPAGE_BPS = float(os.getenv("ARB_SLIPPAGE_BPS", "1.5"))    # execution buffer, each pair
BUCKET_SECS = int(os.getenv("ARB_BUCKET_SECS", "30"))         # quote refresh granularity


# ----------------------------- helpers -----------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bucket(now: float | None = None) -> int:
    import time
    return int((now if now is not None else time.time()) // BUCKET_SECS)


def _venues_for(symbol: str) -> list[str]:
    inst = instruments.get_instrument(symbol)
    if not inst:
        return []
    cls = inst["asset_class"]
    return [vid for vid, v in VENUES.items() if cls in v["classes"]]


def _bias_bps(symbol: str, venue: str, bucket: int) -> float:
    """Deterministic per-venue price bias (bps), reproducible within a bucket.

    Real venues drift apart on inventory / flow, and the drift is WIDER on volatile
    assets (a fast BTC move dislocates venues far more than EURUSD ever does). We
    scale the amplitude by the instrument's daily volatility so that — once
    half-spreads and fees are charged — a positive net edge is a rare, small event
    on crypto and virtually never appears on FX. There is no free lunch by default."""
    h = hashlib.sha256(f"{symbol}|{venue}|{bucket}".encode()).hexdigest()
    frac = int(h[:8], 16) / 0xFFFFFFFF          # [0,1]
    vol = (instruments.get_instrument(symbol) or {}).get("daily_vol_pct", 0.5)
    # amplitude ~ ±3 bps (calm FX) up to ~±14 bps (volatile crypto)
    amp = min(14.0, 2.5 + vol * 1.6)
    return round((frac * 2 - 1) * amp, 3)


def _dp(symbol: str) -> int:
    inst = instruments.get_instrument(symbol) or {}
    pip = inst.get("pip_size", 0.01)
    return max(2, int(round(-math.log10(pip)))) if pip > 0 else 2


def _base_price(symbol: str) -> float:
    c = market_service.closes(symbol, "M1", 1)
    if c:
        return float(c[-1])
    inst = instruments.get_instrument(symbol) or {}
    return float(inst.get("seed", 0.0))


# ----------------------------- quotes -----------------------------
def venue_quotes(symbol: str, now: float | None = None) -> list[dict]:
    """Per-venue bid/ask for a symbol, derived from the reference mid plus a small
    deterministic venue bias and the venue's own half-spread."""
    symbol = symbol.upper()
    mid = _base_price(symbol)
    if mid <= 0:
        return []
    bucket = _bucket(now)
    dp = _dp(symbol)
    out = []
    for vid in _venues_for(symbol):
        v = VENUES[vid]
        bias = _bias_bps(symbol, vid, bucket)
        vmid = mid * (1 + bias / 1e4)
        half = v["half_bps"]
        bid = vmid * (1 - half / 1e4)
        ask = vmid * (1 + half / 1e4)
        out.append({
            "venue": vid, "name": v["name"],
            "bid": round(bid, dp), "ask": round(ask, dp),
            "mid": round(vmid, dp), "fee_bps": v["taker_bps"],
            "half_spread_bps": half,
        })
    return out


def _opportunity(symbol: str, notional: float, now: float | None = None,
                 fee_bps_override: float | None = None) -> dict | None:
    """Best cross-venue buy/sell for one symbol, fully costed. Returns None if the
    symbol isn't cross-listed on 2+ venues.

    fee_bps_override: model a specific fee tier PER SIDE instead of the venue's
    standard retail taker fee. Real desks run maker rebates / VIP tiers of ~0-2 bps;
    at retail taker fees a net-positive cross-venue edge is essentially impossible,
    which is the honest default this scanner shows."""
    quotes = venue_quotes(symbol, now)
    if len(quotes) < 2:
        return None
    mid = sum(q["mid"] for q in quotes) / len(quotes)
    buy = min(quotes, key=lambda q: q["ask"])    # cheapest place to buy
    sell = max(quotes, key=lambda q: q["bid"])   # richest place to sell
    if buy["venue"] == sell["venue"]:
        return None
    gross_bps = (sell["bid"] - buy["ask"]) / mid * 1e4
    if fee_bps_override is not None:
        fee_bps = 2 * float(fee_bps_override)
    else:
        fee_bps = buy["fee_bps"] + sell["fee_bps"]
    cost_bps = fee_bps + SLIPPAGE_BPS
    net_bps = gross_bps - cost_bps
    net_usd = notional * net_bps / 1e4
    return {
        "symbol": symbol,
        "display": (instruments.get_instrument(symbol) or {}).get("display", symbol),
        "asset_class": (instruments.get_instrument(symbol) or {}).get("asset_class"),
        "buy_venue": buy["name"], "buy_venue_id": buy["venue"], "buy_at": buy["ask"],
        "sell_venue": sell["name"], "sell_venue_id": sell["venue"], "sell_at": sell["bid"],
        "mid": round(mid, _dp(symbol)),
        "gross_bps": round(gross_bps, 3),
        "fee_bps": round(fee_bps, 3),
        "fee_tier": "override" if fee_bps_override is not None else "retail-taker",
        "slippage_bps": round(SLIPPAGE_BPS, 3),
        "net_bps": round(net_bps, 3),
        "net_usd": round(net_usd, 2),
        "notional": notional,
        "actionable": net_bps > 0,
        "venues": quotes,
    }


def basis_scan(now: float | None = None) -> list[dict]:
    """Future-vs-spot basis, in bps. Context only — converges at expiry, not a
    risk-free arbitrage."""
    out = []
    for fut, spot, label in BASIS_PAIRS:
        pf, ps = _base_price(fut), _base_price(spot)
        if pf <= 0 or ps <= 0:
            continue
        basis_bps = (pf - ps) / ps * 1e4
        out.append({
            "future": fut, "spot": spot, "label": label,
            "future_price": round(pf, _dp(fut)), "spot_price": round(ps, _dp(spot)),
            "basis_bps": round(basis_bps, 2),
            "structure": "contango" if basis_bps > 0 else "backwardation",
        })
    return out


DISCLAIMER = (
    "Fee-aware, paper-first. A positive net edge is rare and small; fees, latency "
    "and slippage make most cross-venue spreads unexecutable in practice. Basis "
    "figures are carry relationships, not risk-free arbitrage. Simulated results "
    "have inherent limitations (CFTC Rule 4.41). Not financial advice."
)


def scan(min_net_bps: float = 0.0, notional: float = 10000.0,
         symbols: list[str] | None = None, now: float | None = None,
         fee_bps_override: float | None = None) -> dict:
    """Scan cross-listed symbols for fee-aware net-edge opportunities."""
    syms = [s.upper() for s in (symbols or CROSS_LISTED)]
    opps = []
    for s in syms:
        opp = _opportunity(s, notional, now, fee_bps_override)
        if opp:
            opps.append(opp)
    opps.sort(key=lambda o: o["net_bps"], reverse=True)
    actionable = [o for o in opps if o["net_bps"] >= min_net_bps and o["actionable"]]
    return {
        "generated_at": _now(),
        "notional": notional,
        "min_net_bps": min_net_bps,
        "fee_tier_bps": fee_bps_override,
        "scanned": len(syms),
        "opportunities": opps,
        "actionable_count": len(actionable),
        "basis": basis_scan(now),
        "venues": [{"id": k, **{kk: vv for kk, vv in v.items() if kk != "classes"}}
                   for k, v in VENUES.items()],
        "disclaimer": DISCLAIMER,
    }


# ----------------------------- paper arb book -----------------------------
ARB_BOOK_PATH = os.getenv("ARB_BOOK", "voltex_arb_book.json").strip()


def _fresh() -> dict:
    return {"positions": [], "trades": [], "realized_usd": 0.0, "seq": 0}


def _load() -> dict:
    if not os.path.exists(ARB_BOOK_PATH):
        return _fresh()
    try:
        b = json.load(open(ARB_BOOK_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        return _fresh()
    for k, v in _fresh().items():
        b.setdefault(k, v)
    return b


def _save(book: dict) -> None:
    tmp = f"{ARB_BOOK_PATH}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(book, fh, indent=2)
    os.replace(tmp, ARB_BOOK_PATH)


def _gates() -> tuple[bool, str, dict]:
    """Reuse the auto-trader's operator guardrails so arbitrage obeys the same
    kill switch / news guard / enable flag as directional auto-trade."""
    from . import auto_trader
    cfg = auto_trader.config()
    if not cfg["enabled"]:
        return False, "auto-trader disabled (set AUTOTRADE_ENABLED=true)", cfg
    if cfg["kill_switch"]:
        return False, "kill switch engaged", cfg
    if cfg["news_guard"]:
        from ..data import news_events
        if news_events.is_high_impact_live():
            return False, "high-impact news window — new entries paused", cfg
    return True, "approved", cfg


def run_arbitrage_cycle(min_net_bps: float = 0.0, notional: float = 10000.0,
                        now: float | None = None,
                        fee_bps_override: float | None = None) -> dict:
    """Book simulated, fully-hedged pairs for every symbol whose NET edge clears
    the threshold. Paper only; gated by the shared operator guardrails."""
    ok, reason, cfg = _gates()
    result = {"ran": ok, "mode": "paper", "min_net_bps": min_net_bps,
              "notional": notional, "executed": [], "skipped": []}
    if not ok:
        result["reason"] = reason
        return result

    sc = scan(min_net_bps, notional, now=now, fee_bps_override=fee_bps_override)
    book = _load()
    open_syms = {p["symbol"] for p in book["positions"]}
    max_open = cfg["max_open"]
    for opp in sc["opportunities"]:
        if not opp["actionable"] or opp["net_bps"] < min_net_bps:
            result["skipped"].append({"symbol": opp["symbol"],
                                      "reason": f"net {opp['net_bps']} bps below threshold"})
            continue
        if opp["symbol"] in open_syms:
            result["skipped"].append({"symbol": opp["symbol"], "reason": "pair already open"})
            continue
        if len(book["positions"]) >= max_open:
            result["skipped"].append({"symbol": opp["symbol"], "reason": f"max_open {max_open} reached"})
            break
        book["seq"] += 1
        pos = {
            "id": f"ARB{book['seq']}", "symbol": opp["symbol"],
            "long_venue": opp["buy_venue"], "long_at": opp["buy_at"],
            "short_venue": opp["sell_venue"], "short_at": opp["sell_at"],
            "net_bps": opp["net_bps"], "notional": notional,
            "fee_tier_bps": fee_bps_override, "fee_bps": opp["fee_bps"],
            "expected_usd": opp["net_usd"], "opened_at": _now(), "mode": "paper",
        }
        book["positions"].append(pos)
        open_syms.add(opp["symbol"])
        result["executed"].append(pos)
    _save(book)
    result["open_after"] = len(book["positions"])
    return result


def arb_positions(now: float | None = None) -> list[dict]:
    """Open paper arb pairs, marked to the current cross-venue spread."""
    book = _load()
    out = []
    for p in book["positions"]:
        opp = _opportunity(p["symbol"], p["notional"], now, p.get("fee_tier_bps"))
        cur_net = opp["net_bps"] if opp else None
        cur_usd = opp["net_usd"] if opp else None
        out.append({**p, "current_net_bps": cur_net, "current_usd": cur_usd})
    return out


def close_arb(position_id: str, now: float | None = None) -> dict:
    book = _load()
    idx = next((i for i, p in enumerate(book["positions"]) if p["id"] == position_id), None)
    if idx is None:
        return {"error": f"no open arb pair '{position_id}'"}
    pos = book["positions"].pop(idx)
    opp = _opportunity(pos["symbol"], pos["notional"], now, pos.get("fee_tier_bps"))
    # Realized = the net edge available now on the same pair (paper mark).
    pnl = round(opp["net_usd"], 2) if opp else 0.0
    book["realized_usd"] = round(float(book["realized_usd"]) + pnl, 2)
    book["trades"].append({**pos, "closed_at": _now(), "realized_usd": pnl})
    _save(book)
    return {"closed": position_id, "symbol": pos["symbol"], "realized_usd": pnl,
            "total_realized_usd": book["realized_usd"]}


def arb_status(now: float | None = None) -> dict:
    ok, reason, cfg = _gates()
    book = _load()
    return {
        "gate_open": ok, "gate_reason": reason,
        "enabled": cfg["enabled"], "kill_switch": cfg["kill_switch"],
        "news_guard": cfg["news_guard"], "max_open": cfg["max_open"],
        "open_pairs": arb_positions(now), "open_count": len(book["positions"]),
        "realized_usd": book["realized_usd"], "closed_count": len(book["trades"]),
        "slippage_bps": SLIPPAGE_BPS, "disclaimer": DISCLAIMER,
    }
