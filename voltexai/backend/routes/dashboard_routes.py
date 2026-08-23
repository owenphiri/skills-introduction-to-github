"""
Voltex Dashboard route (public): a single live snapshot of the platform —
KPIs, analytics series, marquee feed and social channels.
GET /api/dashboard
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import dashboard_service

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return dashboard_service.snapshot(db)
