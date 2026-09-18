"""
VoltexAI - mailing routes (newsletter + automated/broadcast email)

POST /api/mailing/subscribe     - join the list (public)
GET  /api/mailing/unsubscribe   - one-click unsubscribe via token (public, returns HTML)
GET  /api/mailing/stats         - list + send stats (admin)
POST /api/mailing/broadcast     - send a one-off to the list (admin)
POST /api/mailing/digest        - trigger the automated weekly digest (admin / cron)
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole
from ..middleware.auth_middleware import get_current_user
from ..services import mailing

router = APIRouter(prefix="/api/mailing", tags=["mailing"])


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    return user


class SubscribeIn(BaseModel):
    email: str = Field(..., max_length=255)
    name: str | None = Field(None, max_length=120)
    source: str = Field("site", max_length=40)


class BroadcastIn(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    body_html: str = Field(..., min_length=3)
    segment: str = Field("all", pattern="^(all|confirmed)$")
    name: str | None = Field(None, max_length=140)


@router.post("/subscribe")
def subscribe(payload: SubscribeIn, db: Session = Depends(get_db)):
    res = mailing.subscribe(db, str(payload.email), payload.name, source=payload.source)
    if not res.get("ok"):
        raise HTTPException(400, res.get("error", "Could not subscribe."))
    return res


@router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe(token: str, db: Session = Depends(get_db)):
    res = mailing.unsubscribe(db, token)
    msg = res.get("message") if res.get("ok") else res.get("error")
    ok = res.get("ok")
    html = f"""<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>VoltexAI · Unsubscribe</title></head>
    <body style="font-family:system-ui,sans-serif;background:#0a0e1a;color:#e6ecf3;
    display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
      <div style="text-align:center;max-width:420px;padding:24px">
        <div style="font-size:34px">{'✅' if ok else '⚠️'}</div>
        <h1 style="font-size:20px">{'Unsubscribed' if ok else 'Link problem'}</h1>
        <p style="color:#8b97ac">{msg}</p>
        <a href="/" style="color:#c2f53d">Back to VoltexAI</a>
      </div></body></html>"""
    return HTMLResponse(content=html, status_code=200 if ok else 400)


@router.get("/stats")
def stats(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    return mailing.stats(db)


@router.post("/broadcast")
def broadcast(payload: BroadcastIn, _: User = Depends(_require_admin),
              db: Session = Depends(get_db)):
    res = mailing.broadcast(db, payload.subject, payload.body_html,
                            segment=payload.segment, name=payload.name)
    if not res.get("ok"):
        raise HTTPException(400, res.get("error", "Broadcast failed."))
    return res


@router.post("/digest")
def digest(segment: str = "all", _: User = Depends(_require_admin),
           db: Session = Depends(get_db)):
    return mailing.weekly_digest(db, segment=segment)
