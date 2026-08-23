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


@router.get("/api/store")
def store(category: str = Query("all")):
    return {"categories": CATEGORIES, "products": list_products(category)}


@router.get("/api/pay")
def pay():
    return pay_overview()


@router.get("/api/gamification/me")
def my_gamification(user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return gamification.profile(db, user)
