"""
VoltexAI - ICT liquidity engine (news-aware, honest)

Structures the "smart-money / ICT" way of reading a chart so the signal engine can
reason about WHERE stop-orders rest and how price is likely to reach for them —
especially around high-impact news, where price often runs a liquidity pool (a
"sweep" / stop raid) before reversing.

What it detects (all mechanical, all inspectable — no black box):
  * Liquidity pools: prior-day / prior-week highs & lows, session highs & lows,
    relatively-equal highs & lows (resting liquidity), and round numbers.
      - Buy-side liquidity (BSL) rests ABOVE old highs (breakout buy-stops).
      - Sell-side liquidity (SSL) rests BELOW old lows (breakdown sell-stops).
  * Draw on liquidity: the nearest UNTAPPED pool on each side — the likely target.
  * Premium / discount: is price in the upper (premium) or lower (discount) half of
    the dealing range, relative to equilibrium? ICT buys discount, sells premium.
  * Liquidity sweep: a recent wick beyond a pool that closes back inside — a stop
    raid that can precede a reversal (the "turtle soup" / judas-swing idea).

IMPORTANT — honesty: ICT is a popular DISCRETIONARY framework, not a guaranteed
edge. This module makes that framework explicit and testable; it does not predict
price and makes no profit promise. Every output carries the same educational /
hypothetical caveat the rest of VoltexAI does. Its job is to raise or lower the
QUALITY and CAUTION of a setup, and to flag when you would be entering INTO resting
liquidity right before news — i.e. when you are the liquidity being targeted.
"""
from __future__ import annotations

from datetime import datetime, timezone

from . import market_service
from ..data import instruments, news_events


DISCLAIMER = (
    "ICT liquidity mapping is a structured reading of a discretionary framework, "
    "for education and analysis only — not a prediction or profit guarantee. "
    "Hypothetical/simulated context has inherent limitations (CFTC Rule 4.41)."
)

# ICT killzones, approximated by UTC hour ranges.
_SESSIONS = {
    "asia":   (0, 6),    # Tokyo
    "london": (7, 10),   # London open killzone
    "ny":     (12, 15),  # New York killzone (13:30 data, 14:00 FOMC land here)
}


# ----------------------------- helpers -----------------------------
def _pip(symbol: str) -> float:
    inst = instruments.get_instrument(symbol) or {}
    return float(inst.get("pip_size", 0.01)) or 0.01


def _dp(symbol: str) -> int:
    pip = _pip(symbol)
    import math
    return max(2, int(round(-math.log10(pip)))) if pip > 0 else 2


def _pips(symbol: str, a: float, b: float) -> float:
    return round(abs(a - b) / _pip(symbol), 1)


def _swings(candles: list[dict], left: int = 2, right: int = 2):
    """Local swing highs and lows (fractal-style)."""
    highs, lows = [], []
    n = len(candles)
    for i in range(left, n - right):
        hi = candles[i]["high"]; lo = candles[i]["low"]
        if all(hi >= candles[j]["high"] for j in range(i - left, i)) and \
           all(hi >= candles[j]["high"] for j in range(i + 1, i + right + 1)):
            highs.append((i, hi))
        if all(lo <= candles[j]["low"] for j in range(i - left, i)) and \
           all(lo <= candles[j]["low"] for j in range(i + 1, i + right + 1)):
            lows.append((i, lo))
    return highs, lows


def _equal_levels(levels: list[tuple[int, float]], tol_frac: float):
    """Cluster relatively-equal swing points → resting liquidity. `levels` is a list
    of (index, price); returns [(price, count)] for clusters of 2+."""
    out = []
    used = [False] * len(levels)
    for i in range(len(levels)):
        if used[i]:
            continue
        base = levels[i][1]
        cluster = [base]
        used[i] = True
        for j in range(i + 1, len(levels)):
            if used[j]:
                continue
            if abs(levels[j][1] - base) / base <= tol_frac:
                cluster.append(levels[j][1]); used[j] = True
        if len(cluster) >= 2:
            out.append((round(sum(cluster) / len(cluster), 8), len(cluster)))
    return out


def _prior_day_range(candles: list[dict]):
    """High/low of the most recent COMPLETED UTC day."""
    by_day: dict[str, list[dict]] = {}
    for c in candles:
        day = datetime.fromtimestamp(c["time"], timezone.utc).date().isoformat()
        by_day.setdefault(day, []).append(c)
    days = sorted(by_day)
    if len(days) < 2:
        return None
    prev = by_day[days[-2]]
    return max(x["high"] for x in prev), min(x["low"] for x in prev)


