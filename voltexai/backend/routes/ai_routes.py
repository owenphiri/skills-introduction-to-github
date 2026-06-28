"""
VoltexAI - AI routes (the Claude brain)
POST /api/ai/chat              - non-streaming completion
POST /api/ai/stream            - SSE streaming completion
POST /api/ai/signal            - JSON signal for a pair
POST /api/ai/analyze-chart     - vision: upload base64 chart image
GET  /api/ai/quota             - remaining calls for the day
GET  /api/ai/conversations     - list conversations
GET  /api/ai/conversations/{id}- get full conversation
DELETE /api/ai/conversations/{id}
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Conversation, Message
from ..services.claude_service import claude_service
from ..middleware.auth_middleware import get_current_user
from ..middleware.rate_limit import check_and_increment, remaining_for

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])


# ---------- schemas ----------
class ChatIn(BaseModel):
    mode: str = Field(default="terminal",
                      description="terminal | analysis | signals | academy")
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: Optional[int] = None  # omit to start a new conversation


class ChatOut(BaseModel):
    conversation_id: int
    reply: str
    tokens_in: int
    tokens_out: int
    quota_remaining: int


class SignalIn(BaseModel):
    pair: str = Field(min_length=3, max_length=20)
    timeframe: str = "M15"
    context: str = ""


class ChartIn(BaseModel):
    image_b64: str = Field(description="base64-encoded chart screenshot")
    media_type: str = "image/png"
    instruction: str = "Run the standard VoltexAI analysis on this chart."
    pair: str | None = None
    conversation_id: Optional[int] = None


# ---------- helpers ----------
def _get_or_create_convo(db: Session, user: User, mode: str,
                         convo_id: Optional[int]) -> Conversation:
    if convo_id:
        c = (db.query(Conversation)
               .filter(Conversation.id == convo_id,
                       Conversation.user_id == user.id).first())
        if not c:
            raise HTTPException(404, "Conversation not found")
        return c
    c = Conversation(user_id=user.id, mode=mode, title="New conversation")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _convo_history(c: Conversation) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in c.messages]


def _persist_exchange(db: Session, c: Conversation, user_msg: str,
                      assistant_msg: str, t_in: int, t_out: int):
    db.add(Message(conversation_id=c.id, role="user", content=user_msg))
    db.add(Message(conversation_id=c.id, role="assistant", content=assistant_msg,
                   tokens_in=t_in, tokens_out=t_out))
    # auto-title on first exchange
    if c.title == "New conversation":
        c.title = (user_msg[:60] + "…") if len(user_msg) > 60 else user_msg
    db.commit()


# ---------- routes ----------
@router.post("/chat", response_model=ChatOut)
async def chat(data: ChatIn, user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    remaining = check_and_increment(user)
    c = _get_or_create_convo(db, user, data.mode, data.conversation_id)
    try:
        result = await claude_service.complete(
            mode=data.mode, history=_convo_history(c), user_message=data.message,
        )
    except Exception as e:
        logger.exception("Claude call failed")
        raise HTTPException(502, f"AI service error: {e}")

    _persist_exchange(db, c, data.message, result["content"],
                      result["tokens_in"], result["tokens_out"])
    return ChatOut(conversation_id=c.id, reply=result["content"],
                   tokens_in=result["tokens_in"], tokens_out=result["tokens_out"],
                   quota_remaining=remaining)


@router.post("/stream")
async def stream(data: ChatIn, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    check_and_increment(user)
    c = _get_or_create_convo(db, user, data.mode, data.conversation_id)
    history = _convo_history(c)
    user_msg = data.message

    async def event_generator():
        collected = []
        t_in = t_out = 0
        async for sse in claude_service.stream(mode=data.mode, history=history,
                                               user_message=user_msg):
            # parse the JSON inside each "data: {...}" so we can track usage
            try:
                import json
                payload = json.loads(sse[5:].strip())  # strip 'data: '
                if payload.get("type") == "delta":
                    collected.append(payload["text"])
                elif payload.get("type") == "done":
                    t_in = payload.get("tokens_in", 0)
                    t_out = payload.get("tokens_out", 0)
            except Exception:
                pass
            yield sse
        # persist once stream completes
        full = "".join(collected)
        _persist_exchange(db, c, user_msg, full, t_in, t_out)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"X-Conversation-Id": str(c.id)})


@router.post("/signal")
async def generate_signal(data: SignalIn, user: User = Depends(get_current_user)):
    check_and_increment(user)
    try:
        return await claude_service.generate_signal(
            pair=data.pair.upper(), timeframe=data.timeframe,
            extra_context=data.context,
        )
    except Exception as e:
        raise HTTPException(502, f"Signal generation failed: {e}")


@router.post("/analyze-chart", response_model=ChatOut)
async def analyze_chart(data: ChartIn, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    remaining = check_and_increment(user)
    c = _get_or_create_convo(db, user, "analysis", data.conversation_id)
    prompt = data.instruction
    if data.pair:
        prompt = f"Pair: {data.pair}. {prompt}"
    try:
        result = await claude_service.complete(
            mode="analysis", history=_convo_history(c),
            user_message=prompt, image_b64=data.image_b64,
            image_media_type=data.media_type,
        )
    except Exception as e:
        raise HTTPException(502, f"Vision call failed: {e}")

    _persist_exchange(db, c, f"[chart image] {prompt}", result["content"],
                      result["tokens_in"], result["tokens_out"])
    return ChatOut(conversation_id=c.id, reply=result["content"],
                   tokens_in=result["tokens_in"], tokens_out=result["tokens_out"],
                   quota_remaining=remaining)


@router.get("/quota")
def quota(user: User = Depends(get_current_user)):
    return remaining_for(user)


@router.get("/conversations")
def list_conversations(user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    convos = (db.query(Conversation)
                .filter(Conversation.user_id == user.id)
                .order_by(Conversation.updated_at.desc()).limit(50).all())
    return [{"id": c.id, "title": c.title, "mode": c.mode,
             "updated_at": c.updated_at.isoformat()} for c in convos]


@router.get("/conversations/{convo_id}")
def get_conversation(convo_id: int, user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    c = (db.query(Conversation)
           .filter(Conversation.id == convo_id,
                   Conversation.user_id == user.id).first())
    if not c:
        raise HTTPException(404, "Not found")
    return {
        "id": c.id, "title": c.title, "mode": c.mode,
        "messages": [{"role": m.role, "content": m.content,
                      "created_at": m.created_at.isoformat()}
                     for m in c.messages],
    }


@router.delete("/conversations/{convo_id}", status_code=204)
def delete_conversation(convo_id: int, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    c = (db.query(Conversation)
           .filter(Conversation.id == convo_id,
                   Conversation.user_id == user.id).first())
    if not c:
        raise HTTPException(404, "Not found")
    db.delete(c)
    db.commit()
