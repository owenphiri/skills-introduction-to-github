# VoltexAI — Go-Live Runbook

The definitive guide to shipping VoltexAI to production: **Vercel** (web) +
**Render** (API + Postgres), driven by **GitHub Actions CI/CD**.

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
| Vercel | Web app (Vite SPA + PWA) | ✅ |
| Render | API (FastAPI) + Postgres | ✅ |
| Anthropic | AI Terminal | pay-as-you-go |
| Twelve Data / OANDA | Live prices / forex exec | ✅ practice tiers |
| Stripe / Flutterwave | Payments | ✅ test mode |

---

## 2. Deploy the API (Render)

The blueprint `voltexai/render.yaml` provisions Postgres + the API in one click.

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo → apply.
3. Fill the `sync: false` secrets in the Render dashboard:
   `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`, and (optional live data/exec)
   `TWELVEDATA_API_KEY`, `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`.
4. Set `ENVIRONMENT=production` and `CORS_ORIGINS=https://<your-vercel-domain>`.
5. Health check path is `/health`; readiness is `/health/ready` (checks the DB).

Note the API URL, e.g. `https://voltexai-api.onrender.com`.

## 3. Deploy the web app (Vercel)

**One-time setup**
1. Vercel → **Add New → Project** → import this repo.
2. Set **Root Directory** = `voltexai/frontend` (config lives in `vercel.json`).
3. Framework auto-detects **Vite**; build `npm run build`, output `dist`.
4. Add env var **`VITE_API_URL`** = your Render API URL.
5. Deploy. Vercel serves the SPA with the security headers + asset caching from
   `vercel.json`, and rewrites unknown routes to `index.html` (client routing).

Point your domain at Vercel and set `CORS_ORIGINS` on the API to match.

## 4. CI/CD (GitHub Actions)

`.github/workflows/voltexai-ci.yml` runs on every push/PR touching `voltexai/**`:

| Job | What |
|---|---|
| **backend** | `pytest` (38 tests) |
| **frontend** | Vite build + uploads the `dist` artifact |
| **quality** | `npm audit` + `pip check` (advisory, non-blocking) |
| **deploy** | On `main` only → deploys the web app to Vercel |

**Enable auto-deploy to Vercel** (optional — the pipeline is green without it):
1. Get `VERCEL_TOKEN` (Account → Settings → Tokens).
2. Run `vercel link` locally in `voltexai/frontend` to get `.vercel/project.json`
   → copy `orgId` and `projectId`.
3. In GitHub repo **Settings → Secrets and variables → Actions**:
   - Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - Variable: `ENABLE_VERCEL_DEPLOY = true`
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
| `DATABASE_URL` (Postgres) | API | ✅ (Render provides) |
| `CORS_ORIGINS` | API | ✅ (your web domain) |
| `ANTHROPIC_API_KEY` | API | for AI Terminal |
| `TWELVEDATA_API_KEY` / `OANDA_*` | API | for live data / forex exec |
| `BROKER` (`paper`/`alpaca`/`oanda`/`router`) | API | default `paper` |
| `STRIPE_*`, `FLW_*` | API | for payments |
| `EMAIL_PROVIDER` + SMTP/Resend | API | for real emails |
| `VITE_API_URL` | Vercel | ✅ |

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
