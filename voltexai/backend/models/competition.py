"""Voltex Competition — contest entry record (leaderboard is computed from these)."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float

from ..database import Base


class ContestEntry(Base):
    __tablename__ = "contest_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contest_id = Column(String(40), index=True, nullable=False)
    start_equity = Column(Float, nullable=False)      # paper equity snapshot at join
    start_realized = Column(Float, nullable=False, default=0.0)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
