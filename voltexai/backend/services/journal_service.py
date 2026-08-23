"""
Voltex Trade Journal analytics — turns a user's logged trades into the numbers
that power the advanced journal dashboard: KPIs, an equity curve, a P&L calendar
heat map and per-setup / per-symbol breakdowns.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from ..models import JournalTrade


def _round(x: float, n: int = 2) -> float:
    return round(float(x), n)


def stats(trades: list[JournalTrade]) -> dict:
    n = len(trades)
    if n == 0:
        return {"count": 0, "net_pnl": 0, "win_rate": 0, "avg_win": 0, "avg_loss": 0,
                "profit_factor": 0, "avg_rr": 0, "best": 0, "worst": 0,
                "wins": 0, "losses": 0, "expectancy": 0}
    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl < 0]
    gross_win = sum(t.pnl for t in wins)
    gross_loss = -sum(t.pnl for t in losses)
    rrs = [t.rr for t in trades if t.rr is not None]
    net = sum(t.pnl for t in trades)
    return {
        "count": n,
        "net_pnl": _round(net),
        "win_rate": _round(len(wins) / n * 100, 1),
        "wins": len(wins), "losses": len(losses),
        "avg_win": _round(gross_win / len(wins)) if wins else 0,
        "avg_loss": _round(gross_loss / len(losses)) if losses else 0,
        "profit_factor": _round(gross_win / gross_loss) if gross_loss else (gross_win and 99.0),
        "avg_rr": _round(sum(rrs) / len(rrs), 2) if rrs else 0,
        "best": _round(max(t.pnl for t in trades)),
        "worst": _round(min(t.pnl for t in trades)),
        "expectancy": _round(net / n),
    }


def equity_curve(trades: list[JournalTrade]) -> list[dict]:
    """Cumulative P&L ordered by trade date then id."""
    ordered = sorted(trades, key=lambda t: (t.trade_date, t.id))
    cum = 0.0
    out = []
    for t in ordered:
        cum += t.pnl
        out.append({"date": t.trade_date.isoformat(), "equity": _round(cum), "pnl": _round(t.pnl)})
    return out


def calendar_heatmap(trades: list[JournalTrade], weeks: int = 26) -> dict:
    """Daily net P&L for the last `weeks` weeks, laid out for a GitHub-style grid."""
    by_day: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for t in trades:
        by_day[t.trade_date.isoformat()] += t.pnl
        counts[t.trade_date.isoformat()] += 1

    today = date.today()
    start = today - timedelta(days=weeks * 7 - 1)
    # align start to Monday
    start -= timedelta(days=start.weekday())
    days = []
    d = start
    while d <= today:
        key = d.isoformat()
        days.append({"date": key, "pnl": _round(by_day.get(key, 0.0)),
                     "trades": counts.get(key, 0)})
        d += timedelta(days=1)
    vals = [x["pnl"] for x in days if x["trades"]]
    return {"days": days, "start": start.isoformat(), "end": today.isoformat(),
            "max_gain": _round(max(vals)) if vals else 0,
            "max_loss": _round(min(vals)) if vals else 0}


def _breakdown(trades: list[JournalTrade], key) -> list[dict]:
    agg: dict[str, dict] = defaultdict(lambda: {"pnl": 0.0, "count": 0, "wins": 0})
    for t in trades:
        k = key(t) or "—"
        agg[k]["pnl"] += t.pnl
        agg[k]["count"] += 1
        if t.pnl > 0:
            agg[k]["wins"] += 1
    out = [{"label": k, "pnl": _round(v["pnl"]), "count": v["count"],
            "win_rate": _round(v["wins"] / v["count"] * 100, 1)} for k, v in agg.items()]
    return sorted(out, key=lambda x: x["pnl"], reverse=True)


def dashboard(trades: list[JournalTrade]) -> dict:
    return {
        "stats": stats(trades),
        "equity": equity_curve(trades),
        "heatmap": calendar_heatmap(trades),
        "by_symbol": _breakdown(trades, lambda t: t.symbol),
        "by_setup": _breakdown(trades, lambda t: t.setup),
    }


def to_dict(t: JournalTrade) -> dict:
    return {"id": t.id, "symbol": t.symbol, "side": t.side, "entry": t.entry,
            "exit": t.exit, "size": t.size, "pnl": _round(t.pnl),
            "rr": t.rr, "setup": t.setup, "trade_date": t.trade_date.isoformat(),
            "notes": t.notes}
