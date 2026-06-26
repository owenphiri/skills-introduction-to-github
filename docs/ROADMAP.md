# Roadmap — from MVP to Government-Ready

This repository delivers a **working MVP foundation**. Selling a child-welfare
system to the Government of Zambia responsibly requires the work below. This is
deliberately honest: the gap between "runnable demo" and "national production
system handling minors' data" is real, and pretending otherwise would put
children at risk.

## 1. Legal, safeguarding & compliance (must precede any real data)
- [ ] **Data Protection Act No. 3 of 2021** compliance — registration with the
      Data Protection Commissioner, lawful basis, DPIA for processing minors.
- [ ] Ministry of Education (MoE) safeguarding policy alignment & sign-off.
- [ ] Informed **guardian consent** workflow + child assent where appropriate.
- [ ] Data-retention & deletion policy; right-to-erasure handling.
- [ ] Role-based **access logging / audit trail** (partially scaffolded via sessions).
- [ ] Independent **security penetration test** before go-live.

## 2. Security hardening
- [x] HTTP security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy).
- [x] Rate limiting on login + global API ceiling (in-memory; move to Redis for multi-instance).
- [x] Password-strength policy.
- [x] Audit logging of sensitive actions.
- [x] Containerised deployment (Dockerfile + data volume).
- [ ] Encryption at rest (DB volume) and in transit (TLS everywhere).
- [ ] Move from opaque bearer tokens to short-lived tokens + refresh + device binding.
- [ ] Brute-force account lockout, optional 2FA for staff.
- [ ] Secrets management (no credentials in env files in production).
- [ ] Backups + disaster recovery runbook.

## 3. Messaging at national scale
- [ ] Contract with a Zambian aggregator / telcos (Zamtel, MTN, Airtel) or
      Africa's Talking; register the `SAFEGIRL` sender ID.
- [x] Production SMS adapter implemented (Africa's Talking + generic HTTP);
      flip `MESSAGING_PROVIDER` + credentials to go live. See `docs/GO-LIVE.md`.
- [x] Delivery-receipt webhook (`/api/webhooks/sms/delivery`) updates `messages.delivery_status`.
- [ ] WhatsApp Business API approval for the awareness/results templates.
- [x] Native-speaker **review workflow** built (templates carry draft → pending →
      approved/rejected status; only approved copy is sent, else English fallback).
- [ ] Actual native-speaker + MoE sign-off of all Bemba/Nyanja/Tonga/Lozi copy
      through that workflow before national rollout.

## 4. Android & offline
- [x] Installable mobile app via **PWA** (manifest + service worker + icons) —
      "Add to Home screen" on Android.
- [x] **Offline-first attendance**: registers queue locally and sync when the
      connection returns.
- [ ] Native React Native / Flutter build for parents (push notifications) and
      device-hardware features.
- [ ] Optional QR-code / biometric / face check-in (Platinum package).

## 5. Scale & data model
- [ ] Migrate from `node:sqlite` to **PostgreSQL** for multi-school concurrency
      (the SQL schema is already standard; the swap is isolated to `db.js`).
- [x] Multi-school / district hierarchy with enforced per-user data scoping
      (admin → district → school) and a District Education Officer dashboard.
- [x] Package tiers (Bronze/Silver/Gold/Platinum) enforced as feature flags,
      server-side (402) and in the UI.
- [ ] GIS mapping of vulnerable learners (GPS fields already captured).
- [ ] Replace the heuristic risk model with a model **trained on Zambian
      outcome data** — while keeping it explainable.

## 6. Operations
- [ ] Containerisation (Docker) + CI/CD + monitoring/alerting.
- [ ] Hosting decision: Smart Zambia / government data centre vs. cloud region.
- [ ] District Education Officer + national M&E dashboards and report exports (PDF/Excel).
- [ ] Training materials and a support desk.

## 7. Commercial
- [ ] Pricing model per package tier; procurement via government tender process.
- [ ] Pilot in 1–3 schools, measure impact (attendance ↑, dropouts ↓), publish results.

---

### What's intentionally NOT claimed yet
Biometric/face recognition, the native Android app, GIS visualisation, and a
trained ML model are **designed for but not implemented** here. The data model
and API already accommodate them (GPS fields, package tiers, explainable score),
so they are additive, not rewrites.
