"""
VoltexAI - Subscription management helpers
Shared logic invoked by both Stripe and Flutterwave webhooks.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..models import User, Subscription, PlanTier, SubStatus, Provider


def activate_plan(db: Session, user_id: int, plan: str, provider: str,
                  external_id: str | None = None, period_days: int = 30) -> Subscription:
    plan_enum = PlanTier(plan)
    provider_enum = Provider(provider)
    sub = (db.query(Subscription)
             .filter(Subscription.user_id == user_id).first())
    if not sub:
        sub = Subscription(user_id=user_id)
        db.add(sub)
    sub.plan = plan_enum
    sub.status = SubStatus.ACTIVE
    sub.provider = provider_enum
    sub.external_id = external_id
    sub.current_period_end = datetime.utcnow() + timedelta(days=period_days)
    sub.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return sub


def downgrade_to_free(db: Session, user_id: int, reason: str = "cancelled") -> Subscription:
    sub = (db.query(Subscription)
             .filter(Subscription.user_id == user_id).first())
    if not sub:
        return None
    sub.plan = PlanTier.FREE
    sub.status = SubStatus.CANCELLED if reason == "cancelled" else SubStatus.EXPIRED
    sub.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return sub


def get_or_create_free(db: Session, user: User) -> Subscription:
    if user.subscription:
        return user.subscription
    sub = Subscription(user_id=user.id, plan=PlanTier.FREE, status=SubStatus.ACTIVE,
                       provider=Provider.NONE)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub
