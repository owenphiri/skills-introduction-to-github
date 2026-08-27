# VoltexAI White-Label (Multi-Tenant)

VoltexAI can run as a **multi-tenant white-label platform**: one deployment serves
many partners, each with their own branding, resolved per request. This is built
in phases — Phase 1 (branding backbone) ships first; data isolation and per-tenant
billing follow.

## Phase 1 — tenant + branding backbone ✅

**How a tenant is resolved (per request):**
1. `?tenant=<slug>` query param (used by the frontend), or `X-Tenant: <slug>` header
2. a tenant whose custom `domain` matches the request host
3. the first host label — `acme.voltexai.app` → tenant `acme`
4. the flagship default **`voltexai`** (seeded from COMPANY/SOCIALS)

**What a tenant carries:** name, legal, powered-by, tagline, motto, **accent colour**,
logo (emoji or URL), CEO, HQ, established, support email, socials.

**Frontend** fetches `GET /api/tenant`, then themes itself at runtime — the logo/name
(NavBar + Footer), the **accent colour** (`--vx-accent` CSS variable), the footer
legal line, and the document title. The flagship VoltexAI is pixel-unchanged; any
other tenant is fully re-branded.

### Provision a partner (admin)

```http
POST /api/tenant            # admin JWT
{
  "slug": "acme",
  "name": "Acme Markets",
  "domain": "trade.acme.com",         # optional custom domain
  "accent_color": "#3366FF",
  "tagline": "Trade with Acme",
  "logo_url": "https://.../acme.png",
  "ceo": "Jane Doe",
  "socials": [{ "id": "x", "label": "X", "url": "https://x.com/acme" }]
}
```
`PUT /api/tenant/{slug}` updates it; `GET /api/tenant/all` lists them. The partner
then reaches their brand at `acme.<base>` (subdomain), `?tenant=acme`, or their own
domain once DNS points at the app.

## Phase 2 — data isolation (next)

Add `tenant_id` to tenant-scoped tables (users, subscriptions, signals, journal,
referrals…) and scope every query + auth by the resolved tenant, so partners never
see each other's users or data. This is the invasive part and is done table-by-table
with migrations; the tenant context from Phase 1 is already threaded to build on.

## Phase 3 — custom domains + per-tenant billing

Custom-domain onboarding (verify + TLS), a partner admin portal for self-service
branding, per-tenant plans/pricing and revenue share.

## Security notes

- Branding is public; **tenant admin CRUD requires an admin JWT**.
- Until Phase 2 lands, treat data as shared — do not onboard partners who need hard
  data isolation yet.
- Provider API keys (Twelve Data, Alpha Vantage, Anthropic, Stripe, …) stay
  **server-side** and are shared platform infrastructure, not per-tenant secrets.
