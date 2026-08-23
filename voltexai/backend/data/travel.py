"""
Voltex Travel — global trader summits, meetups & retreats.
Representative event catalog (VoltexAI community events across the globe). RSVPs
are captured as leads; real dates/venues are confirmed per event.
"""
from __future__ import annotations

EVENTS = [
    {"id": "summit-lusaka", "title": "VoltexAI Summit — Lusaka", "type": "Summit",
     "city": "Lusaka", "country": "Zambia", "flag": "🇿🇲", "month": "Mar 2026",
     "desc": "The flagship African trading summit — keynotes, live trading, networking.",
     "price_usd": 0, "spots": 500},
    {"id": "meetup-lagos", "title": "Lagos Traders Meetup", "type": "Meetup",
     "city": "Lagos", "country": "Nigeria", "flag": "🇳🇬", "month": "Feb 2026",
     "desc": "Evening meetup for the Naija trading community — drinks & charts.",
     "price_usd": 0, "spots": 150},
    {"id": "meetup-nairobi", "title": "Nairobi Charts & Coffee", "type": "Meetup",
     "city": "Nairobi", "country": "Kenya", "flag": "🇰🇪", "month": "Feb 2026",
     "desc": "Morning meetup: market outlook + M-Pesa funding clinic.",
     "price_usd": 0, "spots": 120},
    {"id": "retreat-zanzibar", "title": "Trader Retreat — Zanzibar", "type": "Retreat",
     "city": "Zanzibar", "country": "Tanzania", "flag": "🇹🇿", "month": "Apr 2026",
     "desc": "5-day immersive retreat: deep work, mentorship, and the beach.",
     "price_usd": 1200, "spots": 40},
    {"id": "summit-dubai", "title": "VoltexAI Global — Dubai", "type": "Summit",
     "city": "Dubai", "country": "UAE", "flag": "🇦🇪", "month": "May 2026",
     "desc": "Prop firms, brokers & investors under one roof. The global edition.",
     "price_usd": 199, "spots": 800},
    {"id": "meetup-london", "title": "London Traders Mixer", "type": "Meetup",
     "city": "London", "country": "United Kingdom", "flag": "🇬🇧", "month": "Jun 2026",
     "desc": "Diaspora + UK traders connect at the City's trading hub.",
     "price_usd": 0, "spots": 200},
    {"id": "summit-jozi", "title": "VoltexAI Summit — Johannesburg", "type": "Summit",
     "city": "Johannesburg", "country": "South Africa", "flag": "🇿🇦", "month": "Aug 2026",
     "desc": "Southern Africa's biggest gathering of retail & prop traders.",
     "price_usd": 0, "spots": 400},
    {"id": "retreat-accra", "title": "West Africa Retreat — Accra", "type": "Retreat",
     "city": "Accra", "country": "Ghana", "flag": "🇬🇭", "month": "Sep 2026",
     "desc": "3-day intensive: strategy, psychology & funded-account bootcamp.",
     "price_usd": 800, "spots": 60},
]

EVENTS_BY_ID = {e["id"]: e for e in EVENTS}


def list_events(kind: str | None = None) -> list[dict]:
    if not kind or kind == "all":
        return EVENTS
    return [e for e in EVENTS if e["type"].lower() == kind.lower()]


def get_event(event_id: str) -> dict | None:
    return EVENTS_BY_ID.get(event_id)
