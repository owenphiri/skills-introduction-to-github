"""
VoltexAI - KYC routes
GET  /api/kyc/status                - current user's verification status
POST /api/kyc/submit                - submit / resubmit identity details
GET  /api/kyc/pending               - (admin) list submissions awaiting review
POST /api/kyc/{user_id}/decision    - (admin) approve or reject

KYC is optional by default. Set REQUIRE_KYC_FOR_LIVE=true to block live-money
trading until a user is approved (paper trading stays open to everyone).
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole, KycRecord, KycStatus
from ..middleware.auth_middleware import get_current_user
from ..services import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kyc", tags=["kyc"])


class KycSubmitIn(BaseModel):
    full_legal_name: str = Field(min_length=2, max_length=160)
    date_of_birth: str | None = None
    country: str | None = None
    document_type: str = Field(default="national_id",
                               pattern="^(passport|national_id|drivers_license)$")
    document_number: str | None = Field(default=None, max_length=80)
    document_url: str | None = Field(default=None, max_length=500)


class KycDecisionIn(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: str | None = Field(default=None, max_length=300)


def _record_dict(rec: KycRecord | None) -> dict:
    if not rec:
        return {"status": "none", "submitted": False}
    return {
        "status": rec.status.value, "submitted": True,
        "full_legal_name": rec.full_legal_name, "country": rec.country,
        "document_type": rec.document_type,
        "reject_reason": rec.reject_reason,
        "submitted_at": rec.submitted_at.isoformat(),
        "reviewed_at": rec.reviewed_at.isoformat() if rec.reviewed_at else None,
    }


def _require_admin(user: User):
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")


def get_kyc_status(db: Session, user: User) -> str:
    rec = db.query(KycRecord).filter(KycRecord.user_id == user.id).first()
    return rec.status.value if rec else "none"


@router.get("/status")
def status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rec = db.query(KycRecord).filter(KycRecord.user_id == user.id).first()
    return _record_dict(rec)


@router.post("/submit")
def submit(data: KycSubmitIn, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    rec = db.query(KycRecord).filter(KycRecord.user_id == user.id).first()
    if rec and rec.status == KycStatus.APPROVED:
        raise HTTPException(409, "Your identity is already verified")
    if not rec:
        rec = KycRecord(user_id=user.id)
        db.add(rec)
    rec.status = KycStatus.PENDING
    rec.full_legal_name = data.full_legal_name
    rec.date_of_birth = data.date_of_birth
    rec.country = data.country or user.country
    rec.document_type = data.document_type
    rec.document_number = data.document_number
    rec.document_url = data.document_url
    rec.reject_reason = None
    rec.submitted_at = datetime.utcnow()
    rec.reviewed_at = None
    db.commit()
    db.refresh(rec)
    email_service.send_kyc_status_email(user.email, user.full_name, "pending")
    return _record_dict(rec)


@router.get("/pending")
def pending(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    recs = db.query(KycRecord).filter(KycRecord.status == KycStatus.PENDING).all()
    return {"count": len(recs),
            "submissions": [{**_record_dict(r), "user_id": r.user_id} for r in recs]}


@router.post("/{user_id}/decision")
def decision(user_id: int, data: KycDecisionIn,
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    rec = db.query(KycRecord).filter(KycRecord.user_id == user_id).first()
    if not rec:
        raise HTTPException(404, "No KYC submission for that user")
    rec.status = KycStatus.APPROVED if data.decision == "approve" else KycStatus.REJECTED
    rec.reject_reason = data.reason if data.decision == "reject" else None
    rec.reviewed_at = datetime.utcnow()
    db.commit()
    target = db.query(User).filter(User.id == user_id).first()
    if target:
        email_service.send_kyc_status_email(target.email, target.full_name,
                                            rec.status.value)
    return _record_dict(rec)
