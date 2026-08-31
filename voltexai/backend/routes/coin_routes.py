"""
Voltex Coin routes
GET  /api/coin/info      - public: what VXC is + dual-protocol (BTC/ETH) roadmap
GET  /api/coin/wallet    - auth: balance, value, earn ways, history, chain info
POST /api/coin/checkin   - auth: claim the once-a-day check-in reward
POST /api/coin/redeem    - auth: spend VXC for in-app credit
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..services import voltex_coin_service as coin
from ..middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/coin", tags=["voltex-coin"])


class RedeemIn(BaseModel):
    amount: int = Field(gt=0, le=1_000_000)
    purpose: str = Field(default="wallet_credit", max_length=60)


@router.get("/info")
def coin_info():
    """Public 'what is Voltex Coin' payload — the utility model, the peg, and the
    Bitcoin + Ethereum protocol roadmap. Safe to show to logged-out visitors."""
    return {
        "chain": coin.CHAIN_INFO,
        "peg_vxc_per_usd": coin.VXC_PER_USD,
        "cashback_pct": coin.PURCHASE_CASHBACK_PCT,
        "max_redeem_pct": coin.MAX_REDEEM_PCT,
        "earn_rules": coin.EARN_RULES,
        "benefits": [
            "Earn while you learn and trade — no crypto knowledge needed to start.",
            "Cashback in VXC on every plan or store purchase, boosted for Pro & Elite.",
            "Redeem coins for real discounts on subscriptions, courses and tools.",
            "Referral rewards: earn VXC every time a friend joins the ecosystem.",
            "One balance, chain-ready: built to bridge to Ethereum (ERC-20) and "
            "Bitcoin, so tomorrow it can move to a wallet you fully own.",
        ],
    }


@router.get("/wallet")
def get_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return coin.wallet(db, user)


@router.post("/checkin")
def checkin(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return coin.daily_checkin(db, user.id)


@router.post("/redeem")
def redeem(data: RedeemIn, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    result = coin.redeem(db, user.id, data.amount, reason=f"redeem:{data.purpose}")
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "redeem failed"))
    return result
