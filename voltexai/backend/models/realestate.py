"""
VoltexAI Real Estate — invest-interest waitlist.

Until the property vertical launches (post-MOU), the Invest flow captures
demand rather than charging: each row is a prospective investor's interest in a
specific deal, with the amount and rail they'd use through VoltexAI Pay.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float
from ..database import Base


class RealEstateInterest(Base):
    __tablename__ = "realestate_interest"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)      # null for logged-out signups
    email = Column(String(255), nullable=True, index=True)
    property_id = Column(String(60), nullable=False, index=True)
    amount_usd = Column(Float, nullable=False, default=0.0)
    provider = Column(String(20), nullable=True)              # intended Pay rail
    country = Column(String(60), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
