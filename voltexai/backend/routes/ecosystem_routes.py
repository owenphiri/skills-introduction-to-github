"""
VoltexAI ecosystem routes.
GET /api/ecosystem                 - company + product line (public hub)
GET /api/academy/overview          - tracks + totals
GET /api/academy/courses           - courses (filter by track)
GET /api/academy/courses/{id}      - single course + lessons
GET /api/store                     - store catalog (filter by category)
GET /api/pay                       - Voltex Pay payment-rail catalog
GET /api/gamification/me           - the current user's XP / level / badges (auth)
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..middleware.auth_middleware import get_current_user
from ..data.products import ecosystem
from ..data import academy as academy_data
from ..data.store import list_products, CATEGORIES
from ..data.pay import pay_overview
from ..data import geo
from ..data import realestate as realestate_data
from ..services import gamification

router = APIRouter(tags=["ecosystem"])


@router.get("/api/ecosystem")
def get_ecosystem():
    return ecosystem()


@router.get("/api/academy/overview")
def academy_overview():
    return academy_data.academy_overview()


@router.get("/api/academy/courses")
def academy_courses(track: str = Query("all")):
    courses = academy_data.list_courses(track)
    return {"count": len(courses), "courses": courses}


@router.get("/api/academy/courses/{course_id}")
def academy_course(course_id: str):
    c = academy_data.get_course(course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    return c


@router.post("/api/academy/courses/{course_id}/lessons/{lesson_idx}/complete")
def academy_complete_lesson(course_id: str, lesson_idx: int,
                            user: User = Depends(get_current_user),
                            db: Session = Depends(get_db)):
    """Mark a lesson complete and reward Voltex Coin. Idempotent per lesson —
    the coin ledger entry (ref=lesson:<course>:<idx>) doubles as the record, so
    completing the same lesson twice pays only once."""
    c = academy_data.get_course(course_id)
    if not c:
        raise HTTPException(404, "Course not found")
    if lesson_idx < 0 or lesson_idx >= len(c.get("lessons", [])):
        raise HTTPException(404, "Lesson not found")
    from ..services import voltex_coin_service
    ref = f"lesson:{course_id}:{lesson_idx}"
    already = voltex_coin_service._earned_for_ref(db, user.id, "academy_lesson", ref)
    tx = None if already else voltex_coin_service.award(
        db, user.id, "academy_lesson", ref=ref, dedupe_ref=True)
    return {"completed": True, "already_claimed": bool(already),
            "earned": 0 if already else voltex_coin_service.EARN_RULES["academy_lesson"],
            "balance": voltex_coin_service.balance(db, user.id),
            "lesson": c["lessons"][lesson_idx]}


@router.get("/api/store")
def store(category: str = Query("all")):
    return {"categories": CATEGORIES, "products": list_products(category)}


@router.get("/api/geo/config")
def geo_config(country: str = Query(None)):
    """Public: supported currencies + FX (indicative), the visitor's detected
    local currency/rail, and VoltexAI's global reach summary."""
    return geo.geo_config(country)


@router.get("/api/realestate")
def realestate(market: str = Query("all")):
    """Public: VoltexAI Real Estate — overview + curated property opportunities."""
    data = realestate_data.realestate_overview()
    if market and market != "all":
        data["properties"] = realestate_data.list_properties(market)
    return data


@router.get("/api/realestate/property/{property_id}")
def realestate_property(property_id: str):
    """Public: a single property's full prospectus + launch status."""
    p = realestate_data.get_property(property_id)
    if not p:
        raise HTTPException(404, "Property not found")
    return {"property": p, "launch": realestate_data.LAUNCH}


class RealEstateInterestIn(BaseModel):
    property_id: str = Field(min_length=2, max_length=60)
    amount_usd: float = Field(default=0.0, ge=0, le=100_000_000)
    email: EmailStr | None = None
    provider: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=60)


@router.post("/api/realestate/interest", status_code=201)
def realestate_interest(data: RealEstateInterestIn, db: Session = Depends(get_db)):
    """Join the invest waitlist for a property. The vertical is COMING SOON —
    this records demand (and the VoltexAI Pay rail) rather than charging, until
    the MOUs with property partners and regulators are signed."""
    from ..models import RealEstateInterest
    prop = realestate_data.get_property(data.property_id)
    if not prop:
        raise HTTPException(404, "Unknown property")
    row = RealEstateInterest(email=(str(data.email).lower() if data.email else None),
                             property_id=data.property_id, amount_usd=data.amount_usd,
                             provider=data.provider, country=data.country)
    db.add(row)
    db.commit()
    # best-effort confirmation email
    if data.email:
        try:
            from ..services import email_service
            body = (f"You're on the VoltexAI Real Estate waitlist for "
                    f"<b>{prop['name']}</b> ({prop['city']}, {prop['country']}). "
                    "Fractional property investment launches once our MOUs with property "
                    "partners and regulators are signed — you'll be first to invest through "
                    "VoltexAI Pay.")
            email_service.send_email(
                str(data.email), "You're on the VoltexAI Real Estate waitlist",
                email_service._wrap("Waitlist confirmed", body,
                                    "Explore VoltexAI", f"{settings.FRONTEND_URL}/real-estate"),
                text="You're on the VoltexAI Real Estate waitlist. We'll be in touch at launch.")
        except Exception:
            pass
    return {"ok": True, "status": "coming_soon", "property": prop["name"],
            "message": "You're on the waitlist — we'll notify you the moment it goes live."}


@router.get("/api/pay")
def pay():
    return pay_overview()


@router.get("/api/gamification/me")
def my_gamification(user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return gamification.profile(db, user)
