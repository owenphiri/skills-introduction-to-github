"""Payment ledger - records every charge attempt for audit + reconciliation."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum
from ..database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String(20), nullable=False)        # stripe | flutterwave
    provider_ref = Column(String(255), index=True, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False)         # USD | ZMW | NGN | KES
    plan = Column(String(20), nullable=False)            # trader | elite
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    method = Column(String(40), nullable=True)           # card | mobile_money_zm_mtn | ...
    raw_payload = Column(String(4000), nullable=True)    # truncated webhook payload
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="payments")
