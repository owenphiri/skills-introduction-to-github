# 🐔 PrimeAxis — Smart Poultry Management System

**All-in-One Solution for Broilers, Layers & Your Poultry Business.**
*From Chicks to Profits — manage everything in one intelligent poultry platform.*

A web + installable (PWA) management system for poultry farms of any scale — from
SMEs to large commercial operations — by **PrimeAxis ICT Trade & Solutions Ltd**,
Kasama, Northern Province, Zambia.

> **Status: runnable MVP foundation.** This is a real, working full-stack system
> covering the core modules and the four-tier commercial model. See
> [What "go live" still needs](#what-go-live-still-needs) for the honest gap to a
> production launch.

---

## What works today

| Area | Status |
|---|---|
| Animated marketing landing page (hero, product **slides**, pricing, AI, contact) | ✅ |
| Role-based login (owner / manager / worker / accountant) | ✅ |
| **Broiler** management — daily weight, ADG, feed, **FCR**, market-ready | ✅ |
| **Layer** management — egg collection, broken eggs, **hen-day production** | ✅ |
| Daily records, mortality & **survival rate**, auto flock count | ✅ |
| Feed tracking (stock balance & consumption) | ✅ |
| Vaccination schedules & records | ✅ |
| Sales & revenue · Expense management | ✅ |
| Employee management | ✅ |
| **Operations / Financial / Executive** dashboards | ✅ |
| **AI prediction engine** — feed/egg/revenue forecasts + disease anomaly alerts | ✅ |
| **Bronze / Silver / Gold / Platinum** tier gating (ZMW 3,500 → 30,000+) | ✅ |

## Quick start

Requires **Node.js ≥ 22.5** (built-in `node:sqlite` — no DB server, no native build).

```bash
cd poultry
npm install
npm run seed     # demo farm: a broiler batch + a layer flock with full records
npm start        # http://localhost:4000
```

Open **http://localhost:4000** — the marketing site loads; click **Launch App**.
Demo logins (password `password`): `owner`, `manager`, `worker`, `accountant`.
The demo farm is on the **Platinum** tier so every module is visible. The seeded
broiler batch includes a deliberate mortality spike so the **AI engine raises a
disease alert**.

## Pricing tiers (commercial model)

| Tier | Price (ZMW) | For | Unlocks |
|---|---|---|---|
| Bronze | 3,500 | Small farmers | One module, bird records, feed & sales tracking, basic reports |
| Silver | 7,500 | Growing farms | + Both modules, financial reports, expenses, vaccination, mortality monitoring |
| Gold | 15,000 | Commercial farms | + Advanced analytics, cash flow, profit forecasting, employees, executive dashboard |
| Platinum | 30,000+ | Enterprise / multi-farm | + AI prediction engine, multi-farm, unlimited reports & users, API |

Gating is enforced **server-side** (HTTP `402` when a farm's tier is too low) and
in the UI (locked modules are hidden).

## Architecture

```
poultry/
  server/  config · db (node:sqlite) · auth (scrypt + sessions) · features (tiers)
           kpis (FCR/ADG/HDEP/finance + AI predictions) · app (REST) · seed
  public/  index.html (landing + app) · styles.css (animations) · app.js
  test/    11 tests (node:test)
```

## What "go live" still needs

This is the **software foundation**. A real commercial launch additionally needs,
honestly:

- **Payment/subscription billing** (e.g. mobile money — Airtel/MTN) for the tiers.
- **Hosting + TLS** (the same Docker + Caddy pattern as a sibling project applies),
  backups and monitoring.
- **Security hardening** (rate limiting, audit log, pen-test) and migration to
  PostgreSQL for many concurrent farms.
- **Native Android build** (this ships as an installable PWA; a store build is extra).
- **Field validation** of the KPI formulas and AI thresholds with real farm data,
  and farmer onboarding/training.

© 2026 PrimeAxis ICT Trade & Solutions Ltd · MIT License.
