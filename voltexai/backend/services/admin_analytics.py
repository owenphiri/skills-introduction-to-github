"""
Voltex admin analytics — a deep, single-call snapshot of the whole signal
business: signal performance (equity curve, R-distribution, breakdowns by
symbol/session/grade/tier, day-of-week edge), subscriber economics, the
affiliate program and the RL model. Computed from the DB, admin-only.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..models import ProSignal, TelegramSubscriber, ReferralAccount, Referral
from . import rl_service

_DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
# Telegram Stars monthly value used to estimate MRR from active recurring subs.
_MONTHLY_STARS = 499


def _r(x: float, n: int = 2) -> float:
    return round(float(x), n)


def _signal_analytics(db: Session) -> dict:
    signals = db.query(ProSignal).all()
    closed = [s for s in signals if s.status in ("closed", "cancelled") and s.result_r is not None]
    graded = sorted(closed, key=lambda s: (s.created_at, s.id))
    wins = [s for s in graded if s.result_r > 0]
    losses = [s for s in graded if s.result_r <= 0]
    gross_win = sum(s.result_r for s in wins)
    gross_loss = -sum(s.result_r for s in losses)
    n = len(graded)

    # equity curve of cumulative R
    cum = 0.0
    equity = []
    for s in graded:
        cum += s.result_r
        equity.append({"date": s.created_at.strftime("%Y-%m-%d"), "r": _r(cum)})

    # R distribution
    buckets = [("≤ -1R", lambda r: r <= -1), ("-1–0R", lambda r: -1 < r <= 0),
               ("0–1R", lambda r: 0 < r <= 1), ("1–2R", lambda r: 1 < r <= 2),
               ("2–3R", lambda r: 2 < r <= 3), ("> 3R", lambda r: r > 3)]
    dist = [{"bucket": name, "count": sum(1 for s in graded if fn(s.result_r))} for name, fn in buckets]

    def _group(key):
        agg = defaultdict(lambda: {"count": 0, "wins": 0, "r": 0.0})
        for s in graded:
            k = key(s) or "—"
            agg[k]["count"] += 1
            agg[k]["r"] += s.result_r
            agg[k]["wins"] += int(s.result_r > 0)
        return sorted(({"label": k, "count": v["count"], "net_r": _r(v["r"]),
                        "win_rate": _r(v["wins"] / v["count"] * 100, 1)} for k, v in agg.items()),
                      key=lambda d: d["net_r"], reverse=True)

    dow = defaultdict(lambda: {"count": 0, "wins": 0, "r": 0.0})
    for s in graded:
        d = dow[s.created_at.weekday()]
        d["count"] += 1
        d["r"] += s.result_r
        d["wins"] += int(s.result_r > 0)
    by_dow = [{"day": _DOW[i], "count": dow[i]["count"], "net_r": _r(dow[i]["r"]),
               "win_rate": _r(dow[i]["wins"] / dow[i]["count"] * 100, 1) if dow[i]["count"] else 0}
              for i in range(7)]

    best = max(graded, key=lambda s: s.result_r, default=None)
    worst = min(graded, key=lambda s: s.result_r, default=None)

    return {
        "totals": {
            "signals": len(signals),
            "active": sum(1 for s in signals if s.status == "active"),
            "graded": n, "wins": len(wins), "losses": len(losses),
            "win_rate": _r(len(wins) / n * 100, 1) if n else 0,
            "profit_factor": _r(gross_win / gross_loss) if gross_loss else (_r(gross_win) or 0),
            "total_r": _r(sum(s.result_r for s in graded)),
            "expectancy": _r(sum(s.result_r for s in graded) / n) if n else 0,
            "avg_quality": _r(sum(s.quality_score for s in signals) / len(signals), 1) if signals else 0,
            "avg_rr": _r(sum((s.risk_reward or 0) for s in signals) / len(signals), 2) if signals else 0,
        },
        "equity": equity,
        "distribution": dist,
        "by_symbol": _group(lambda s: s.symbol),
        "by_session": _group(lambda s: s.session),
        "by_grade": _group(lambda s: s.grade),
        "by_tier": _group(lambda s: s.tier),
        "by_dow": by_dow,
        "best": {"symbol": best.symbol, "r": _r(best.result_r)} if best else None,
        "worst": {"symbol": worst.symbol, "r": _r(worst.result_r)} if worst else None,
    }


def _subscriber_analytics(db: Session) -> dict:
    now = datetime.utcnow()
    subs = db.query(TelegramSubscriber).all()
    active = [s for s in subs if s.vip_until and s.vip_until > now]
    recurring = [s for s in active if s.is_recurring]
    week = now - timedelta(days=7)
    return {
        "total": len(subs),
        "active_vip": len(active),
        "expired": sum(1 for s in subs if s.vip_until and s.vip_until <= now),
        "recurring": len(recurring),
        "new_7d": sum(1 for s in subs if s.created_at >= week),
        "stars_collected": sum(s.stars_paid or 0 for s in subs),
        "mrr_stars": len(recurring) * _MONTHLY_STARS,
        "by_plan": _plan_breakdown(active),
    }


def _plan_breakdown(active) -> list[dict]:
    agg = defaultdict(int)
    for s in active:
        agg[s.plan or "—"] += 1
    return [{"plan": k, "count": v} for k, v in sorted(agg.items(), key=lambda x: -x[1])]


def _retention(db: Session) -> dict:
    """Subscriber cohorts (by join month) + a VIP survival curve by tenure weeks."""
    now = datetime.utcnow()
    subs = db.query(TelegramSubscriber).all()
    vip = [s for s in subs if s.vip_until]                 # ever converted to VIP
    active = [s for s in vip if s.vip_until > now]
    churned = [s for s in vip if s.vip_until <= now]

    # cohorts by first-seen month (last 6)
    cohorts = defaultdict(list)
    for s in subs:
        cohorts[s.created_at.strftime("%Y-%m")].append(s)
    cohort_rows = []
    for month in sorted(cohorts)[-6:]:
        grp = cohorts[month]
        conv = [s for s in grp if s.vip_until]
        act = [s for s in conv if s.vip_until > now]
        cohort_rows.append({
            "cohort": month, "size": len(grp), "converted": len(conv),
            "active": len(act), "churned": len(conv) - len(act),
            "conversion_pct": _r(len(conv) / len(grp) * 100, 1) if grp else 0,
            "retention_pct": _r(len(act) / len(conv) * 100, 1) if conv else 0,
            "revenue_stars": sum(s.stars_paid or 0 for s in grp),
        })

    # survival curve: % of VIP subs whose tenure reaches >= k weeks
    curve = []
    if vip:
        tenures = [max(0, (s.vip_until - s.created_at).days) // 7 for s in vip]
        n = len(tenures)
        for k in range(0, 9):
            curve.append({"week": k, "pct": _r(sum(1 for t in tenures if t >= k) / n * 100, 1)})

    summary = {
        "converted": len(vip), "active": len(active), "churned": len(churned),
        "churn_rate": _r(len(churned) / len(vip) * 100, 1) if vip else 0,
        "recurring_share": _r(sum(1 for s in active if s.is_recurring) / len(active) * 100, 1) if active else 0,
        "avg_lifetime_days": _r(sum((s.vip_until - s.created_at).days for s in vip) / len(vip), 1) if vip else 0,
    }
    return {"cohorts": cohort_rows, "curve": curve, "summary": summary}


def _referral_analytics(db: Session) -> dict:
    accounts = db.query(ReferralAccount).all()
    refs = db.query(Referral).all()
    top = sorted((a for a in accounts if a.conversions > 0),
                 key=lambda a: (a.conversions, a.earned_stars), reverse=True)[:8]
    return {
        "affiliates": len(accounts),
        "active_affiliates": sum(1 for a in accounts if a.conversions > 0),
        "total_clicks": sum(a.clicks for a in accounts),
        "total_signups": sum(a.signups for a in accounts),
        "conversions": sum(a.conversions for a in accounts),
        "payout_stars": sum(a.earned_stars for a in accounts),
        "pending": sum(1 for r in refs if r.status == "pending"),
        "top": [{"code": a.code, "conversions": a.conversions, "earned_stars": a.earned_stars,
                 "signups": a.signups} for a in top],
    }


def snapshot(db: Session) -> dict:
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "signals": _signal_analytics(db),
        "subscribers": _subscriber_analytics(db),
        "retention": _retention(db),
        "referrals": _referral_analytics(db),
        "rl": rl_service.model_view(db),
    }
