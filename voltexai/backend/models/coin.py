"""
Voltex Coin (VXC) — utility & rewards ledger.

VXC is an in-ecosystem utility credit, not a security or an on-chain asset (yet).
Every earn/redeem is an append-only ledger row, so a user's balance is always the
sum of their entries — auditable and tamper-evident. The schema is deliberately
"chain-ready": `decimals`-style integer accounting (we store whole VXC),
plus an optional `chain_ref` slot so a future on-chain bridge (ERC-20 on
Ethereum/EVM, or a wrapped/Lightning representation on Bitcoin) can stamp the
tx hash against the same ledger without a migration.
"""
from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from ..database import Base


class CoinEntryKind(str, enum.Enum):
    EARN = "earn"        # rewarded to the user
    REDEEM = "redeem"    # spent by the user (negative amount)
    ADJUST = "adjust"    # admin correction (can be +/-)


class CoinTransaction(Base):
    __tablename__ = "coin_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    kind = Column(SAEnum(CoinEntryKind), nullable=False)
    reason = Column(String(60), nullable=False)          # e.g. signup_bonus, daily_checkin
    amount = Column(Integer, nullable=False)             # whole VXC; negative for redeem
    balance_after = Column(Integer, nullable=False)      # snapshot for fast display/audit
    ref = Column(String(120), nullable=True)             # link to a payment/journal/etc.
    chain_ref = Column(String(120), nullable=True)       # reserved: on-chain tx hash (future)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
