"""
Voltex affiliate / referral engine.

- Every user can claim a referral code + share link.
- Clicks, signups and conversions are tracked per code.
- When a referred person converts (buys VIP / a paid plan), the referrer is
  credited a commission (a share of Stars, or a USD amount).
"""
from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import ReferralAccount, Referral, User

logger = logging.getLogger(__name__)

STAR_COMMISSION = 0.20      # 20% of Stars paid goes to the referrer
USD_COMMISSION = 0.20       # 20% of a paid-plan value


def _b36(n: int) -> str:
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    out = ""
    n = max(0, n)
    while True:
        n, r = divmod(n, 36)
        out = chars[r] + out
        if n == 0:
            break
    return out


def account_for(db: Session, user: User) -> ReferralAccount:
    acc = db.query(ReferralAccount).filter(ReferralAccount.user_id == user.id).first()
    if not acc:
        acc = ReferralAccount(user_id=user.id, code=f"VX{_b36(user.id).zfill(4)}")
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc


def _acc_by_code(db: Session, code: str) -> ReferralAccount | None:
    if not code:
        return None
    return db.query(ReferralAccount).filter(ReferralAccount.code == code.upper()).first()


def track_click(db: Session, code: str) -> bool:
    acc = _acc_by_code(db, code)
    if not acc:
        return False
    acc.clicks += 1
    db.commit()
    return True


def attribute(db: Session, code: str, *, referred_user_id: int | None = None,
              referred_telegram_id: int | None = None) -> Referral | None:
    """Create a pending referral when someone signs up / starts the bot with a code."""
    acc = _acc_by_code(db, code)
    if not acc:
        return None
    # a user can't refer themselves
    if referred_user_id and referred_user_id == acc.user_id:
        return None
    q = db.query(Referral).filter(Referral.code == acc.code)
    if referred_user_id:
        if q.filter(Referral.referred_user_id == referred_user_id).first():
            return None
    elif referred_telegram_id:
        if q.filter(Referral.referred_telegram_id == referred_telegram_id).first():
            return None
    else:
        return None
    ref = Referral(code=acc.code, referrer_user_id=acc.user_id,
                   referred_user_id=referred_user_id,
                   referred_telegram_id=referred_telegram_id, status="pending")
    db.add(ref)
    acc.signups += 1
    db.commit()
    db.refresh(ref)
    return ref


def qualify(db: Session, *, referred_user_id: int | None = None,
            referred_telegram_id: int | None = None,
            stars: int = 0, usd: float = 0.0, note: str | None = None) -> Referral | None:
    """Mark a pending referral as qualified and credit the referrer's commission."""
    q = db.query(Referral).filter(Referral.status == "pending")
    if referred_user_id:
        ref = q.filter(Referral.referred_user_id == referred_user_id).first()
    elif referred_telegram_id:
        ref = q.filter(Referral.referred_telegram_id == referred_telegram_id).first()
    else:
        ref = None
    if not ref:
        return None
    ref.reward_stars = int(stars * STAR_COMMISSION)
    ref.reward_usd = round(usd * USD_COMMISSION, 2)
    ref.status = "qualified"
    ref.qualified_at = datetime.utcnow()
    ref.note = note
    acc = db.query(ReferralAccount).filter(ReferralAccount.user_id == ref.referrer_user_id).first()
    if acc:
        acc.conversions += 1
        acc.earned_stars += ref.reward_stars
        acc.earned_usd = round(acc.earned_usd + ref.reward_usd, 2)
    db.commit()
    logger.info("Referral qualified: referrer=%s reward=%s⭐/$%.2f",
                ref.referrer_user_id, ref.reward_stars, ref.reward_usd)
    return ref


def stats(db: Session, user: User, site: str = "https://voltexai.vercel.app") -> dict:
    acc = account_for(db, user)
    recent = (db.query(Referral).filter(Referral.referrer_user_id == user.id)
              .order_by(Referral.created_at.desc()).limit(20).all())
    return {
        "code": acc.code,
        "link": f"{site}/?ref={acc.code}",
        "telegram_link": f"https://t.me/VoltexAIForexBot?start={acc.code}",
        "clicks": acc.clicks, "signups": acc.signups, "conversions": acc.conversions,
        "earned_stars": acc.earned_stars, "earned_usd": acc.earned_usd,
        "commission": f"{int(STAR_COMMISSION * 100)}%",
        "referrals": [{
            "status": r.status, "reward_stars": r.reward_stars, "reward_usd": r.reward_usd,
            "via": "telegram" if r.referred_telegram_id else "web",
            "created_at": r.created_at.isoformat(),
        } for r in recent],
    }


def leaderboard(db: Session, limit: int = 10) -> list[dict]:
    rows = (db.query(ReferralAccount).order_by(ReferralAccount.conversions.desc(),
            ReferralAccount.earned_stars.desc()).limit(limit).all())
    return [{"code": a.code, "conversions": a.conversions, "earned_stars": a.earned_stars}
            for a in rows if a.conversions > 0]
