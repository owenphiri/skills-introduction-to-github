"""Voltex affiliate / referral system."""
from datetime import datetime

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Float, ForeignKey

from ..database import Base


class ReferralAccount(Base):
    """One per user — their affiliate code and running totals."""
    __tablename__ = "referral_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    clicks = Column(Integer, nullable=False, default=0)
    signups = Column(Integer, nullable=False, default=0)
    conversions = Column(Integer, nullable=False, default=0)
    earned_stars = Column(Integer, nullable=False, default=0)
    earned_usd = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Referral(Base):
    """A single referred person and its status."""
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), index=True, nullable=False)
    referrer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    referred_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)      # web signup
    referred_telegram_id = Column(BigInteger, nullable=True, index=True)            # bot start
    status = Column(String(12), nullable=False, default="pending")                 # pending | qualified
    reward_stars = Column(Integer, nullable=False, default=0)
    reward_usd = Column(Float, nullable=False, default=0.0)
    note = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    qualified_at = Column(DateTime, nullable=True)
