"""
Voltex admin analytics (admin-only).
GET /api/admin/analytics - deep snapshot: signals performance, subscribers,
                           affiliate program and the RL model.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole
from ..middleware.auth_middleware import get_current_user
from ..services import admin_analytics

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    return user


@router.get("/analytics")
def analytics(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    return admin_analytics.snapshot(db)
