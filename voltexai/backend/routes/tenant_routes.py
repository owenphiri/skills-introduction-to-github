"""
Tenant (white-label) routes.
  GET  /api/tenant              - resolve the active tenant's public branding
  GET  /api/tenant/all          - list tenants (admin)
  POST /api/tenant              - create a tenant (admin)
  PUT  /api/tenant/{slug}       - update a tenant (admin)
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole
from ..services import tenant_service
from ..middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/tenant", tags=["tenant"])


class TenantIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$")
    name: str = Field(min_length=2, max_length=120)
    domain: str | None = None
    tagline: str | None = None
    motto: str | None = None
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    logo_emoji: str | None = None
    logo_url: str | None = None
    legal: str | None = None
    powered_by: str | None = None
    ceo: str | None = None
    hq: str | None = None
    established: str | None = None
    support_email: str | None = None
    socials: list | None = None
    is_active: bool | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    tagline: str | None = None
    motto: str | None = None
    accent_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    logo_emoji: str | None = None
    logo_url: str | None = None
    legal: str | None = None
    powered_by: str | None = None
    ceo: str | None = None
    hq: str | None = None
    established: str | None = None
    support_email: str | None = None
    socials: list | None = None
    is_active: bool | None = None


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    return user


@router.get("")
def active_tenant(request: Request,
                  x_tenant: str | None = Header(default=None, alias="X-Tenant"),
                  tenant: str | None = Query(default=None),
                  db: Session = Depends(get_db)):
    """Resolve the tenant for this request (by ?tenant=, X-Tenant, custom domain
    or subdomain) and return its public branding. Always returns a brand."""
    host = request.headers.get("host")
    t = tenant_service.resolve(db, host=host, x_tenant=x_tenant or tenant)
    return tenant_service.brand_dict(t)


@router.get("/all")
def list_tenants(_: User = Depends(_require_admin), db: Session = Depends(get_db)):
    return {"tenants": tenant_service.list_all(db)}


@router.post("")
def create_tenant(data: TenantIn, _: User = Depends(_require_admin),
                  db: Session = Depends(get_db)):
    try:
        t = tenant_service.create(db, **data.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))
    return tenant_service.brand_dict(t)


@router.put("/{slug}")
def update_tenant(slug: str, data: TenantUpdate, _: User = Depends(_require_admin),
                  db: Session = Depends(get_db)):
    try:
        t = tenant_service.update(db, slug, **data.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(404, str(e))
    return tenant_service.brand_dict(t)
