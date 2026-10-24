# 🐔 PrimeAxis Poultry Cloud

**Smart Poultry Farming Platform — from 50 backyard birds to 100,000+ commercial layers.**

A production-grade, multi-tenant SaaS for poultry operations: real-time KPIs
(FCR, ADG, mortality, hen-day egg %), inventory with low-stock alerts, flock &
house management, subscription billing (Stripe + PayPal + crypto), live farm
mapping with Waze directions, and an installable mobile-first PWA.

> Brand note: "PrimeAxis" is the working brand (PrimeAxis ICT Trade & Solutions
> Ltd). Every brand string lives in `apps/web/src/lib/brand.ts` and
> `apps/api/src/common/config.ts` — rebrand in one place.

---

## Monorepo layout

```
primeaxis/
├── docs/
│   ├── architecture.md      1. Architecture overview, tech decisions, data models
│   ├── database.md          2. Database schema & relationships (ERD)
│   ├── api.md               4. Full backend API reference
│   └── deployment.md        9. Deployment & environment setup guide
├── apps/
│   ├── api/                 NestJS 11 backend — REST + WebSockets + Prisma
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── auth/        JWT auth, roles (OWNER / MANAGER / WORKER / ADMIN)
│   │       ├── farms/       Multi-farm tenancy
│   │       ├── flocks/      Houses, flocks, batches
│   │       ├── records/     Daily data entry + KPI engine (FCR, ADG, HDEP…)
│   │       ├── inventory/   Feed/vaccine/equipment stock, suppliers, POs
│   │       ├── alerts/      Threshold alerts (mortality spikes, low stock, temp)
│   │       ├── realtime/    Socket.IO gateway — live KPIs & alert push
│   │       ├── payments/    5. Stripe, PayPal, Coinbase Commerce (crypto)
│   │       └── common/      Guards, audit log, rate limiting, config
│   └── web/                 Next.js 15 (App Router) frontend — PWA
│       ├── public/          manifest.json, service worker, icons
│       └── src/
│           ├── app/         Landing, auth, dashboard, flocks, inventory,
│           │                billing, map, reports, settings
│           ├── components/  shadcn-style UI kit, 6. real-time dashboard,
│           │                8. PWA install prompt, social follow section
│           ├── hooks/       useLiveKpis (WebSocket subscription)
│           └── lib/         API client, socket, Waze deep links, plans
├── docker-compose.yml       Postgres + API + Web, one command
└── .env.example             Every environment variable, documented
```

The numbers map to the nine requested deliverables; 3 (frontend structure) and
7 (responsive design system) are the `apps/web` tree itself and
`docs/architecture.md § Design system`.

## Quick start (local)

```bash
cd primeaxis
cp .env.example .env                 # fill in secrets (defaults work for dev)
docker compose up -d db              # Postgres 16

# Backend
cd apps/api
npm install
npx prisma migrate dev --name init   # creates schema + generates client
npm run seed                         # demo farm, flocks, 30 days of records
npm run start:dev                    # http://localhost:4000  (REST + WS)

# Frontend (new terminal)
cd apps/web
npm install
npm run dev                          # http://localhost:3000
```

Demo login: `owner@demo.farm` / `Password123!` (also `manager@`, `worker@`).

Or run everything containerized: `docker compose up --build`.

## Feature map

| Area | Where |
|---|---|
| Live KPI dashboard, charts, predictive trends | `apps/web/src/app/(app)/dashboard`, `apps/api/src/records/kpi.service.ts` |
| Multi-farm switching | `apps/web/src/components/layout/farm-switcher.tsx` |
| Flock / house / batch management, daily entry | `apps/web/src/app/(app)/flocks`, `apps/api/src/flocks` |
| Inventory, suppliers, purchase orders, low-stock alerts | `apps/api/src/inventory`, `apps/web/src/app/(app)/inventory` |
| Subscriptions: Free / Starter / Professional / Enterprise | `apps/api/src/payments/plans.ts` |
| Stripe (cards) · PayPal · Coinbase Commerce (BTC/ETH/USDC) | `apps/api/src/payments/*` |
| Mobile money extension point | `apps/api/src/payments/gateway.interface.ts` |
| Waze live directions & farm mapping | `apps/web/src/lib/waze.ts`, `app/(app)/map` |
| Follow-us social section (X, Facebook, Instagram, WhatsApp, YouTube) | `apps/web/src/components/social/follow-us.tsx` |
| PWA + install prompt | `apps/web/public/manifest.json`, `src/components/pwa/` |
| Security: validation, rate limits, audit log, RBAC | `apps/api/src/common/`, `docs/architecture.md § Security` |

## Reading order

1. `docs/architecture.md` — why NestJS, how tenancy/roles/realtime work
2. `docs/database.md` — schema walkthrough (`apps/api/prisma/schema.prisma` is source of truth)
3. `docs/api.md` — endpoint reference
4. Code — start at `apps/api/src/app.module.ts` and `apps/web/src/app/(app)/dashboard/page.tsx`
5. `docs/deployment.md` — Vercel + Railway/Render/AWS, Docker, production checklist

© 2026 PrimeAxis ICT Trade & Solutions Ltd · MIT
