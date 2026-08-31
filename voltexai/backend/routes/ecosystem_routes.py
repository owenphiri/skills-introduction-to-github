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
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..middleware.auth_middleware import get_current_user
from ..data.products import ecosystem
from ..data import academy as academy_data
from ..data.store import list_products, CATEGORIES
from ..data.pay import pay_overview
from ..data import geo
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


@router.get("/api/pay")
def pay():
    return pay_overview()


@router.get("/api/gamification/me")
def my_gamification(user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return gamification.profile(db, user)
