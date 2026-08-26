"""Subscription model - one per user."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum
from ..database import Base


class PlanTier(str, enum.Enum):
    FREE = "free"        # $0
    STARTER = "starter"  # $19/mo
    TRADER = "trader"    # $49/mo
    PRO = "pro"          # $99/mo
    ELITE = "elite"      # $199/mo

    @property
    def rank(self) -> int:
        """Ladder position — higher unlocks everything below it."""
        return _PLAN_RANK[self]

    def at_least(self, other: "PlanTier") -> bool:
        return self.rank >= other.rank


_PLAN_RANK = {
    PlanTier.FREE: 0,
    PlanTier.STARTER: 1,
    PlanTier.TRADER: 2,
    PlanTier.PRO: 3,
    PlanTier.ELITE: 4,
}


class SubStatus(str, enum.Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class Provider(str, enum.Enum):
    NONE = "none"
    STRIPE = "stripe"
    FLUTTERWAVE = "flutterwave"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    plan = Column(SAEnum(PlanTier), default=PlanTier.FREE, nullable=False)
    status = Column(SAEnum(SubStatus), default=SubStatus.ACTIVE, nullable=False)
    provider = Column(SAEnum(Provider), default=Provider.NONE, nullable=False)
    external_id = Column(String(255), nullable=True)  # stripe sub id / flw subscription id
    current_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="subscription")
