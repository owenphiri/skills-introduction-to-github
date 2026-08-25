"""Voltex Telegram subscribers — VIP access purchased with Telegram Stars."""
from datetime import datetime

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Boolean

from ..database import Base


class TelegramSubscriber(Base):
    __tablename__ = "telegram_subscribers"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(64), nullable=True)
    first_name = Column(String(80), nullable=True)
    vip_until = Column(DateTime, nullable=True)          # None = no active VIP
    plan = Column(String(24), nullable=True)
    stars_paid = Column(Integer, nullable=False, default=0)
    is_recurring = Column(Boolean, nullable=False, default=False)
    last_charge_id = Column(String(128), nullable=True)
    expired_notified = Column(Boolean, nullable=False, default=False)  # renewal DM sent after lapse
    ref_code = Column(String(32), nullable=True)                        # referral code they joined with
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)
