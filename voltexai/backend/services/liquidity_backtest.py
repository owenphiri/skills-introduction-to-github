"""
VoltexAI - Liquidity-score backtest (walk-forward, no lookahead)

Answers the only question that matters about the ICT liquidity score: does a higher
score actually correspond to better forward outcomes? It walks a candle history,
and at each decision bar:

  1. builds the liquidity read from PAST candles only (no lookahead),
  2. takes a trend-following direction from that same past window,
  3. scores the setup with `liquidity.score_from_candles`,
  4. simulates the trade forward with the signal engine's own ATR bracket
     (stop = 1.5·ATR, take-profit = rr·risk) and records the result in R-multiples.

Results are bucketed by score so you can see the win-rate and expectancy of, say,
8-10 setups vs 0-4 setups — and whether expectancy rises with the score
(monotonic). The Pearson correlation between score and R is reported too.

HONESTY — this is decisive here: in this environment the market feed is SYNTHETIC,
so these numbers measure the engine's internal CONSISTENCY, not a real-market edge.
The report stamps the data source and says so. Only a backtest on real vendor
candles (Twelve Data / Alpha Vantage, once keyed) speaks to real performance, and
even then hypothetical results carry CFTC Rule 4.41 limitations. Nothing here is a
profit promise; it is a measurement tool for tuning the score.
"""
from __future__ import annotations

from . import market_service, signal_engine, liquidity, data_providers


_BUCKETS = [(0.0, 4.0), (4.0, 6.0), (6.0, 8.0), (8.0, 10.01)]


def _bias(window: list[dict]) -> str:
    """Trend-following direction from the past window only (mirrors the engine's
    regime read, cheaply)."""
    cl = [c["close"] for c in window]
    if len(cl) < 60:
        return "NO_TRADE"
    e20 = signal_engine.ema(cl, 20)[-1]
    e50 = signal_engine.ema(cl, 50)[-1]
    e200 = signal_engine.ema(cl, 200)[-1] if len(cl) >= 200 else signal_engine.ema(cl, len(cl))[-1]
    price = cl[-1]
    if e20 > e50 and price > e200:
        return "LONG"
    if e20 < e50 and price < e200:
        return "SHORT"
    return "NO_TRADE"


def _forward_R(direction: str, entry: float, stop: float, tp: float,
               fwd: list[dict], rr: float) -> float:
    """First-touch simulation over the forward window → R multiple.
    A bar that straddles both levels is scored as the stop (conservative)."""
    risk = abs(entry - stop) or 1e-9
    for c in fwd:
        hi, lo = c["high"], c["low"]
        if direction == "LONG":
            if lo <= stop:
                return -1.0
            if hi >= tp:
                return rr
        else:
            if hi >= stop:
                return -1.0
            if lo <= tp:
                return rr
    # no touch within the horizon → mark to the last close
    last = fwd[-1]["close"] if fwd else entry
    return round(((last - entry) if direction == "LONG" else (entry - last)) / risk, 3)


def backtest(symbol: str, timeframe: str = "M15", bars: int = 700,
             horizon: int = 24, rr: float = 2.0, step: int = 3,
             warmup: int = 220) -> dict:
    """Walk-forward backtest of the liquidity score for one symbol."""
    symbol = symbol.upper()
    if not market_service.get_instrument(symbol):
        return {"symbol": symbol, "error": "unknown instrument"}
    candles = market_service.get_candles(symbol, timeframe, bars)
    if len(candles) < warmup + horizon + 10:
        return {"symbol": symbol, "error": "insufficient history for a backtest"}

    trades: list[dict] = []
    last_entry = len(candles) - horizon - 1
    for i in range(warmup, last_entry, max(1, step)):
        window = candles[: i + 1]                       # PAST only — no lookahead
        direction = _bias(window)
        if direction == "NO_TRADE":
            continue
        score = liquidity.score_from_candles(symbol, window, direction)
        entry = window[-1]["close"]
        a = signal_engine.atr(window, 14) or (entry * 0.001)
        risk = a * 1.5
        if direction == "LONG":
            stop, tp = entry - risk, entry + rr * risk
        else:
            stop, tp = entry + risk, entry - rr * risk
        R = _forward_R(direction, entry, stop, tp, candles[i + 1: i + 1 + horizon], rr)
        trades.append({"score": score, "direction": direction, "R": R, "win": R > 0})

    return _summarize(symbol, timeframe, trades, rr, horizon, bars)


