"""
Voltex Competition routes.
GET  /api/competition                      - list contests (+ your entry status)
POST /api/competition/{id}/join            - join a contest (auth) — snapshots equity
GET  /api/competition/{id}/leaderboard     - ranked entrants by realized P&L since join

Scoring uses each entrant's paper-trading account: realized P&L accrued after they
joined, over their starting equity. Simulated accounts, verified-broker framing.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, BrokerAccount, ContestEntry
from ..middleware.auth_middleware import get_current_user, get_current_user_optional
from ..config import settings
from ..data.competitions import CONTESTS, get_contest

router = APIRouter(prefix="/api/competition", tags=["competition"])


def _display_name(u: User) -> str:
    if u.full_name:
        parts = u.full_name.split()
        return f"{parts[0]}{(' ' + parts[-1][0] + '.') if len(parts) > 1 else ''}"
    return u.email.split("@")[0]


@router.get("")
def list_contests(user: User | None = Depends(get_current_user_optional),
                  db: Session = Depends(get_db)):
    my = set()
    if user:
        my = {e.contest_id for e in
              db.query(ContestEntry).filter(ContestEntry.user_id == user.id).all()}
    counts = {}
    for e in db.query(ContestEntry).all():
        counts[e.contest_id] = counts.get(e.contest_id, 0) + 1
    return {"contests": [{**c, "joined": c["id"] in my,
                          "entrants": counts.get(c["id"], 0)} for c in CONTESTS]}


@router.post("/{contest_id}/join", status_code=201)
def join(contest_id: str, user: User = Depends(get_current_user),
         db: Session = Depends(get_db)):
    contest = get_contest(contest_id)
    if not contest:
        raise HTTPException(404, "Contest not found")
    existing = (db.query(ContestEntry)
                  .filter(ContestEntry.user_id == user.id,
                          ContestEntry.contest_id == contest_id).first())
    if existing:
        raise HTTPException(409, "You're already entered in this contest")
    acc = db.query(BrokerAccount).filter(BrokerAccount.user_id == user.id).first()
    start_equity = acc.starting_balance if acc else settings.PAPER_STARTING_BALANCE
    start_realized = acc.realized_pnl if acc else 0.0
    entry = ContestEntry(user_id=user.id, contest_id=contest_id,
                         start_equity=start_equity, start_realized=start_realized)
    db.add(entry)
    db.commit()
    return {"joined": True, "contest_id": contest_id,
            "message": f"You're in the {contest['name']}! Trade your paper account to climb."}


@router.get("/{contest_id}/leaderboard")
def leaderboard(contest_id: str, db: Session = Depends(get_db)):
    contest = get_contest(contest_id)
    if not contest:
        raise HTTPException(404, "Contest not found")
    entries = (db.query(ContestEntry)
                 .filter(ContestEntry.contest_id == contest_id).all())
    rows = []
    for e in entries:
        u = db.query(User).filter(User.id == e.user_id).first()
        acc = db.query(BrokerAccount).filter(BrokerAccount.user_id == e.user_id).first()
        realized_since = (acc.realized_pnl - e.start_realized) if acc else 0.0
        ret_pct = (realized_since / e.start_equity * 100) if e.start_equity else 0.0
        rows.append({
            "name": _display_name(u) if u else "Trader",
            "country": (u.country if u else None),
            "return_pct": round(ret_pct, 2),
            "pnl": round(realized_since, 2),
            "joined_at": e.joined_at.isoformat(),
        })
    rows.sort(key=lambda r: r["return_pct"], reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return {"contest": contest, "count": len(rows), "leaderboard": rows}
