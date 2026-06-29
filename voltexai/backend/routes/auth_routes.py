"""
VoltexAI - Auth routes
POST /api/auth/register     - create account
POST /api/auth/login        - email + password -> access + refresh tokens
POST /api/auth/refresh      - swap refresh token for new access token
POST /api/auth/logout       - client-side token discard (stateless JWT)
GET  /api/auth/me           - current user profile + subscription
POST /api/auth/forgot       - email a reset token
POST /api/auth/reset        - submit reset token + new password
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from jose import JWTError

from ..database import get_db
from ..models import User
from ..services.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, create_reset_token,
    create_verification_token, decode_token,
)
from ..services.subscription_service import get_or_create_free
from ..services import email_service
from ..middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    country: str | None = None
    phone: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class MeOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    country: str | None
    phone: str | None
    plan: str
    plan_status: str
    is_verified: bool
    created_at: datetime


def _user_to_me(user: User) -> MeOut:
    sub = user.subscription
    return MeOut(
        id=user.id, email=user.email, full_name=user.full_name,
        country=user.country, phone=user.phone,
        plan=(sub.plan.value if sub else "free"),
        plan_status=(sub.status.value if sub else "active"),
        is_verified=user.is_verified, created_at=user.created_at,
    )


def _issue_tokens(user: User) -> TokenPair:
    plan = user.subscription.plan.value if user.subscription else "free"
    return TokenPair(
        access_token=create_access_token(user.id, user.email, plan),
        refresh_token=create_refresh_token(user.id),
    )


# ---------- routes ----------
@router.post("/register", response_model=TokenPair, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(409, "Email already registered")
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        country=data.country,
        phone=data.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    get_or_create_free(db, user)
    db.refresh(user)
    # fire-and-forget transactional emails (best-effort)
    try:
        email_service.send_verification_email(
            user.email, user.full_name, create_verification_token(user.id))
        email_service.send_welcome_email(user.email, user.full_name)
    except Exception:
        pass
    return _issue_tokens(user)


class VerifyIn(BaseModel):
    token: str


@router.post("/verify")
def verify_email(data: VerifyIn, db: Session = Depends(get_db)):
    try:
        payload = decode_token(data.token, expected_type="verify")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(400, "Invalid or expired verification token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_verified = True
    db.commit()
    return {"message": "Email verified", "is_verified": True}


@router.post("/login", response_model=TokenPair)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account disabled")
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
def refresh(data: RefreshIn, db: Session = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token, expected_type="refresh")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid refresh token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return _issue_tokens(user)


@router.post("/logout", status_code=204)
def logout(_: User = Depends(get_current_user)):
    # Stateless JWT - the client discards tokens. For revocation in production,
    # maintain a denylist keyed by jti in Redis.
    return


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return _user_to_me(user)


@router.post("/forgot", status_code=202)
def forgot_password(data: ForgotIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    # Always 202 to avoid email enumeration
    if user:
        token = create_reset_token(user.id)
        email_service.send_password_reset_email(user.email, token)
    return {"message": "If that email exists, a reset link has been sent"}


@router.post("/reset", status_code=200)
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    try:
        payload = decode_token(data.token, expected_type="reset")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(400, "Invalid or expired reset token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated"}
