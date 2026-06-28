"""
VoltexAI - Trading models (execution engine)
A simple, safe cash account that supports both long and short positions via a
signed position quantity. Used by the built-in PaperBroker. When the Alpaca
broker is active these tables are bypassed and state lives at the broker.

Net liquidation value (equity) = cash + Σ(position.qty * current_price), which is
correct for both longs (qty > 0) and shorts (qty < 0).
"""
from datetime import datetime
import enum

from sqlalchemy import (Column, Integer, String, DateTime, ForeignKey, Float,
                        Enum as SAEnum)
from sqlalchemy.orm import relationship

from ..database import Base


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"        # limit order waiting to fill
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    broker = Column(String(20), default="paper", nullable=False)
    currency = Column(String(8), default="USD", nullable=False)
    cash_balance = Column(Float, nullable=False)
    starting_balance = Column(Float, nullable=False)
    realized_pnl = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    positions = relationship("Position", back_populates="account",
                             cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="account",
                          cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("broker_accounts.id"), nullable=False)
    symbol = Column(String(20), index=True, nullable=False)
    qty = Column(Float, default=0.0, nullable=False)          # signed: + long, - short
    avg_price = Column(Float, default=0.0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("BrokerAccount", back_populates="positions")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("broker_accounts.id"), nullable=False)
    symbol = Column(String(20), index=True, nullable=False)
    side = Column(SAEnum(OrderSide), nullable=False)
    type = Column(SAEnum(OrderType), default=OrderType.MARKET, nullable=False)
    qty = Column(Float, nullable=False)
    limit_price = Column(Float, nullable=True)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    filled_price = Column(Float, nullable=True)
    realized_pnl = Column(Float, default=0.0, nullable=False)   # P&L booked by this fill
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    filled_at = Column(DateTime, nullable=True)

    account = relationship("BrokerAccount", back_populates="orders")
