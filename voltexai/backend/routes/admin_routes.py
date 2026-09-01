"""
Voltex admin analytics (admin-only).
GET /api/admin/analytics - deep snapshot: signals performance, subscribers,
                           affiliate program and the RL model.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole
from ..middleware.auth_middleware import get_current_user
from ..services import admin_analytics, voltex_coin_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    return user


@router.get("/analytics")
def analytics(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    return admin_analytics.snapshot(db)


# ---------------- Voltex Coin admin console ----------------
class CoinAdjustIn(BaseModel):
    user_query: str = Field(min_length=1, max_length=255)   # email or numeric id
    amount: int = Field(ne=0, ge=-1_000_000, le=1_000_000)  # +grant / -deduct
    reason: str = Field(min_length=2, max_length=48)


def _find_user(db: Session, q: str) -> User:
    u = None
    if q.isdigit():
        u = db.query(User).filter(User.id == int(q)).first()
    if not u:
        u = db.query(User).filter(User.email == q.lower().strip()).first()
    if not u:
        raise HTTPException(404, "User not found")
    return u


@router.get("/coins/stats")
def coin_stats(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    return voltex_coin_service.admin_stats(db)


@router.get("/coins/user")
def coin_user(q: str, _: User = Depends(_require_admin), db: Session = Depends(get_db)):
    return voltex_coin_service.admin_user_ledger(db, _find_user(db, q))


@router.post("/coins/adjust")
def coin_adjust(data: CoinAdjustIn, admin: User = Depends(_require_admin),
                db: Session = Depends(get_db)):
    target = _find_user(db, data.user_query)
    result = voltex_coin_service.admin_adjust(
        db, target.id, data.amount, data.reason, admin_id=admin.id)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "adjust failed"))
    return {**result, "user": {"id": target.id, "email": target.email}}


# ---------------- Real Estate waitlist ----------------
@router.get("/realestate/waitlist")
def realestate_waitlist(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """Aggregate demand per property + recent signups for the Coming-Soon vertical."""
    from ..models import RealEstateInterest
    from ..data import realestate as re_data
    rows = (db.query(RealEstateInterest)
              .order_by(RealEstateInterest.created_at.desc()).all())
    by_prop: dict[str, dict] = {}
    for p in re_data.PROPERTIES:
        by_prop[p["id"]] = {"id": p["id"], "name": p["name"], "city": p["city"],
                            "country": p["country"], "flag": p["flag"],
                            "accent": p["accent"], "count": 0, "total_usd": 0.0}
    total_usd = 0.0
    for r in rows:
        b = by_prop.get(r.property_id)
        if b:
            b["count"] += 1
            b["total_usd"] += float(r.amount_usd or 0)
        total_usd += float(r.amount_usd or 0)
    demand = sorted(by_prop.values(), key=lambda d: d["total_usd"], reverse=True)
    recent = [{"property_id": r.property_id,
               "name": by_prop.get(r.property_id, {}).get("name", r.property_id),
               "email": r.email or "—", "amount_usd": float(r.amount_usd or 0),
               "provider": r.provider, "country": r.country,
               "at": r.created_at.replace(tzinfo=None).isoformat()} for r in rows[:40]]
    return {"total_signups": len(rows), "total_demand_usd": round(total_usd, 2),
            "properties": demand, "recent": recent}
