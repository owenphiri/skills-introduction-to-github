"""
Voltex Coin (VXC) service — the earn/redeem engine behind the rewards ledger.

Design principles
  * Ledger is truth: balance = SUM(amount) for a user. `balance_after` is a
    cached snapshot for display only.
  * Best-effort awards never break the request that triggered them.
  * Chain-ready: VXC is quoted with a fixed display peg and an ERC-20-style
    metadata block so a later on-chain bridge (Ethereum + Bitcoin) is additive.

Peg (display only): VXC_PER_USD whole coins == $1 of in-app value. This is a
loyalty-point rate, NOT a market price or a promise of redemption for cash.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, date
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import User, CoinTransaction, CoinEntryKind

logger = logging.getLogger(__name__)

# ---- economics (display peg + earn rules) ----
VXC_PER_USD = 100                    # 100 VXC == $1 of in-app value
PURCHASE_CASHBACK_PCT = 5            # 5% of every purchase back in VXC
MAX_REDEEM_PCT = 30                  # coins can cover up to 30% of a checkout

EARN_RULES: dict[str, int] = {
    "signup_bonus":        500,      # welcome grant
    "verify_email":        200,
    "daily_checkin":       25,
    "journal_trade":       15,       # logging a closed trade
    "academy_lesson":      40,       # completing a lesson
    "referral_signup":     750,      # a friend you referred joins
    "first_purchase":      300,
}

# ---- chain-readiness metadata (informational; no on-chain asset exists yet) ----
CHAIN_INFO = {
    "symbol": "VXC",
    "name": "Voltex Coin",
    "decimals": 18,                  # ERC-20-style precision, reserved for bridge
    "status": "utility_rewards",     # utility_rewards -> testnet -> mainnet (roadmap)
    "peg_vxc_per_usd": VXC_PER_USD,
    "protocols": {
        "ethereum": {
            "standard": "ERC-20",
            "role": "Primary settlement — Voltex Coin is designed to deploy as an "
                    "ERC-20 token on Ethereum/EVM chains, so it works with every "
                    "standard wallet, DEX and DeFi protocol.",
            "status": "planned",
        },
        "bitcoin": {
            "standard": "Wrapped / Lightning",
            "role": "Bitcoin support via a wrapped representation and Lightning "
                    "payments, so VXC can be funded from and settled to BTC — "
                    "combining Bitcoin's security with Ethereum's programmability.",
            "status": "planned",
        },
    },
    "disclaimer": ("Voltex Coin is currently an in-app utility & rewards credit — "
                   "not a security, investment, or on-chain cryptocurrency. Any "
                   "future on-chain launch will be subject to legal review, audit "
                   "and applicable registration."),
}


# ----------------------------- core ledger -----------------------------
def balance(db: Session, user_id: int) -> int:
    total = (db.query(func.coalesce(func.sum(CoinTransaction.amount), 0))
               .filter(CoinTransaction.user_id == user_id).scalar())
    return int(total or 0)


def _record(db: Session, user_id: int, kind: CoinEntryKind, reason: str,
            amount: int, ref: str | None = None) -> CoinTransaction | None:
    if amount == 0:
        return None
    new_balance = balance(db, user_id) + amount
    if new_balance < 0:                          # never let a ledger go negative
        return None
    tx = CoinTransaction(user_id=user_id, kind=kind, reason=reason, amount=amount,
                         balance_after=new_balance, ref=ref)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def _earned_for_reason(db: Session, user_id: int, reason: str) -> bool:
    return db.query(CoinTransaction.id).filter(
        CoinTransaction.user_id == user_id,
        CoinTransaction.reason == reason).first() is not None


def award(db: Session, user_id: int, reason: str, *, amount: int | None = None,
          ref: str | None = None, once: bool = False) -> CoinTransaction | None:
    """Grant VXC for a rule (or an explicit amount). `once=True` makes it
    idempotent per user+reason (e.g. signup bonus). Best-effort — swallows errors."""
    try:
        amt = amount if amount is not None else EARN_RULES.get(reason, 0)
        if amt <= 0:
            return None
        if once and _earned_for_reason(db, user_id, reason):
            return None
        return _record(db, user_id, CoinEntryKind.EARN, reason, amt, ref=ref)
    except Exception:
        logger.exception("VXC award failed (user=%s, reason=%s)", user_id, reason)
        try:
            db.rollback()
        except Exception:
            pass
        return None


def daily_checkin(db: Session, user_id: int) -> dict:
    """One check-in reward per UTC day. Returns the outcome for the API."""
    today = datetime.now(timezone.utc).date()
    last = (db.query(CoinTransaction)
              .filter(CoinTransaction.user_id == user_id,
                      CoinTransaction.reason == "daily_checkin")
              .order_by(CoinTransaction.created_at.desc()).first())
    if last and last.created_at.date() == today:
        return {"claimed": False, "reason": "already_claimed_today",
                "balance": balance(db, user_id)}
    tx = _record(db, user_id, CoinEntryKind.EARN, "daily_checkin",
                 EARN_RULES["daily_checkin"])
    return {"claimed": True, "earned": EARN_RULES["daily_checkin"],
            "balance": tx.balance_after if tx else balance(db, user_id)}


def redeem(db: Session, user_id: int, amount: int, *, reason: str = "redeem",
           ref: str | None = None) -> dict:
    """Spend VXC. Returns {ok, balance, ...}. Never goes negative."""
    if amount <= 0:
        return {"ok": False, "error": "amount must be positive",
                "balance": balance(db, user_id)}
    bal = balance(db, user_id)
    if amount > bal:
        return {"ok": False, "error": "insufficient_balance", "balance": bal}
    tx = _record(db, user_id, CoinEntryKind.REDEEM, reason, -amount, ref=ref)
    return {"ok": True, "spent": amount, "usd_value": round(amount / VXC_PER_USD, 2),
            "balance": tx.balance_after if tx else bal}


# ----------------------------- views -----------------------------
def history(db: Session, user_id: int, limit: int = 25) -> list[dict]:
    rows = (db.query(CoinTransaction)
              .filter(CoinTransaction.user_id == user_id)
              .order_by(CoinTransaction.created_at.desc()).limit(limit).all())
    return [{
        "kind": r.kind.value, "reason": r.reason, "amount": r.amount,
        "balance_after": r.balance_after,
        "at": r.created_at.replace(tzinfo=timezone.utc).isoformat(),
    } for r in rows]


_EARN_WAYS = [
    ("daily_checkin", "Daily check-in", "Open VoltexAI each day"),
    ("journal_trade", "Log a trade", "Record a closed trade in your Journal"),
    ("academy_lesson", "Finish a lesson", "Complete an Academy lesson"),
    ("referral_signup", "Invite a friend", "They join with your referral link"),
    ("first_purchase", "First purchase", "Buy any plan or product once"),
]


def wallet(db: Session, user: User) -> dict:
    bal = balance(db, user.id)
    plan = getattr(getattr(user, "subscription", None), "plan", None)
    plan_name = getattr(plan, "value", "free") if plan else "free"
    # Elite/Pro members earn a boosted cashback — a real perk of the ecosystem.
    boost = {"elite": 2.0, "pro": 1.5, "trader": 1.25}.get(plan_name, 1.0)
    return {
        "symbol": "VXC",
        "balance": bal,
        "usd_value": round(bal / VXC_PER_USD, 2),
        "peg_vxc_per_usd": VXC_PER_USD,
        "cashback_pct": PURCHASE_CASHBACK_PCT,
        "cashback_multiplier": boost,
        "max_redeem_pct": MAX_REDEEM_PCT,
        "earn_ways": [{"reason": r, "label": l, "how": h,
                       "reward": EARN_RULES.get(r, 0)} for r, l, h in _EARN_WAYS],
        "history": history(db, user.id, limit=15),
        "chain": CHAIN_INFO,
    }


def purchase_cashback(db: Session, user_id: int, usd_amount: float,
                      ref: str | None = None) -> CoinTransaction | None:
    """Award % cashback in VXC after a confirmed purchase, with a plan boost."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or usd_amount <= 0:
            return None
        plan = getattr(getattr(user, "subscription", None), "plan", None)
        plan_name = getattr(plan, "value", "free") if plan else "free"
        boost = {"elite": 2.0, "pro": 1.5, "trader": 1.25}.get(plan_name, 1.0)
        coins = int(round(usd_amount * VXC_PER_USD * (PURCHASE_CASHBACK_PCT / 100.0) * boost))
        first = award(db, user_id, "first_purchase", once=True, ref=ref)
        cb = award(db, user_id, "purchase_cashback", amount=coins, ref=ref) if coins > 0 else None
        return cb or first
    except Exception:
        logger.exception("VXC cashback failed (user=%s)", user_id)
        return None
