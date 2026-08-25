"""
Voltex affiliate / referral routes.
GET  /api/referrals/me           - my code, share links and earnings (auth)
POST /api/referrals/track        - record a click for a code (public)
GET  /api/referrals/leaderboard  - top affiliates (public)
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..middleware.auth_middleware import get_current_user
from ..services import referral_service

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


@router.get("/me")
def my_referrals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return referral_service.stats(db, user)


class TrackIn(BaseModel):
    code: str


@router.post("/track")
def track(data: TrackIn, db: Session = Depends(get_db)):
    return {"tracked": referral_service.track_click(db, data.code)}


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    return {"leaders": referral_service.leaderboard(db)}
