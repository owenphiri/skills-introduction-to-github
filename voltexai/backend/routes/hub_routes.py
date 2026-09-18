"""
Voltex hub routes (public): sentiment, live sessions, resources, travel.
GET /api/sentiment
GET /api/sessions
GET /api/resources                (+ ?category=)
GET /api/resources/calendar
GET /api/travel                    (+ ?type=)
POST /api/travel/{id}/rsvp
"""
import logging

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..services import sentiment_service
from ..data import sessions as sessions_data
from ..data import resources as resources_data
from ..data import travel as travel_data
from ..data import news_events

logger = logging.getLogger(__name__)
router = APIRouter(tags=["hub"])


@router.get("/api/sentiment")
async def sentiment():
    return await sentiment_service.overview_with_news()


@router.get("/api/sessions")
def sessions():
    return {**sessions_data.sessions_status(),
            "streams": sessions_data.next_streams(8),
            "globe": sessions_data.global_map()}


@router.get("/api/resources")
def resources(category: str = Query("all")):
    return {"categories": resources_data.CATEGORIES,
            "resources": resources_data.list_resources(category)}


@router.get("/api/resources/calendar")
def calendar(days: int = Query(7, ge=1, le=14)):
    events = resources_data.economic_calendar(days)
    return {"count": len(events), "events": events}


@router.get("/api/news")
def news(horizon_days: int = Query(10, ge=1, le=30)):
    """High-impact news events: live windows, countdowns and per-event playbooks
    for building live trading sessions (CPI, NFP, FOMC, and more)."""
    return news_events.news_status(horizon_days=horizon_days)


@router.get("/api/travel")
def travel(type: str = Query("all")):
    events = travel_data.list_events(type)
    return {"count": len(events), "events": events}


class RsvpIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    country: str | None = None


@router.post("/api/travel/{event_id}/rsvp")
def rsvp(event_id: str, data: RsvpIn):
    ev = travel_data.get_event(event_id)
    if not ev:
        raise HTTPException(404, "Event not found")
    logger.info("Travel RSVP: %s <%s> for %s", data.name, data.email, ev["title"])
    return {"received": True,
            "message": f"You're on the list for {ev['title']} — details incoming!"}
