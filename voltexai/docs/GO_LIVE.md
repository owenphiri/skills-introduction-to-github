# VoltexAI — Go-Live Runbook

The definitive guide to shipping VoltexAI to production. Mix-and-match hosting:

- **Web app** → **Vercel** *or* **Netlify** (both configured & CI-wired, opt-in)
- **API** → **Render** (or any Docker host)
- **Database** → **Supabase** (managed Postgres) or Render Postgres

Driven by **GitHub Actions CI/CD**.

```
                       ┌──────────────────────────┐
   push / PR  ───────► │  GitHub Actions (CI/CD)   │
                       │  backend tests · web build │
                       │  security audit · deploy   │
                       └───────┬──────────────┬─────┘
                    on main    │              │  render.yaml auto-deploy
                        ▼       │              ▼
                 ┌────────────┐ │        ┌──────────────┐
                 │  Vercel    │ │        │   Render      │
                 │  (web/PWA) │◄┘        │  API + Postgres│
                 └─────┬──────┘          └──────┬────────┘
                       │   VITE_API_URL          │
                       └────────► /api ──────────┘
```

---

## 1. Prerequisites

| Service | Why | Free tier? |
|---|---|---|
| GitHub | Source + CI/CD | ✅ |
| Vercel **or** Netlify | Web app (Vite SPA + PWA) | ✅ |
| Render | API (FastAPI) | ✅ |
| Supabase | Managed Postgres | ✅ |
| Anthropic | AI Terminal | pay-as-you-go |
| Twelve Data / OANDA | Live prices / forex exec | ✅ practice tiers |
| Stripe / Flutterwave | Payments | ✅ test mode |

---

## 1b. Database (Supabase)