def _summarize(symbol, timeframe, trades, rr, horizon, bars) -> dict:
    # The backtest walks market_service.get_candles(), which is the reproducible
    # SYNTHETIC candle series — so the data is synthetic here regardless of config.
    # We still report whether a live provider is wired, i.e. the upgrade path.
    synthetic = True
    provider = "synthetic (reproducible)"
    live_ready = data_providers.has_provider()
    n = len(trades)
    if not n:
        return {"symbol": symbol, "error": "no qualifying setups in the window"}

    def agg(rows):
        m = len(rows)
        if not m:
            return {"trades": 0, "win_rate": None, "avg_R": None}
        wins = sum(1 for r in rows if r["win"])
        return {"trades": m, "win_rate": round(wins / m, 3),
                "avg_R": round(sum(r["R"] for r in rows) / m, 3)}

    buckets = []
    for lo, hi in _BUCKETS:
        rows = [t for t in trades if lo <= t["score"] < hi]
        buckets.append({"range": f"{int(lo)}-{int(hi) if hi <= 10 else 10}", **agg(rows)})

    # Pearson correlation between score and R
    xs = [t["score"] for t in trades]
    ys = [t["R"] for t in trades]
    corr = _pearson(xs, ys)

    # does expectancy rise with score? (monotonic across non-empty buckets)
    seq = [b["avg_R"] for b in buckets if b["avg_R"] is not None]
    monotonic = all(seq[k] <= seq[k + 1] for k in range(len(seq) - 1)) if len(seq) > 1 else None

    overall = agg(trades)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "params": {"bars": bars, "horizon": horizon, "rr": rr},
        "data_source": provider,
        "synthetic": synthetic,
        "live_provider_wired": live_ready,
        "sample": n,
        "overall": overall,
        "buckets": buckets,
        "score_R_correlation": corr,
        "expectancy_rises_with_score": monotonic,
        "verdict": _verdict(synthetic, corr, monotonic, n),
        "disclaimer": (
            ("SYNTHETIC DATA — measures engine consistency, not real-market edge. "
             if synthetic else "Hypothetical results have inherent limitations. ")
            + "Wire a real data provider for a market-meaningful test. "
            + liquidity.DISCLAIMER),
    }


def _pearson(xs, ys) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 0 or syy <= 0:
        return None
    return round(sxy / (sxx ** 0.5 * syy ** 0.5), 3)


def _verdict(synthetic, corr, monotonic, n) -> str:
    if synthetic:
        base = "Synthetic sample — for calibration & wiring only. "
    else:
        base = ""
    if corr is None:
        return base + "Not enough signal variation to judge."
    if corr > 0.1 and monotonic:
        return base + "Higher liquidity scores tracked higher expectancy here."
    if corr < -0.1:
        return base + "Score ran opposite to outcome — the weights need review."
    return base + "Weak/flat relationship — treat the score as one input, not a filter."


def backtest_many(symbols: list[str] | None = None, timeframe: str = "M15",
                  bars: int = 700, horizon: int = 24, rr: float = 2.0) -> dict:
    """Aggregate the backtest across a set of symbols (defaults to the news hot-list)."""
    from ..data import news_events
    syms = [s.upper() for s in (symbols or news_events._USD_HOT)]
    per, all_trades = [], []
    for s in syms:
        r = backtest(s, timeframe, bars, horizon, rr)
        if r.get("error"):
            continue
        per.append({"symbol": s, "sample": r["sample"], "overall": r["overall"],
                    "correlation": r["score_R_correlation"]})
        # rebuild pooled trades from buckets isn't possible; re-run pooled correlation
        # cheaply by trusting per-symbol summaries for the board.
    if not per:
        return {"error": "no symbols produced a backtest"}
    tot = sum(p["sample"] for p in per)
    wr = [p["overall"]["win_rate"] for p in per if p["overall"]["win_rate"] is not None]
    er = [p["overall"]["avg_R"] for p in per if p["overall"]["avg_R"] is not None]
    corr = [p["correlation"] for p in per if p["correlation"] is not None]
    return {
        "symbols": len(per), "total_sample": tot,
        "avg_win_rate": round(sum(wr) / len(wr), 3) if wr else None,
        "avg_expectancy_R": round(sum(er) / len(er), 3) if er else None,
        "avg_score_R_correlation": round(sum(corr) / len(corr), 3) if corr else None,
        "data_source": "synthetic (reproducible)", "synthetic": True,
        "live_provider_wired": data_providers.has_provider(),
        "per_symbol": per,
        "disclaimer": ("SYNTHETIC DATA — measures engine consistency, not real-market "
                       "edge. " + liquidity.DISCLAIMER),
    }
