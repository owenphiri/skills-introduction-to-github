# 🎓 Musenga MIS — Musenga Day Secondary School Management Information System

**v5.4.0** — a single-file, offline-capable school management system for
Musenga Day Secondary School (Chitimukulu Road, Mungwi Town, Northern
Province, Zambia).

Covers admissions, attendance, results & grading (Musenga's own Mid-Term/40 +
End-of-Term/60 = 100% scheme), certificates, a parent portal, an interactive
GIS locator map, push notifications and role-based logins — all in one
zero-build HTML file that runs entirely in the browser (IndexedDB-backed,
installable as a PWA, works offline). It optionally talks to a
user-configured external SMS/push "gateway" server (set under Settings) —
that gateway is not part of this deployment and stays disabled until a school
admin points it at one.

## Quick start (local)

No build step, no dependencies — just a tiny static server so the app runs
at a real `http://` origin (needed for the service worker/IndexedDB) instead
of `file://`:

```bash
cd Musenga-MIS
cp .env.example .env   # optional — override HOST/PORT, defaults to localhost:3000
npm run dev
```

`HOST`/`PORT` are read from `.env` (see `.env.example`) so development always
targets `localhost` and nothing is hardcoded — the production domain is a
separate, later concern (see CI/CD below).

## Project layout

```
Musenga-MIS/
  public/index.html      The entire application (markup, CSS and JS in one file)
  vercel.json             Static hosting config: output dir, security headers, caching
  scripts/dev-server.js   Local dev server (localhost, env-configurable HOST/PORT)
  scripts/validate.js     CI sanity check (well-formed HTML + inline <script> syntax)
  .env.example            HOST/PORT for dev; PRODUCTION_DOMAIN placeholder for later
  docs/DEPLOYMENT.md      How this goes live on Vercel, incl. custom domain setup
```

## CI/CD

- **CI** — `.github/workflows/musenga-mis-ci.yml` runs on every push/PR that
  touches this folder: validates the HTML shell and checks every inline
  `<script>` block for JavaScript syntax errors before anything ships.
- **CD** — `.github/workflows/musenga-mis-deploy.yml` builds and deploys to
  Vercel (production on `main`, a preview URL on every PR) once the
  `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` repo secrets are set.
  It's reachable at the `*.vercel.app` URL Vercel assigns until a real domain
  exists — at that point, set a `PRODUCTION_DOMAIN` repo **variable** (not a
  secret) and every subsequent deploy attaches it automatically, no code or
  workflow changes needed. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for
  the two ways to wire up hosting (Vercel's own Git integration, or this
  GitHub Actions pipeline) and for the manual custom-domain/DNS steps.

## Data & privacy note

Student, guardian and results data lives in the browser's IndexedDB on each
device — there is no server-side database bundled here. That means it's
genuinely zero-infrastructure to host, but it also means data does not sync
between devices/browsers and is lost if site data is cleared, unless a school
admin configures the optional sync gateway under Settings. Treat this as the
technical foundation to build a shared backend on top of before relying on it
for records that must survive a lost laptop or a cleared browser cache.