VoltexAI uses Supabase as **managed Postgres for the API** (clients never hit
Supabase directly — the API is the gatekeeper, so RLS isn't required). Details and
schema in [`../supabase/README.md`](../supabase/README.md).

1. Create a project at supabase.com (or Supabase MCP `create_project`).
2. Copy the **Session pooler / direct** URI (Settings → Database → Connection string).
3. Set `DATABASE_URL` on the API — the backend normalises `postgres://` and forces
   `sslmode=require`, so the raw URI works. Tables auto-create on boot; optionally
   apply `voltexai/supabase/schema.sql`.

## 2. Deploy the API (Render)

The blueprint `voltexai/render.yaml` provisions Postgres + the API in one click.
(To use **Supabase** instead of Render Postgres, skip the DB and set `DATABASE_URL`
to your Supabase URI.)

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo → apply.
3. Fill the `sync: false` secrets in the Render dashboard:
   `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`, and (optional live data/exec)
   `TWELVEDATA_API_KEY`, `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`.
4. Set `ENVIRONMENT=production` and `CORS_ORIGINS=https://<your-vercel-domain>`.
5. Health check path is `/health`; readiness is `/health/ready` (checks the DB).

Note the API URL, e.g. `https://voltexai-api.onrender.com`.

## 3. Deploy the web app — pick one

Both hosts are pre-configured. Whichever you choose, set **`VITE_API_URL`** to your
API URL and add that web domain to the API's `CORS_ORIGINS`.

### Option A — Vercel (`vercel.json`)
1. Vercel → **Add New → Project** → import this repo.
2. Set **Root Directory** = `voltexai/frontend`.
3. Vite auto-detected; build `npm run build`, output `dist`.
4. Add env var **`VITE_API_URL`** = your API URL → Deploy.

### Option B — Netlify (`frontend/netlify.toml`)
1. Netlify → **Add new site → Import** this repo.
2. Set **Base directory** = `voltexai/frontend` (build/publish come from `netlify.toml`).
3. Add env var **`VITE_API_URL`** = your API URL → Deploy.

Both serve the SPA with security headers + immutable asset caching and rewrite
unknown routes to `index.html` for client-side routing.

## 4. CI/CD (GitHub Actions)

`.github/workflows/voltexai-ci.yml` runs on every push/PR touching `voltexai/**`:

| Job | What |
|---|---|
| **backend** | `pytest` (39 tests) |
| **frontend** | Vite build + uploads the `dist` artifact |
| **quality** | `npm audit` + `pip check` (advisory, non-blocking) |
| **deploy** | On `main` only → deploys the web app to **Vercel** (opt-in) |
| **deploy-netlify** | On `main` only → deploys the web app to **Netlify** (opt-in) |

Both deploy jobs are **skipped unless you opt in**, so CI stays green out of the box.
Enable whichever host you use (or both) via a repo variable + secrets:

**Vercel** — Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
(`vercel link` in `voltexai/frontend` prints the org/project ids) + Variable
`ENABLE_VERCEL_DEPLOY = true`.

**Netlify** — Secrets `NETLIFY_AUTH_TOKEN` (User → Applications → Personal access
tokens), `NETLIFY_SITE_ID` (Site → Settings → General → Site ID) + Variables
`ENABLE_NETLIFY_DEPLOY = true` and `VITE_API_URL = https://<your-api-host>`.

Set repo variables/secrets under **Settings → Secrets and variables → Actions**.
4. Merge to `main` → the `deploy` job ships the web app to production.

Concurrency cancels superseded runs; the deploy job is gated on both test jobs
passing, only runs on `main` pushes, and is skipped entirely unless
`ENABLE_VERCEL_DEPLOY` is set (so forks/PRs never attempt a deploy).

The API redeploys automatically from Render on every push to `main`.

## 5. Production environment matrix

| Variable | Where | Required |
|---|---|---|
| `ENVIRONMENT=production` | API | ✅ |
| `JWT_SECRET` (32+ chars) | API | ✅ (validated on boot) |
| `DATABASE_URL` (Postgres) | API | ✅ (Render **or** Supabase URI) |
| `CORS_ORIGINS` | API | ✅ (your web domain) |
| `ANTHROPIC_API_KEY` | API | for AI Terminal |
| `TWELVEDATA_API_KEY` / `OANDA_*` | API | for live data / forex exec |
| `BROKER` (`paper`/`alpaca`/`oanda`/`router`) | API | default `paper` |
| `STRIPE_*`, `FLW_*` | API | for payments |
| `EMAIL_PROVIDER` + SMTP/Resend | API | for real emails |
| `VITE_API_URL` | Vercel / Netlify | ✅ |
| `ENABLE_VERCEL_DEPLOY` + `VERCEL_*` | GitHub | for Vercel CD |
| `ENABLE_NETLIFY_DEPLOY` + `NETLIFY_*` | GitHub | for Netlify CD |

On boot the API logs any production misconfiguration (weak `JWT_SECRET`, SQLite in
prod, missing Anthropic key) via `settings.validate_runtime()`.

## 6. Health, observability & rollback

- **Liveness:** `GET /health` · **Readiness:** `GET /health/ready` (DB check → 503 if down).
- Every response carries `X-Request-ID` and `X-Response-Time-ms`; unhandled errors
  return a clean JSON 500 with the request id (full trace stays in logs).
- Security headers (CSP-friendly) + GZip are applied globally; HSTS in production.
- Auth endpoints are brute-force throttled per IP.
- **Rollback:** Vercel → Deployments → *Promote* a previous deployment. Render →
  Events → *Rollback* to a prior deploy. Both are instant and require no rebuild.

## 7. Go-live checklist

- [ ] `JWT_SECRET` set to a strong random value (`python -c "import secrets;print(secrets.token_urlsafe(48))"`)
- [ ] `DATABASE_URL` = managed Postgres; migrations applied
- [ ] `CORS_ORIGINS` / `VITE_API_URL` point at real domains
- [ ] `ANTHROPIC_API_KEY` set; Stripe/Flutterwave live keys + webhooks configured
- [ ] Webhooks → `/api/payments/stripe/webhook` and `/api/payments/flutterwave/webhook`
- [ ] `EMAIL_PROVIDER` = smtp/resend with real credentials
- [ ] (Live trading) broker keys set; `OANDA_ENVIRONMENT`/`ALPACA_BASE_URL` intentionally live
- [ ] `REQUIRE_KYC_FOR_LIVE=true` if gating live trading on verification
- [ ] `/health/ready` returns 200 in production
- [ ] CI green; Vercel + Render deploys succeeded

_Managed-AUM programs require the appropriate licence and audited figures before
accepting client capital — see the disclaimers in the app and pitch deck._
