"""
Tenant service — white-label resolution + branding.

Resolution order for a request:
  1. explicit `X-Tenant: <slug>` header (used by the frontend / testing),
  2. a tenant whose custom `domain` equals the request host,
  3. a tenant whose `slug` equals the first host label (<slug>.base.tld),
  4. the flagship default ("voltexai").

The default tenant is seeded from the COMPANY/SOCIALS single-source-of-truth so
existing branding is unchanged when nobody has provisioned another tenant.
"""
from __future__ import annotations
import json

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Tenant
from ..data.products import COMPANY, SOCIALS

DEFAULT_SLUG = "voltexai"


def ensure_default() -> None:
    """Create the flagship tenant if it doesn't exist yet (idempotent)."""
    db = SessionLocal()
    try:
        if db.query(Tenant).filter(Tenant.slug == DEFAULT_SLUG).first():
            return
        db.add(Tenant(
            slug=DEFAULT_SLUG, domain=None, is_active=True,
            name=COMPANY["name"], legal=COMPANY.get("legal"),
            powered_by=COMPANY.get("powered_by"), tagline=COMPANY.get("tagline"),
            motto=COMPANY.get("motto"), accent_color="#C2F53D", logo_emoji="⚡",
            ceo=COMPANY.get("ceo"), hq=COMPANY.get("hq"),
            established=COMPANY.get("established"),
            support_email="support@voltexai.app",
            socials=json.dumps(SOCIALS),
        ))
        db.commit()
    finally:
        db.close()


def _host_label(host: str | None) -> str | None:
    if not host:
        return None
    host = host.split(":")[0].strip().lower()  # drop port
    parts = host.split(".")
    # a bare/base host or www → no tenant subdomain
    if len(parts) < 3 or parts[0] in ("www", "app", "api"):
        return None
    return parts[0]


def resolve(db: Session, host: str | None = None, x_tenant: str | None = None) -> Tenant:
    if x_tenant:
        t = db.query(Tenant).filter(Tenant.slug == x_tenant.lower(),
                                    Tenant.is_active.is_(True)).first()
        if t:
            return t
    if host:
        bare = host.split(":")[0].strip().lower()
        t = db.query(Tenant).filter(Tenant.domain == bare,
                                    Tenant.is_active.is_(True)).first()
        if t:
            return t
        label = _host_label(host)
        if label:
            t = db.query(Tenant).filter(Tenant.slug == label,
                                        Tenant.is_active.is_(True)).first()
            if t:
                return t
    return _default(db)


def _default(db: Session) -> Tenant:
    t = db.query(Tenant).filter(Tenant.slug == DEFAULT_SLUG).first()
    if not t:
        ensure_default()
        t = db.query(Tenant).filter(Tenant.slug == DEFAULT_SLUG).first()
    return t


def brand_dict(t: Tenant) -> dict:
    """Public branding payload the frontend themes itself from."""
    try:
        socials = json.loads(t.socials) if t.socials else []
    except (ValueError, TypeError):
        socials = []
    return {
        "slug": t.slug, "name": t.name, "legal": t.legal,
        "powered_by": t.powered_by, "tagline": t.tagline, "motto": t.motto,
        "accent_color": t.accent_color, "logo_emoji": t.logo_emoji,
        "logo_url": t.logo_url, "ceo": t.ceo, "hq": t.hq,
        "established": t.established, "support_email": t.support_email,
        "socials": socials,
    }


# ---- admin CRUD ----
_EDITABLE = ("name", "legal", "powered_by", "tagline", "motto", "accent_color",
             "logo_emoji", "logo_url", "ceo", "hq", "established",
             "support_email", "domain", "is_active")


def list_all(db: Session) -> list[dict]:
    return [brand_dict(t) | {"domain": t.domain, "is_active": t.is_active}
            for t in db.query(Tenant).order_by(Tenant.created_at.asc()).all()]


def create(db: Session, slug: str, name: str, **fields) -> Tenant:
    slug = slug.lower().strip()
    if db.query(Tenant).filter(Tenant.slug == slug).first():
        raise ValueError(f"Tenant '{slug}' already exists")
    t = Tenant(slug=slug, name=name)
    for k, v in fields.items():
        if k in _EDITABLE and v is not None:
            setattr(t, k, v)
    if "socials" in fields and fields["socials"] is not None:
        t.socials = json.dumps(fields["socials"])
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def update(db: Session, slug: str, **fields) -> Tenant:
    t = db.query(Tenant).filter(Tenant.slug == slug.lower()).first()
    if not t:
        raise ValueError(f"Unknown tenant '{slug}'")
    for k, v in fields.items():
        if k in _EDITABLE and v is not None:
            setattr(t, k, v)
    if fields.get("socials") is not None:
        t.socials = json.dumps(fields["socials"])
    db.commit()
    db.refresh(t)
    return t
