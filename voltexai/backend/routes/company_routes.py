"""
VoltexAI corporate & media routes (public).
GET /api/company            - full content snapshot (About, Careers, CSR, Press,
                              TV, Media, Podcast, Blogs, Offers, Awards, FAQ,
                              Foundation, phrases, global presence, sitemap)
GET /sitemap.xml            - SEO sitemap generated from the route map
POST /api/careers/apply     - capture a job application (lead)
"""
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from ..data import company as company_data
from ..data import eas as eas_data
from ..services import subscribers_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["company"])


@router.get("/api/live/subscribers")
def live_subscribers():
    return subscribers_service.snapshot()


@router.get("/api/eas")
def ea_fleet():
    return eas_data.fleet()

_SITE = "https://voltexai.app"


@router.get("/api/company")
def company():
    return company_data.content()


class ApplyIn(BaseModel):
    role_id: str
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    note: str | None = Field(default=None, max_length=1000)


@router.post("/api/careers/apply")
def apply(data: ApplyIn):
    role = next((r for r in company_data.CAREERS["roles"] if r["id"] == data.role_id), None)
    if not role:
        raise HTTPException(404, "Role not found")
    logger.info("Career application: %s <%s> for %s", data.name, data.email, role["title"])
    return {"received": True,
            "message": f"Thanks {data.name.split()[0]} — your application for "
                       f"{role['title']} is in. We'll be in touch."}


@router.get("/sitemap.xml")
def sitemap_xml():
    urls = "".join(
        f"<url><loc>{_SITE}{path}</loc><changefreq>weekly</changefreq></url>"
        for path in company_data.all_routes()
    )
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
           f"{urls}</urlset>")
    return Response(content=xml, media_type="application/xml")
