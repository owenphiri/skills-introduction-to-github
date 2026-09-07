"""
Voltex Results routes — the global "how clients are killing the markets" wall.
GET  /api/results/feed            - public feed (real posts + seed wins)
POST /api/results                 - post your result (auth)
POST /api/results/{id}/like       - like a result (auth)

Client-submitted content. Text is length-capped; an optional screenshot URL must
be http(s). Posts start unverified; an admin can verify genuine wins later.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, ResultPost
from ..middleware.auth_middleware import get_current_user
from ..data.results import SEED_RESULTS, flag

router = APIRouter(prefix="/api/results", tags=["results"])

_MARKETS = {"forex", "metals", "energy", "indices", "crypto", "stocks", "synthetics", "futures"}


class ResultIn(BaseModel):
    body: str = Field(min_length=4, max_length=600)
    symbol: str | None = Field(default=None, max_length=24)
    market: str | None = Field(default=None, max_length=24)
    timeframe: str | None = Field(default=None, max_length=12)
    pnl_pct: float | None = Field(default=None, ge=-100, le=100000)
    pnl_amount: float | None = Field(default=None, ge=-1e9, le=1e12)
    currency: str | None = Field(default="USD", max_length=8)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("image_url")
    @classmethod
    def _url_ok(cls, v):
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("image_url must start with http:// or https://")
        return v

    @field_validator("market")
    @classmethod
    def _market_ok(cls, v):
        if v and v.lower() not in _MARKETS:
            return None
        return v.lower() if v else v


def _first_name(u: User) -> str:
    return (u.full_name or u.email.split("@")[0]).split()[0]


def _dict(r: ResultPost) -> dict:
    return {
        "id": r.id, "author": r.author, "country": r.country or "Global",
        "flag": flag(r.country), "symbol": r.symbol, "market": r.market,
        "timeframe": r.timeframe, "pnl_pct": r.pnl_pct, "pnl_amount": r.pnl_amount,
        "currency": r.currency, "body": r.body, "image_url": r.image_url,
        "verified": r.verified, "likes": r.likes,
        "created_at": r.created_at.isoformat(), "real": True,
    }


@router.get("/feed")
def feed(limit: int = 40, market: str = None, verified: bool = False,
         db: Session = Depends(get_db)):
    """Real client wins first, then seed wins to keep the wall alive.
    `verified=true` returns only verified wins (used by the landing marquee)."""
    q = db.query(ResultPost)
    if market:
        q = q.filter(ResultPost.market == market.lower())
    if verified:
        q = q.filter(ResultPost.verified.is_(True))
    rows = q.order_by(ResultPost.verified.desc(), ResultPost.created_at.desc()).limit(limit).all()
    real = [_dict(r) for r in rows]
    seed = [{"id": f"seed-{i}", **s, "flag": flag(s.get("country")), "likes": 0,
             "created_at": None, "real": False}
            for i, s in enumerate(SEED_RESULTS)
            if (not market or s.get("market") == market.lower())
            and (not verified or s.get("verified"))]
    return {"count": len(real) + len(seed), "posts": real + seed}


@router.post("", status_code=201)
def create_result(data: ResultIn, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    r = ResultPost(
        user_id=user.id, author=_first_name(user), country=getattr(user, "country", None),
        symbol=(data.symbol or None), market=(data.market or None),
        timeframe=(data.timeframe or None), pnl_pct=data.pnl_pct,
        pnl_amount=data.pnl_amount, currency=(data.currency or "USD"),
        body=data.body.strip(), image_url=(data.image_url or None),
        verified=False, likes=0)
    db.add(r)
    db.commit()
    db.refresh(r)
    return _dict(r)


@router.post("/{result_id}/like")
def like_result(result_id: int, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    r = db.query(ResultPost).filter(ResultPost.id == result_id).first()
    if not r:
        raise HTTPException(404, "Result not found")
    r.likes += 1
    db.commit()
    return {"id": r.id, "likes": r.likes}
