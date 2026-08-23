"""
Voltex social routes (public).
GET /api/social/testimonials   - Success Stories content + highlight stats
GET /api/social/proof          - activity feed for the bottom-left toasts

The proof feed blends REAL recent platform activity (contest entries) with
representative marketing samples so the widget is always lively but grounded in
actual usage where it exists. Personas are generic (first name + country/city).
"""
import random

from fastapi import APIRouter
from sqlalchemy.orm import Session
from fastapi import Depends

from ..database import get_db
from ..models import ContestEntry, User
from ..data.social import PERSONAS, COURSES, TESTIMONIALS, STAT_HIGHLIGHTS
from ..data.competitions import get_contest

router = APIRouter(prefix="/api/social", tags=["social"])


@router.get("/testimonials")
def testimonials():
    return {"testimonials": TESTIMONIALS, "stats": STAT_HIGHLIGHTS}


def _sample_events(n: int) -> list[dict]:
    out = []
    for _ in range(n):
        name, country, city = random.choice(PERSONAS)
        roll = random.random()
        if roll < 0.55:
            out.append({"type": "purchase", "name": name, "location": f"{city}, {country}",
                        "detail": f"enrolled in {random.choice(COURSES)}"})
        elif roll < 0.8:
            place = random.choice(["🥇 1st", "🥈 2nd", "🥉 3rd", "top 10"])
            contest = random.choice(["Weekly Sprint", "Monthly Masters", "Crypto Futures Cup"])
            out.append({"type": "leaderboard", "name": name, "location": f"{city}, {country}",
                        "detail": f"finished {place} in the {contest}"})
        else:
            out.append({"type": "signup", "name": name, "location": f"{city}, {country}",
                        "detail": "joined VoltexAI"})
    return out


@router.get("/proof")
def proof(db: Session = Depends(get_db)):
    events: list[dict] = []

    # real recent contest entries -> "joined the <contest>"
    recent = (db.query(ContestEntry)
                .order_by(ContestEntry.joined_at.desc()).limit(6).all())
    for e in recent:
        u = db.query(User).filter(User.id == e.user_id).first()
        contest = get_contest(e.contest_id)
        if u and contest:
            first = (u.full_name or u.email.split("@")[0]).split()[0]
            loc = u.country or "the community"
            events.append({"type": "leaderboard", "name": first, "location": loc,
                           "detail": f"entered the {contest['name']}", "real": True})

    # top up with representative samples and shuffle
    events += _sample_events(max(0, 24 - len(events)))
    random.shuffle(events)
    for i, ev in enumerate(events):
        ev["mins_ago"] = random.randint(1, 58) + i  # spread out timings
    return {"count": len(events), "events": events,
            "disclaimer": "Activity shown is representative of platform usage."}
