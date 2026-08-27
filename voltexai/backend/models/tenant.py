"""
Tenant model — the white-label unit. One deployment serves many partners; each
tenant carries its own branding and is resolved per request from the Host header
(custom domain or <slug>.base) or an explicit X-Tenant header. The flagship
"voltexai" tenant is seeded on startup so default behaviour never changes.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from ..database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(60), unique=True, index=True, nullable=False)
    domain = Column(String(255), unique=True, index=True, nullable=True)  # custom domain
    is_active = Column(Boolean, default=True, nullable=False)

    # --- brand ---
    name = Column(String(120), nullable=False)
    legal = Column(String(160), nullable=True)
    powered_by = Column(String(200), nullable=True)
    tagline = Column(String(240), nullable=True)
    motto = Column(String(240), nullable=True)
    accent_color = Column(String(9), default="#C2F53D", nullable=False)  # hex
    logo_emoji = Column(String(16), default="⚡", nullable=True)
    logo_url = Column(String(500), nullable=True)
    ceo = Column(String(120), nullable=True)
    hq = Column(String(160), nullable=True)
    established = Column(String(40), nullable=True)
    support_email = Column(String(160), nullable=True)
    socials = Column(Text, nullable=True)  # JSON array [{id,label,handle,url}]

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)
