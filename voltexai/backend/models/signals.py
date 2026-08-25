"""Voltex Signals SaaS — managed signals + their lifecycle events."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, Boolean

from ..database import Base


class ProSignal(Base):
    __tablename__ = "pro_signals"

    id = Column(Integer, primary_key=True, index=True)
    signal_uuid = Column(String(64), unique=True, index=True, nullable=False)
    symbol = Column(String(32), nullable=False, index=True)
    direction = Column(String(8), nullable=False)         # buy | sell
    timeframe = Column(String(8), nullable=True)
    entry = Column(Float, nullable=False)
    sl = Column(Float, nullable=False)
    tp1 = Column(Float, nullable=True)
    tp2 = Column(Float, nullable=True)
    tp3 = Column(Float, nullable=True)
    tp4 = Column(Float, nullable=True)
    risk_reward = Column(Float, nullable=True)
    quality_score = Column(Float, nullable=False, default=0)
    grade = Column(String(8), nullable=False, default="B")
    strategy = Column(String(80), nullable=True)
    session = Column(String(32), nullable=True)
    tier = Column(String(8), nullable=False, default="vip")   # free | vip
    status = Column(String(16), nullable=False, default="active", index=True)
    result_r = Column(Float, nullable=True)                    # realised R when closed
    published = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class ProSignalEvent(Base):
    __tablename__ = "pro_signal_events"

    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, ForeignKey("pro_signals.id"), nullable=False, index=True)
    event = Column(String(32), nullable=False)   # filled | tp1 | tp2 | tp3 | tp4 | be | closed | cancelled
    price = Column(Float, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
