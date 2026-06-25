# 🎓 SafeGirl EduTrack System (SEWSMS)

**Protecting Girls · Promoting Education · Building Futures**

A **School Early Warning & Student Welfare Management System** that tracks
attendance, predicts dropout/early-pregnancy/early-marriage risk for girls, and
strengthens communication between schools, parents, counselors and District
Education Offices.

Designed to align with the Government of Zambia's **Keeping Girls in School
(KGS / GEWEL)** programme.

> **Status: working MVP foundation.** This repository is a runnable, end-to-end
> system covering the core modules. It is the technical foundation for a
> national rollout — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for what a
> production, government-ready deployment additionally requires (data-protection
> compliance, telco SMS contracts, security audit, Android app, hosting).

---

## What works today

| Module | Status |
|---|---|
| Role-based login (admin, teacher, counselor, parent, district, community) | ✅ |
| Student registration (NRC, guardian, village, vulnerability status, GPS fields) | ✅ |
| Smart attendance + **automatic parent SMS** (present / absent) | ✅ |
| Attendance risk detection (consecutive / monthly / Mon–Fri patterns) | ✅ |
| **Girl Child Vulnerability Score** — explainable AI early-warning engine | ✅ |
| Academic performance entry + monthly average SMS | ✅ |
| Counseling & welfare case tracking | ✅ |
| SMS / WhatsApp gateway (pluggable; mock provider built in) | ✅ |
| Multilingual awareness centre (English, Bemba, Nyanja, Tonga, Lozi) | ✅ |
| Analytics dashboard (attendance rate, at-risk counts, interventions, reach) | ✅ |
| Web dashboard (responsive, role-aware) | ✅ |
| CSV report exports (at-risk, attendance) for District Office / M&E | ✅ |
| Attendance-trend chart + GIS map of vulnerable learners | ✅ |
| Audit trail of sensitive actions | ✅ |
| **Installable mobile app (PWA) with offline attendance** | ✅ |
| Native-speaker **review workflow** for local-language messages | ✅ |
| Read-only **parent portal** (own children only, no risk score) | ✅ |
| Term-over-term **academic analytics** (pass rates, trends, decliners) | ✅ |
| **Multi-school / district hierarchy** with enforced data scoping | ✅ |
| District Education Officer **per-school dashboard** | ✅ |

---

## Mobile app (Android / PWA)

The dashboard is a **Progressive Web App** — on an Android phone, open the site
in Chrome and choose **"Add to Home screen"** to install it like a native app
(own icon, full-screen, splash). It then works **offline**:

- The app shell is cached by a service worker, so it opens with no connection.
- Teachers can **mark a register offline**; it is queued in the browser and
  **syncs automatically** when connectivity returns (a "pending sync" badge
  shows the backlog).

This is the field-realistic mobile solution for rural schools with intermittent
networks. A separate native build (React Native) is on the roadmap for features
that need device hardware (biometric/QR check-in). Regenerate icons with
`npm run icons`.

---

## Quick start

Requires **Node.js ≥ 22.5** (uses the built-in `node:sqlite` — no database
server, no native build step).

```bash
npm install      # installs Express only
npm run seed     # creates a demo school, class, attendance, exams, cases
npm start        # http://localhost:3000
```

Open **http://localhost:3000** and log in. Demo accounts (password: `password`):

| Username | Role | See |
|---|---|---|
| `admin` | School Administrator | everything |
| `teacher` | Teacher | register, attendance, risk |
| `counselor` | Guidance & Counseling | risk, welfare cases |
| `district` | District Education Officer | analytics, broadcasts |
| `community` | Community Leader | awareness, broadcasts |

The seeded learner **Mary Phiri** is deliberately set up with a deteriorating
attendance + grades pattern so the early-warning engine flags her as
**HIGH RISK** — open her profile to see the explained score and recommended
interventions.

---

## Architecture

```
server/
  config.js      Env-driven configuration (DB path, SMS provider, risk thresholds)
  db.js          node:sqlite schema + migrations
  auth.js        scrypt password hashing + revocable bearer sessions + RBAC
  riskEngine.js  Explainable Girl Child Vulnerability Score
  messaging.js   SMS/WhatsApp gateway abstraction (mock + HTTP adapter skeleton)
  templates.js   Multilingual parent-notification templates
  seed.js        Demonstration data
  app.js         Express REST API + static dashboard host
public/          Zero-build single-page dashboard (HTML/CSS/vanilla JS)
docs/            Roadmap, API reference & deployment notes
```

Design choices that matter for a government system:

- **Explainable risk model**, not a black box — every point of a child's score
  is traced to a named factor, so flags are defensible to teachers, parents and
  auditors.
- **Revocable sessions** — a compromised account touching sensitive girl-child
  welfare data can be killed instantly.
- **Pluggable messaging** — swap the mock gateway for a real Zambian aggregator
  (Zamtel / MTN / Airtel / Africa's Talking) via one environment variable.
- **Zero-dependency datastore** — runs on a rural school laptop or a national
  data centre with the same code.

See [`docs/API.md`](docs/API.md) for the REST endpoints.

---

## Configuration

All via environment variables (see `server/config.js`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `SEWSMS_DB` | `data/sewsms.db` | Database file path |
| `MESSAGING_PROVIDER` | `mock` | `mock` or `http` |
| `SMS_API_URL` / `SMS_API_KEY` / `SMS_SENDER_ID` | — | Real SMS gateway |
| `RISK_MEDIUM` / `RISK_HIGH` | `30` / `60` | Risk band thresholds |

---

## Safeguarding & data protection

This system handles sensitive data about minors. Before any real-world use it
**must** be operated under the Zambia **Data Protection Act No. 3 of 2021**,
with Ministry of Education safeguarding policies, informed guardian consent,
encryption at rest, access logging and a defined data-retention policy. The
roadmap details the compliance work required.

---

&copy; 2026 · MIT License · Built for child protection in Zambian schools.
