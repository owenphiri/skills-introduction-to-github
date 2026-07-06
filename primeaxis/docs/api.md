# API Reference

Base URL: `http://localhost:4000` (dev). All routes except `/auth/*`, `/plans`
and `/webhooks/*` require `Authorization: Bearer <accessToken>`. Farm-scoped
routes additionally require membership of `:farmId`; the role column shows the
minimum farm role (blank = any member; workers included).

Errors: `400` validation, `401` no/expired token, `402` plan too low,
`403` role/membership, `404` not found, `429` rate-limited.

## Auth

| Method & path | Role | Body → Response |
|---|---|---|
| `POST /auth/register` | public | `{email, password, fullName, farmName}` → tokens + farms. Creates user **and** first farm (OWNER, FREE plan) |
| `POST /auth/login` | public | `{email, password}` → `{accessToken, refreshToken, user, farms[]}` |
| `POST /auth/refresh` | public | `{refreshToken}` → new token pair (old refresh token revoked — rotation) |
| `POST /auth/logout` | public | `{refreshToken}` → revokes it |

Rate limit on this controller: 10/min/IP.

## Farms & members

| Method & path | Role | Notes |
|---|---|---|
| `GET /farms` | | Farms the caller belongs to, with plan |
| `POST /farms` | | New farm (multi-farm gated by best owned plan) |
| `GET /farms/:farmId` | | Farm + members + subscription + counts |
| `PATCH /farms/:farmId` | MANAGER | Name, location (lat/lng for Waze), currency, timezone |
| `POST /farms/:farmId/members` | OWNER | `{email, role: MANAGER\|WORKER}` |
| `DELETE /farms/:farmId/members/:memberId` | OWNER | Cannot remove OWNER |

## Houses, flocks, vaccinations

| Method & path | Role | Notes |
|---|---|---|
| `GET /farms/:farmId/houses` | | Houses + active flocks |
| `POST /farms/:farmId/houses` | MANAGER | `{name, capacity, tempMinC?, tempMaxC?, humidityMaxPct?}` |
| `PATCH /farms/:farmId/houses/:houseId` | MANAGER | |
| `GET /farms/:farmId/flocks?status=ACTIVE` | | |
| `POST /farms/:farmId/flocks` | MANAGER | Checks house capacity + plan bird limit |
| `GET /farms/:farmId/flocks/:flockId` | | Flock + house + vaccinations |
| `PATCH /farms/:farmId/flocks/:flockId` | MANAGER | Rename / status (SOLD, DEPLETED…) |
| `POST /farms/:farmId/flocks/:flockId/vaccinations` | MANAGER | |
| `PATCH /farms/:farmId/vaccinations/:id/given` | | Worker marks done |

## Daily records & KPIs (the live dashboard)

| Method & path | Role | Notes |
|---|---|---|
| `GET /farms/:farmId/kpis` | | Farm rollup — same payload as WS `kpi:update` |
| `GET /farms/:farmId/flocks/:flockId/kpis` | | FCR, ADG, mortality, hen-day %, water:feed, 14-day series + 7-day projection |
| `GET /farms/:farmId/flocks/:flockId/records?days=60` | | Raw rows for charts/exports |
| `PUT /farms/:farmId/flocks/:flockId/records` | | **Idempotent upsert** on (flock, date). Triggers alert evaluation + WS push |
| `POST /farms/:farmId/sensor-readings` | | `{houseId, tempC?, humidityPct?}` — manual or IoT bridge |

## Inventory, suppliers, purchase orders

| Method & path | Role | Notes |
|---|---|---|
| `GET /farms/:farmId/inventory/items?category=FEED` | | |
| `POST /farms/:farmId/inventory/items` | MANAGER | |
| `PATCH /farms/:farmId/inventory/items/:itemId` | MANAGER | |
| `POST /farms/:farmId/inventory/items/:itemId/movements` | | `{type, quantity, flockId?, note?}` — usage attributed to a flock; fires LOW_STOCK |
| `GET /farms/:farmId/inventory/items/:itemId/movements` | | Ledger history |
| `GET /farms/:farmId/inventory/suppliers` · `POST …` | GET any / POST MANAGER | Supplier lat/lng powers Waze routes |
| `GET /farms/:farmId/inventory/purchase-orders` · `POST …` | GET any / POST MANAGER | |
| `POST /farms/:farmId/inventory/purchase-orders/:poId/receive` | MANAGER | Restocks + posts PURCHASE movements atomically |

## Finance (OWNER/MANAGER only)

| Method & path | Notes |
|---|---|
| `GET /farms/:farmId/finance/summary?months=6` | `{monthly: [{month, revenue, costs, profit}], perBatch: [...]}` |
| `POST /farms/:farmId/finance/expenses` | `{category, amount, date, flockId?}` |
| `POST /farms/:farmId/finance/sales` | `{product, quantity, unitPrice, date, flockId?, buyer?}` |

## Alerts

| Method & path | Notes |
|---|---|
| `GET /farms/:farmId/alerts?unread=true` | Latest 100 |
| `PATCH /farms/:farmId/alerts/:alertId/read` | |

## Billing

| Method & path | Role | Notes |
|---|---|---|
| `GET /plans` | public | Plan matrix (names, prices, limits, features) |
| `POST /farms/:farmId/checkout` | OWNER | `{plan, gateway: STRIPE\|PAYPAL\|CRYPTO, returnUrl}` → `{url}` to redirect |
| `POST /webhooks/stripe` | signature | `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted` |
| `POST /webhooks/paypal` | signature | `PAYMENT.CAPTURE.COMPLETED/DENIED` (verify-webhook-signature API) |
| `POST /webhooks/coinbase` | signature | `charge:confirmed`, `charge:failed` (HMAC-SHA256) |

## WebSocket (Socket.IO, same origin as REST)

Connect with `io(WS_URL, { auth: { token: accessToken } })`, then
`socket.emit('join', farmId)` (membership verified server-side).

| Event (server → client) | Payload |
|---|---|
| `kpi:update` | Farm KPI rollup — identical to `GET /farms/:farmId/kpis` |
| `alert:new` | The Alert row just raised |
| `sensor:new` | `{houseId, houseName, tempC, humidityPct, at}` |
