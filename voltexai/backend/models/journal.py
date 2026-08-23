"""Voltex Trade Journal — per-user logged trades."""
from datetime import datetime, date

from sqlalchemy import Column, Integer, String, DateTime, Date, Float, ForeignKey, Text

from ..database import Base


class JournalTrade(Base):
    __tablename__ = "journal_trades"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String(32), nullable=False)
    side = Column(String(8), nullable=False)          # buy | sell
    entry = Column(Float, nullable=False)
    exit = Column(Float, nullable=True)
    size = Column(Float, nullable=False, default=1.0)  # lots / units
    pnl = Column(Float, nullable=False, default=0.0)   # realised P&L in account ccy
    rr = Column(Float, nullable=True)                  # realised R multiple
    setup = Column(String(60), nullable=True)          # e.g. "SMC", "Breakout"
    trade_date = Column(Date, nullable=False, default=date.today, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
