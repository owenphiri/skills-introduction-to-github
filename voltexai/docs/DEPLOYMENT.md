# VoltexAI — Deployment Guide

VoltexAI ships three deployable surfaces:

| Surface | Stack | Deploy options |
|---|---|---|
| Backend API | FastAPI (Python 3.12) | Docker, Render, Fly.io, any PaaS |
| Web app | React + Vite (SPA + PWA) | Static host (Render/Vercel/Netlify), nginx, Docker |
| Mobile app | Expo / React Native | EAS Build → App Store / Play Store |

---

## 1. One-command local stack (Docker Compose)

```bash
cd voltexai
cp backend/.env.example backend/.env     # add ANTHROPIC_API_KEY + JWT_SECRET
docker compose up --build
```

- Web → http://localhost:8080
- API → http://localhost:8000 (docs at `/docs`)
- Postgres is provisioned automatically; the web container proxies `/api` to the API.

The app is **fully functional without any external keys** — markets, signals, prop
firms, brokers and the AUM pages all run on the built-in data/feed. Add
`ANTHROPIC_API_KEY` to enable the AI Terminal, and Stripe/Flutterwave keys to enable
live payments.

## 2. Render.com (managed, free tier)

`voltexai/render.yaml` is a Blueprint that provisions Postgres + the API + the static
web app in one click:

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo.
3. Set the `sync: false` secrets (Anthropic, Stripe, Flutterwave) in the dashboard.

## 3. Backend only (Docker)

```bash
cd voltexai/backend
docker build -t voltexai-api .
docker run -p 8000:8000 --env-file .env voltexai-api
```

## 4. Frontend only (static build)

```bash
cd voltexai/frontend
npm install
VITE_API_URL=https://your-api-host npm run build   # outputs dist/
```
Serve `dist/` on any static host. The included `nginx.conf` adds SPA fallback and an
`/api` reverse proxy when self-hosting.

## 5. Mobile app (Expo)

```bash
cd voltexai/mobile
npm install
npx expo start            # scan the QR with Expo Go
# production builds:
npx eas build -p android  # and -p ios
```
Set the API base in `app.json → expo.extra.apiUrl`.

## 6. Going live checklist

- [ ] `JWT_SECRET` set to a 32+ char random value
- [ ] `ANTHROPIC_API_KEY` set; choose `CLAUDE_MODEL`
- [ ] Stripe live keys + webhook secret; products created for Trader/Elite
- [ ] Flutterwave live keys + webhook hash
- [ ] `DATABASE_URL` pointed at managed Postgres (not SQLite)
- [ ] `CORS_ORIGINS` / `FRONTEND_URL` set to your real domains
- [ ] Point webhooks at `/api/payments/stripe/webhook` and `/api/payments/flutterwave/webhook`
- [ ] (Optional) Wire a live market-data provider in `services/market_service.py`

See `docs/WEBHOOKS_SETUP.md` and `docs/INTEGRATION_GUIDE.md` for payment wiring.
