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
    topic: str | None = Field(default=None, max_length=60)   # e.g. signal:XAUUSD


def _first_name(u: User) -> str:
    return (u.full_name or u.email.split("@")[0]).split()[0]


def _post_dict(p: Post) -> dict:
    return {"id": p.id, "author": p.author, "country": p.country or "Global",
            "flag": _FLAGS.get(p.country or "Global", "🌍"), "body": p.body,
            "topic": p.topic, "likes": p.likes,
            "created_at": p.created_at.isoformat(), "real": True}


@router.get("/feed")
def feed(limit: int = 30, topic: str = None, db: Session = Depends(get_db)):
    """Global wall (topic omitted) mixes real posts with seed welcome posts.
    A `topic` (e.g. signal:XAUUSD) returns just that thread's real posts."""
    q = db.query(Post).order_by(Post.created_at.desc())
    if topic:
        rows = q.filter(Post.topic == topic).limit(limit).all()
        real = [_post_dict(p) for p in rows]
        return {"count": len(real), "posts": real, "topic": topic}
    rows = q.filter(Post.topic.is_(None)).limit(limit).all()
    real = [_post_dict(p) for p in rows]
    seed = [{"id": f"seed-{i}", **s, "real": False} for i, s in enumerate(SEED_POSTS)]
    return {"count": len(real) + len(seed), "posts": real + seed}


@router.post("/posts", status_code=201)
def create_post(data: PostIn, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    p = Post(user_id=user.id, author=_first_name(user), country=user.country,
             body=data.body.strip(), topic=(data.topic or None), likes=0)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _post_dict(p)


@router.post("/posts/{post_id}/like")
def like_post(post_id: int, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    p = db.query(Post).filter(Post.id == post_id).first()
    if not p:
        raise HTTPException(404, "Post not found")
    p.likes += 1
    db.commit()
    return {"id": p.id, "likes": p.likes}
