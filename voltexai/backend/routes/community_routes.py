"""
Voltex Community routes — the global trader wall.
GET  /api/community/feed        - public feed (real posts + seed welcome posts)
POST /api/community/posts       - create a post (auth)
POST /api/community/posts/{id}/like - like a post (auth)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Post
from ..middleware.auth_middleware import get_current_user
from ..data.community import SEED_POSTS

router = APIRouter(prefix="/api/community", tags=["community"])

# rough country -> flag for real posts
_FLAGS = {"Zambia": "🇿🇲", "Nigeria": "🇳🇬", "Kenya": "🇰🇪", "Ghana": "🇬🇭",
          "South Africa": "🇿🇦", "Uganda": "🇺🇬", "Tanzania": "🇹🇿",
          "United Kingdom": "🇬🇧", "UAE": "🇦🇪", "Global": "🌍"}


class PostIn(BaseModel):
    body: str = Field(min_length=2, max_length=500)


def _first_name(u: User) -> str:
    return (u.full_name or u.email.split("@")[0]).split()[0]


@router.get("/feed")
def feed(limit: int = 30, db: Session = Depends(get_db)):
    rows = (db.query(Post).order_by(Post.created_at.desc()).limit(limit).all())
    real = [{"id": p.id, "author": p.author, "country": p.country or "Global",
             "flag": _FLAGS.get(p.country or "Global", "🌍"), "body": p.body,
             "likes": p.likes, "created_at": p.created_at.isoformat(), "real": True}
            for p in rows]
    seed = [{"id": f"seed-{i}", **s, "real": False} for i, s in enumerate(SEED_POSTS)]
    return {"count": len(real) + len(seed), "posts": real + seed}


@router.post("/posts", status_code=201)
def create_post(data: PostIn, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    p = Post(user_id=user.id, author=_first_name(user), country=user.country,
             body=data.body.strip(), likes=0)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "author": p.author, "country": p.country or "Global",
            "flag": _FLAGS.get(p.country or "Global", "🌍"), "body": p.body,
            "likes": 0, "created_at": p.created_at.isoformat(), "real": True}


@router.post("/posts/{post_id}/like")
def like_post(post_id: int, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "Post not found")
    p.likes += 1
    db.commit()
    return {"id": p.id, "likes": p.likes}
