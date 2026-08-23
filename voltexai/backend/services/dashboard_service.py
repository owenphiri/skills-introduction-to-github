"""
Voltex Dashboard — aggregates a live snapshot of the whole platform into KPIs,
lightweight analytics series and a marquee feed. Everything is computed from
in-process data (sentiment engine, sessions, catalogs, DB counts) so it stays
deterministic and offline-safe.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from . import sentiment_service
from ..data import sessions as sessions_data
from ..data.academy import academy_overview
from ..data.products import PRODUCTS, SOCIALS
from ..data.community import SEED_POSTS
from ..data.social import STAT_HIGHLIGHTS
from ..models import Post


def _spark_from(values: list[float]) -> list[int]:
    """Normalise a series to 0..100 for tiny sparkline rendering."""
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [50 for _ in values]
    return [round((v - lo) / (hi - lo) * 100) for v in values]


def snapshot(db: Session) -> dict:
    sent = sentiment_service.overview()
    sess = sessions_data.sessions_status()
    ac = academy_overview()

    posts_count = db.query(Post).count() + len(SEED_POSTS)
    open_now = len(sess["open_now"])

    kpis = [
        {"id": "fear_greed", "label": "Fear & Greed", "value": sent["fear_greed"],
         "suffix": "/100", "sub": sent["label"], "accent": "#ff5560",
         "spark": _spark_from([c["bullish_pct"] for c in sent["by_class"]])},
        {"id": "bullish", "label": "Bullish bias", "value": sent["bullish_pct"],
         "suffix": "%", "sub": f"{sent['bullish']} of {sent['bullish'] + sent['bearish'] + sent['neutral']} instruments",
         "accent": "#45e0a0", "delta": sent["bullish_pct"] - 50},
        {"id": "sessions", "label": "Sessions open", "value": open_now,
         "suffix": f"/{len(sess['sessions'])}", "sub": " · ".join(sess["open_now"]) or "Markets quiet",
         "accent": "#4d7cff", "badge": "OVERLAP" if sess["london_ny_overlap"] else None},
        {"id": "products", "label": "Ecosystem", "value": len(PRODUCTS),
         "suffix": " products", "sub": "One connected platform", "accent": "#a06bff"},
        {"id": "academy", "label": "Academy", "value": ac["total_courses"],
         "suffix": " courses", "sub": f"{ac['total_lessons']} lessons across {len(ac['tracks'])} tracks",
         "accent": "#ffb547"},
        {"id": "community", "label": "Community wall", "value": posts_count,
         "suffix": " posts", "sub": "Traders across the globe", "accent": "#4d7cff"},
    ]

    # analytics: sentiment by asset class as a bar series
    analytics = {
        "by_class": [{"label": c["asset_class"], "value": c["bullish_pct"]}
                     for c in sent["by_class"]],
        "sessions": [{"label": s["name"], "open": s["open"],
                      "value": round(max(0.0, 24 - s["hours_to_change"]) / 24 * 100)}
                     for s in sess["sessions"]],
    }

    # marquee feed — two lanes (movers scroll one way, wins the other)
    movers = ([{"kind": "up", "text": f"▲ {r['symbol']} +{r['momentum_pct']}%"}
               for r in sent["top_bullish"]] +
              [{"kind": "down", "text": f"▼ {r['symbol']} {r['momentum_pct']}%"}
               for r in sent["top_bearish"]])
    wins = [{"kind": "win", "text": p["body"][:80] + ("…" if len(p["body"]) > 80 else ""),
             "who": f"{p['flag']} {p['author']}"} for p in SEED_POSTS]

    return {
        "kpis": kpis,
        "analytics": analytics,
        "highlights": STAT_HIGHLIGHTS,
        "marquee": {"movers": movers, "wins": wins},
        "socials": SOCIALS,
        "utc_time": sess["utc_time"],
    }
