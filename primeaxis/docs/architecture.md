# Architecture Overview

## Goals

- One codebase serving a 50-bird backyard farm and a 100,000-bird commercial
  operation: same features, different plan limits.
- Real-time: KPI tiles and alerts update live, no refresh.
- Mobile-first PWA: a worker in a poultry house enters mortality/feed/eggs on a
  phone, installable from the browser, tolerant of flaky connectivity.
- Multi-tenant SaaS with subscription billing.

## Stack & why

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + React 19** | Server components for fast first paint on rural mobile networks; App Router layouts fit the shell-with-sidebar pattern; Vercel deploy is one click. |
| UI | **Tailwind CSS 4 + shadcn-style components** | Owned, copy-in components (no runtime dependency lock-in); design tokens as CSS variables give first-class dark mode and rebranding. |
| Charts | **Recharts** | Composable SVG charts that accept our validated, colorblind-safe palette. |
| Backend | **NestJS 11 (Node.js / TypeScript)** | Chosen over FastAPI: (1) one language end-to-end — DTO/type sharing with the Next.js app, one hiring profile; (2) first-class WebSocket gateways in the same DI container as the REST modules, so the KPI service can push to sockets directly; (3) opinionated module system keeps a 9-domain codebase navigable; (4) guards/interceptors give clean cross-cutting RBAC + audit logging. FastAPI is excellent, but would split the stack into two languages for no capability we need — the ML-adjacent work here (trend prediction) is simple regression, not Python-ecosystem ML. |
| ORM / DB | **Prisma + PostgreSQL 16** | Prisma chosen over Drizzle for schema-as-single-source-of-truth, mature migrations, and a typed client the Nest services consume directly. Postgres handles the time-series-ish daily records fine at this scale with proper indexes (see `database.md`). |
| Realtime | **Socket.IO** (WS with fallback) | Room-per-farm model (`farm:{id}`) matches tenancy; automatic reconnection matters on farm connectivity. |
| Auth | **Self-hosted JWT (access + rotating refresh) with Passport** | Keeps the API usable by future native apps and third-party integrations (Enterprise plan API access). The frontend is auth-provider-agnostic behind `lib/api.ts`; swapping in Clerk later touches one file per app. Roles: `OWNER`, `MANAGER`, `WORKER`, `ADMIN` (platform staff). |
| Payments | **Stripe** (cards) + **PayPal** + **Coinbase Commerce** (crypto), behind a common `PaymentGateway` interface | The interface is the extension point for mobile-money providers (MTN MoMo, Airtel Money, M-Pesa). |

## Tenancy & authorization model

```
User ──< FarmMember >── Farm ──< House ──< Flock ──< DailyRecord
        (role per farm)   │
                          ├──< InventoryItem ──< StockMovement
                          ├──< Supplier ──< PurchaseOrder
                          ├──< Alert
                          └──  Subscription (plan, gateway, status)
```

- A user can belong to many farms with a **different role per farm**
  (`FarmMember.role`). The farm switcher in the top bar re-scopes every query.
- Every farm-scoped route is protected by three layers:
  1. `JwtAuthGuard` — valid access token.
  2. `FarmAccessGuard` — the `:farmId` in the route belongs to the caller
     (reads `FarmMember`), and attaches the member's role to the request.
  3. `RolesGuard` + `@Roles(...)` — e.g. workers can POST daily records but
     cannot delete flocks or see financials.
- Plan limits (birds, houses, members, farms) are enforced server-side by
  `PlanGuard` reading `payments/plans.ts`; the UI mirrors them but is never the
  authority.

## Real-time pipeline

```
POST /farms/:id/records ─▶ RecordsService.create()
                             ├─ persist DailyRecord (Prisma)
                             ├─ KpiService.recompute(flock)   FCR/ADG/mortality/HDEP
                             ├─ AlertsService.evaluate()      thresholds → Alert rows
                             └─ RealtimeGateway.emitToFarm(farmId,
                                   'kpi:update' | 'alert:new', payload)
Browser ◀─ Socket.IO room `farm:{id}` ◀──────────────────────────┘
```

Clients join their farm's room after a JWT handshake (`realtime.gateway.ts`).
The dashboard's `useLiveKpis` hook seeds state from REST, then applies socket
patches — so a cold load and a live update render identically.

## KPI definitions (KpiService — single source of truth)

| KPI | Formula |
|---|---|
| Mortality rate | cumulative deaths ÷ birds placed × 100 |
| Livability | 100 − mortality rate |
| FCR (broilers) | total feed kg ÷ total live weight gain kg |
| ADG | (current avg weight − day-old weight) ÷ age in days |
| Hen-day egg production % | eggs collected ÷ (hens alive × days) × 100 |
| Water:feed ratio | daily water L ÷ daily feed kg (alert outside 1.6–2.2) |
| Cost per bird / per egg / per kg | allocated expenses ÷ output |

Predictive insights are 7-day linear-regression projections over the last 21
days of each series (feed use, egg %, weight), flagged when the projection
crosses a breed-standard band — deliberately simple, explainable math.

## Security

- **Input validation**: global `ValidationPipe` (whitelist + transform) — every
  body/param passes through class-validator DTOs; unknown fields rejected.
- **Rate limiting**: `@nestjs/throttler` — global 100 req/min per IP, stricter
  (10/min) on auth endpoints.
- **Passwords**: argon2id. **Tokens**: 15-min access JWT + 30-day rotating
  refresh token (hashed at rest, revoked on rotation/logout).
- **Headers**: helmet on the API; CSP configured in `next.config.mjs`.
- **Audit log**: `AuditInterceptor` writes every mutating request (who, farm,
  action, entity, diff summary, IP) to `AuditLog` — Enterprise-plan exportable.
- **Webhooks**: Stripe/PayPal/Coinbase signatures verified against raw bodies
  (raw-body route config in `main.ts`); events are idempotent by event ID.
- **Encryption**: TLS everywhere in transit; at rest via managed Postgres
  (Railway/RDS) volume encryption; secrets only via env vars.
- **Tenancy safety**: no query runs without a `farmId` scope; guards resolve
  membership before controllers execute.

## Frontend design system (deliverable 7)

- **Tokens** (`globals.css`): brand hue (amber-600 `#d97706` primary, deep
  green accents), neutral scale, status colors, radius `0.75rem`, all as CSS
  variables with a `.dark` override block — components never hardcode hex.
- **Mobile-first**: every page is written for 360 px first; the sidebar becomes
  a bottom tab bar under `md:`; tables collapse to cards; all tap targets
  ≥ 44 px; forms use numeric keyboards (`inputMode`) for field data entry.
- **Charts**: colorblind-validated palette (blue/aqua/yellow…, see
  `components/dashboard/chart-theme.ts`), one y-axis per chart (never dual),
  legends for ≥2 series, tooltips on all marks, hairline grids.
- **Offline posture**: service worker caches the app shell + last dashboard
  payload; failed record submissions queue in IndexedDB and flush on
  reconnect (`lib/offline-queue.ts` is the stub for this).

## Folder conventions

- `apps/api/src/<domain>/` = module + controller + service (+ `dto/`).
- `apps/web/src/app/(app)/` = authenticated shell routes;
  `(auth)/` = sign-in/up; root `page.tsx` = public landing.
- Shared plan metadata is duplicated deliberately (`api/src/payments/plans.ts`
  and `web/src/lib/plans.ts`) with the API as authority; a `packages/shared`
  workspace is the first refactor when the team grows.