def _session_ranges(candles: list[dict]):
    """Today's session highs/lows for the killzones seen so far."""
    today = datetime.now(timezone.utc).date()
    out = {}
    for name, (h0, h1) in _SESSIONS.items():
        pts = [c for c in candles
               if datetime.fromtimestamp(c["time"], timezone.utc).date() == today
               and h0 <= datetime.fromtimestamp(c["time"], timezone.utc).hour < h1]
        if pts:
            out[name] = (max(x["high"] for x in pts), min(x["low"] for x in pts))
    return out


def _round_numbers(symbol: str, price: float):
    """Nearest psychological round levels above and below."""
    pip = _pip(symbol)
    step = pip * 500  # 50-pip grid on FX-style scales, scales with the instrument
    below = (price // step) * step
    above = below + step
    return round(below, _dp(symbol)), round(above, _dp(symbol))


# ----------------------------- core map -----------------------------
def liquidity_map(symbol: str, timeframe: str = "M15", count: int = 300) -> dict:
    """Build the full liquidity picture for a symbol (fetches candles, then maps)."""
    symbol = symbol.upper()
    inst = instruments.get_instrument(symbol)
    if not inst:
        return {"symbol": symbol, "error": "unknown instrument"}
    candles = market_service.get_candles(symbol, timeframe, count)
    return map_from_candles(symbol, candles, timeframe)


def map_from_candles(symbol: str, candles: list[dict], timeframe: str = "M15") -> dict:
    """Map liquidity from an explicit candle series — no fetch, so the backtester can
    pass only PAST candles (no lookahead)."""
    symbol = symbol.upper()
    inst = instruments.get_instrument(symbol)
    if not inst:
        return {"symbol": symbol, "error": "unknown instrument"}
    if len(candles) < 40:
        return {"symbol": symbol, "error": "insufficient data"}

    price = candles[-1]["close"]
    dp = _dp(symbol)
    highs, lows = _swings(candles)
    tol = 0.0006 if inst["asset_class"] in ("forex", "metals") else 0.0015
    eqh = _equal_levels(highs, tol)
    eql = _equal_levels(lows, tol)

    pools: list[dict] = []

    def add(kind, label, lvl, extra=None):
        if lvl is None or lvl <= 0:
            return
        # "swept" = price has already traded through this pool very recently
        swept = (kind == "BSL" and any(c["high"] >= lvl for c in candles[-3:])) or \
                (kind == "SSL" and any(c["low"] <= lvl for c in candles[-3:]))
        pools.append({
            "kind": kind, "label": label, "price": round(lvl, dp),
            "distance_pips": _pips(symbol, price, lvl),
            "side": "above" if lvl > price else "below",
            "swept": swept, **(extra or {}),
        })

    pdr = _prior_day_range(candles)
    if pdr:
        add("BSL", "PDH", pdr[0]); add("SSL", "PDL", pdr[1])
    for name, (shi, slo) in _session_ranges(candles).items():
        add("BSL", f"{name.upper()} high", shi); add("SSL", f"{name.upper()} low", slo)
    for lvl, cnt in eqh:
        add("BSL", "Equal highs (EQH)", lvl, {"touches": cnt})
    for lvl, cnt in eql:
        add("SSL", "Equal lows (EQL)", lvl, {"touches": cnt})
    rb, ra = _round_numbers(symbol, price)
    add("SSL", "Round number", rb); add("BSL", "Round number", ra)

    # dealing range + premium/discount (ICT equilibrium)
    half = max(20, len(candles) // 2)
    hi = max(c["high"] for c in candles[-half:])
    lo = min(c["low"] for c in candles[-half:])
    eq = (hi + lo) / 2
    zone = "premium" if price > eq else "discount" if price < eq else "equilibrium"

    return {
        "symbol": symbol, "timeframe": timeframe,
        "price": round(price, dp),
        "range": {"high": round(hi, dp), "low": round(lo, dp),
                  "equilibrium": round(eq, dp), "zone": zone},
        "pools": sorted(pools, key=lambda p: p["distance_pips"]),
        "disclaimer": DISCLAIMER,
    }


def draw_on_liquidity(lmap: dict) -> dict:
    """Nearest UNTAPPED pool on each side — the near-term liquidity draw."""
    pools = lmap.get("pools", [])
    bsl = [p for p in pools if p["kind"] == "BSL" and p["side"] == "above" and not p["swept"]]
    ssl = [p for p in pools if p["kind"] == "SSL" and p["side"] == "below" and not p["swept"]]
    bsl.sort(key=lambda p: p["distance_pips"])
    ssl.sort(key=lambda p: p["distance_pips"])
    nearest_buy = bsl[0] if bsl else None
    nearest_sell = ssl[0] if ssl else None
    target = None
    if nearest_buy and nearest_sell:
        target = "buy-side" if nearest_buy["distance_pips"] <= nearest_sell["distance_pips"] else "sell-side"
    elif nearest_buy:
        target = "buy-side"
    elif nearest_sell:
        target = "sell-side"
    return {"buy_side": nearest_buy, "sell_side": nearest_sell, "likely_draw": target}


def sweep_state(symbol: str, timeframe: str = "M15", lookback: int = 5) -> dict:
    """Did price just RAID a pool and close back inside? (stop-raid → possible reversal)"""
    lmap = liquidity_map(symbol, timeframe)
    if "error" in lmap:
        return {"swept": False, **lmap}
    candles = market_service.get_candles(symbol, timeframe, 60)
    return sweep_from_candles(candles, lmap, lookback)


def sweep_from_candles(candles: list[dict], lmap: dict, lookback: int = 5) -> dict:
    """Sweep read from an explicit candle series + a prebuilt liquidity map."""
    if "error" in lmap or len(candles) < lookback:
        return {"swept": False, "note": "insufficient data for sweep read."}
    recent = candles[-lookback:]
    hi_recent = max(c["high"] for c in recent)
    lo_recent = min(c["low"] for c in recent)
    close = candles[-1]["close"]
    for p in lmap["pools"]:
        if p["kind"] == "BSL" and hi_recent >= p["price"] > close:
            return {"swept": True, "side": "buy-side", "pool": p,
                    "reversal_bias": "SHORT",
                    "note": f"Buy-side liquidity at {p['label']} was swept and price closed back below — bearish reversal risk."}
        if p["kind"] == "SSL" and lo_recent <= p["price"] < close:
            return {"swept": True, "side": "sell-side", "pool": p,
                    "reversal_bias": "LONG",
                    "note": f"Sell-side liquidity at {p['label']} was swept and price closed back above — bullish reversal risk."}
    return {"swept": False, "note": "No fresh liquidity sweep in the recent window."}


# ----------------------------- scoring + assessment -----------------------------
def liquidity_score(direction: str, lmap: dict, draw: dict, sweep: dict,
                    news: dict | None) -> float:
    """A transparent 0-10 liquidity-confluence score for a proposed direction.

    Rewards ICT-aligned context (discount longs / premium shorts, trading toward an
    untapped pool, entering AFTER a same-side sweep) and penalises entering straight
    INTO nearby resting liquidity — the classic retail trap, worst of all right
    before news. Adaptive weights are stored so the RL layer can tune them later."""
    if direction not in ("LONG", "SHORT"):
        return 0.0
    w = _WEIGHTS
    s = w["base"]
    zone = lmap.get("range", {}).get("zone")
    # premium/discount alignment
    if direction == "LONG" and zone == "discount":
        s += w["pd_align"]
    elif direction == "SHORT" and zone == "premium":
        s += w["pd_align"]
    elif zone in ("premium", "discount"):
        s -= w["pd_align"] * 0.6                      # trading against equilibrium
    # trade toward an untapped draw on the correct side
    tgt = draw.get("likely_draw")
    if (direction == "LONG" and tgt == "buy-side") or (direction == "SHORT" and tgt == "sell-side"):
        s += w["draw_align"]
    # post-sweep reversal in our favour
    if sweep.get("swept") and sweep.get("reversal_bias") == direction:
        s += w["sweep_align"]
    # penalty: entering INTO very near resting liquidity in our path (we are the liquidity)
    opp = draw.get("buy_side") if direction == "LONG" else draw.get("sell_side")
    if opp and opp["distance_pips"] <= w["near_pips"]:
        s -= w["into_liquidity"]
        if news and news.get("live"):
            s -= w["news_into_liquidity"]             # worst case: into liquidity, live news
    return round(max(0.0, min(10.0, s)), 1)


# Adaptive weights (static defaults; shaped for the RL scoring layer to tune).
_WEIGHTS = {
    "base": 5.0, "pd_align": 1.6, "draw_align": 1.4, "sweep_align": 2.0,
    "near_pips": 12.0, "into_liquidity": 2.2, "news_into_liquidity": 1.5,
}


def score_from_candles(symbol: str, candles: list[dict], direction: str,
                       news: dict | None = None) -> float:
    """Liquidity-confluence score computed from an explicit (past-only) candle
    series — the backtester's entry point. News defaults to None because reliable
    historical event mapping isn't available; the backtest therefore measures the
    pure liquidity-STRUCTURE signal."""
    lmap = map_from_candles(symbol, candles)
    if lmap.get("error"):
        return 0.0
    draw = draw_on_liquidity(lmap)
    sweep = sweep_from_candles(candles, lmap)
    return liquidity_score(direction, lmap, draw, sweep, news)


def assess(symbol: str, timeframe: str = "M15", direction: str | None = None,
           now: datetime | None = None) -> dict:
    """Full news-aware ICT assessment for a symbol (optionally for a proposed
    direction). Safe to attach to a signal."""
    lmap = liquidity_map(symbol, timeframe)
    if "error" in lmap:
        return {"symbol": symbol.upper(), **lmap, "disclaimer": DISCLAIMER}
    draw = draw_on_liquidity(lmap)
    sweep = sweep_state(symbol, timeframe)
    news = news_events.symbol_alert(symbol, now=now)

    warnings: list[str] = []
    # entering into resting liquidity right before/at news = you may be the target
    if direction in ("LONG", "SHORT"):
        opp = draw["buy_side"] if direction == "LONG" else draw["sell_side"]
        if opp and opp["distance_pips"] <= _WEIGHTS["near_pips"] and news:
            warnings.append(
                f"{direction} sits just below {opp['label']} ({opp['distance_pips']} pips) with "
                f"{news['event']} {'LIVE' if news.get('live') else 'in ' + news.get('countdown','soon')} "
                f"— price may sweep that liquidity first. Consider waiting for the sweep + reversal.")
    if sweep.get("swept") and news:
        warnings.append(sweep["note"] + " Post-news reversals often start from a sweep like this.")

    score = liquidity_score(direction, lmap, draw, sweep, news) if direction else None
    return {
        "symbol": symbol.upper(), "timeframe": timeframe,
        "price": lmap["price"], "range": lmap["range"],
        "draw_on_liquidity": draw, "sweep": sweep,
        "pools": lmap["pools"][:8],
        "news": news,
        "liquidity_score": score,
        "warnings": warnings,
        "stance": _stance(lmap, draw, sweep, news),
        "disclaimer": DISCLAIMER,
    }


def _stance(lmap, draw, sweep, news) -> str:
    zone = lmap["range"]["zone"]
    tgt = draw.get("likely_draw")
    if sweep.get("swept"):
        return f"Fresh {sweep['side']} sweep → watch for a {sweep['reversal_bias']} reversal."
    base = f"Price in {zone}; nearest draw is {tgt or 'unclear'}."
    if news and news.get("live"):
        return "High-impact news LIVE — expect a liquidity run then reversal. " + base
    if news:
        return f"{news['event']} in {news.get('countdown','soon')} — map liquidity before positioning. " + base
    return base


def news_liquidity(symbols: list[str] | None = None, timeframe: str = "M15",
                   now: datetime | None = None) -> dict:
    """Watchlist view: instruments with a high-impact event live or imminent, paired
    with their current liquidity draw — the desk's pre-news board."""
    syms = [s.upper() for s in (symbols or news_events._USD_HOT)]
    rows = []
    for s in syms:
        news = news_events.symbol_alert(s, now=now)
        if not news:
            continue
        lmap = liquidity_map(s, timeframe)
        if "error" in lmap:
            continue
        draw = draw_on_liquidity(lmap)
        rows.append({
            "symbol": s, "price": lmap["price"], "zone": lmap["range"]["zone"],
            "event": news["event"], "impact": news["impact"],
            "live": news.get("live"), "countdown": news.get("countdown"),
            "likely_draw": draw.get("likely_draw"),
            "buy_side": draw.get("buy_side"), "sell_side": draw.get("sell_side"),
        })
    rows.sort(key=lambda r: (not r["live"], r["symbol"]))
    return {"generated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(rows), "board": rows, "disclaimer": DISCLAIMER}
