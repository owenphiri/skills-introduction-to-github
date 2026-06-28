"""
VoltexAI - Auth middleware
get_current_user dependency for protected routes.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError

from ..database import get_db
from ..services.auth_service import decode_token
from ..models import User, PlanTier

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Missing access token")
    try:
        payload = decode_token(token, expected_type="access")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")
    return user


def get_current_user_optional(token: str = Depends(oauth2_scheme),
                              db: Session = Depends(get_db)) -> User | None:
    """For endpoints that work for both anon and logged-in users."""
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None


def require_plan(*allowed: PlanTier):
    """Dependency factory: require_plan(PlanTier.TRADER, PlanTier.ELITE)."""
    def _checker(user: User = Depends(get_current_user)) -> User:
        plan = user.subscription.plan if user.subscription else PlanTier.FREE
        if plan not in allowed:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Plan upgrade required. Current: {plan.value}",
            )
        return user
    return _checker
