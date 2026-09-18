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


@router.get("/realestate/waitlist.csv")
def realestate_waitlist_csv(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """Download the full waitlist as CSV — for stakeholder decks & MOU talks."""
    import csv, io
    from datetime import datetime, timezone
    from fastapi import Response
    from ..models import RealEstateInterest
    from ..data import realestate as re_data
    names = {p["id"]: p["name"] for p in re_data.PROPERTIES}
    rows = (db.query(RealEstateInterest)
              .order_by(RealEstateInterest.created_at.desc()).all())
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["created_at_utc", "property_id", "property_name", "email",
                "amount_usd", "provider", "country"])
    for r in rows:
        w.writerow([r.created_at.replace(tzinfo=None).isoformat(), r.property_id,
                    names.get(r.property_id, r.property_id), r.email or "",
                    f"{float(r.amount_usd or 0):.2f}", r.provider or "", r.country or ""])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition":
                             f'attachment; filename="voltexai-realestate-waitlist-{stamp}.csv"'})


# ---------------- Results wall moderation ----------------
class ResultVerifyIn(BaseModel):
    verified: bool | None = None          # explicit set; omit to toggle


@router.get("/results")
def admin_results(limit: int = 100, only_unverified: bool = False,
                  _: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """All client results (including unverified) for moderation, newest first."""
    from ..models import ResultPost
    from ..data.results import flag
    q = db.query(ResultPost)
    if only_unverified:
        q = q.filter(ResultPost.verified.is_(False))
    rows = q.order_by(ResultPost.created_at.desc()).limit(limit).all()
    return {"count": len(rows), "results": [{
        "id": r.id, "author": r.author, "country": r.country or "Global",
        "flag": flag(r.country), "symbol": r.symbol, "market": r.market,
        "timeframe": r.timeframe, "pnl_pct": r.pnl_pct, "pnl_amount": r.pnl_amount,
        "currency": r.currency, "body": r.body, "image_url": r.image_url,
        "verified": r.verified, "likes": r.likes,
        "created_at": r.created_at.isoformat(),
    } for r in rows]}


@router.post("/results/{result_id}/verify")
def admin_verify_result(result_id: int, data: ResultVerifyIn,
                        _: User = Depends(_require_admin), db: Session = Depends(get_db)):
    from ..models import ResultPost
    r = db.query(ResultPost).filter(ResultPost.id == result_id).first()
    if not r:
        raise HTTPException(404, "Result not found")
    r.verified = (not r.verified) if data.verified is None else bool(data.verified)
    db.commit()
    return {"id": r.id, "verified": r.verified}


@router.delete("/results/{result_id}")
def admin_delete_result(result_id: int, _: User = Depends(_require_admin),
                        db: Session = Depends(get_db)):
    from ..models import ResultPost
    r = db.query(ResultPost).filter(ResultPost.id == result_id).first()
    if not r:
        raise HTTPException(404, "Result not found")
    db.delete(r)
    db.commit()
    return {"deleted": result_id}
