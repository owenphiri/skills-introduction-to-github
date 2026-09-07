"""Voltex Results — client wins posted from across the globe."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean

from ..database import Base


class ResultPost(Base):
    __tablename__ = "result_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author = Column(String(80), nullable=False)
    country = Column(String(60), nullable=True)
    symbol = Column(String(24), nullable=True)          # e.g. XAUUSD, V75
    market = Column(String(24), nullable=True)          # asset class label
    timeframe = Column(String(12), nullable=True)
    pnl_pct = Column(Float, nullable=True)              # % gain (e.g. 12.5)
    pnl_amount = Column(Float, nullable=True)           # absolute gain
    currency = Column(String(8), default="USD", nullable=False)
    body = Column(Text, nullable=False)                # the trader's story
    image_url = Column(String(500), nullable=True)     # screenshot (optional)
    verified = Column(Boolean, default=False, nullable=False)
    likes = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
