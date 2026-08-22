# Deploying Musenga MIS to Vercel

This app is a single static HTML file (`public/index.html`), so hosting it is
just "serve this file over HTTPS from a CDN." Vercel does that for free with
a global edge network, automatic HTTPS, and preview URLs per pull request —
which covers "accessible anywhere across the globe."

## Local development

Run it against `localhost`, never a hardcoded domain:

```bash
cd Musenga-MIS
cp .env.example .env   # optional; defaults are HOST=localhost, PORT=3000
npm run dev
```

`scripts/dev-server.js` reads `HOST`/`PORT` from `.env` via Node's
`--env-file-if-exists` flag — no domain is ever baked into the app itself.

There are two ways to wire up continuous **production** deployment. **Pick
one, not both** (running both at once means two things deploying the same
folder).

## Option A — Vercel Git integration (recommended, simplest)

No GitHub secrets to manage; Vercel's own GitHub App does the building.

1. Sign in at https://vercel.com (or create an account) and click **Add New
   → Project**.
2. Import this GitHub repository (`owenphiri/skills-introduction-to-github`).
3. When asked for the project settings:
   - **Root Directory**: `Musenga-MIS`
   - **Framework Preset**: `Other`
   - Build/output settings are already picked up from `Musenga-MIS/vercel.json`
     (`outputDirectory: public`) — no build command needed.
4. Click **Deploy**. Vercel gives you a live URL immediately, e.g.
   `musenga-mis.vercel.app`.
5. From then on: every push to `main` redeploys production automatically,
   and every pull request gets its own preview URL posted as a GitHub check —
   no extra workflow needed. You can leave
   `.github/workflows/musenga-mis-deploy.yml` in the repo unused (it
   no-ops safely without secrets), or delete it if you don't want the
   duplicate CI entry.
6. When you have a domain, add it under **Project → Settings → Domains** (see
   below) — no environment variable needed for this path, Vercel's dashboard
   is the source of truth.

## Option B — GitHub Actions + Vercel CLI (this repo's `musenga-mis-deploy.yml`)

Use this if you want the deploy to show up as a GitHub Actions run (e.g. to
gate it on other checks, or because your org standardizes on Actions for
deploys). It reads `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
from GitHub repo secrets. If Vercel's Git integration (Option A) is already
handling deploys for this project, don't also set these secrets, or you'll
get duplicate deployments.

1. Create a Vercel project once (either via `vercel link` locally from
   `Musenga-MIS/`, or by importing it in the dashboard and then removing the
   Git integration from **Project Settings → Git** so it stops
   auto-deploying and only this workflow deploys it).
2. Get the three values:
   - `VERCEL_TOKEN` — https://vercel.com/account/tokens → Create Token.
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — run `vercel link` inside
     `Musenga-MIS/` once locally; it writes `.vercel/project.json` with both
     IDs (that folder is gitignored, don't commit it).
3. In the GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, add all three.
4. Push to `main` (or open a PR) — `.github/workflows/musenga-mis-deploy.yml`
   builds and deploys automatically. PRs get a comment with the preview URL.

### Adding the production domain later (Option B)

The workflow never hardcodes a domain. Until you own one, deploys just go to
the `*.vercel.app` URL. Once you have a domain:

1. In the GitHub repo: **Settings → Secrets and variables → Actions →
   Variables tab → New repository variable**.
2. Name it `PRODUCTION_DOMAIN`, value e.g. `mis.musengaschool.zm` (this is a
   **variable**, not a secret — a domain name isn't sensitive, and repo
   variables show up in workflow logs, which is what you want here).
3. The next push to `main` runs the workflow's "Attach production domain"
   step, which calls `vercel domains add "$PRODUCTION_DOMAIN"` for you. If the
   domain needs DNS verification first (see below), that step logs a warning
   and the rest of the deploy still succeeds — just add the domain manually
   in the dashboard once, then future pushes keep it in sync.

## Custom domain — DNS records

Whichever option you used above, once you've added a domain to the Vercel
project:

1. In the Vercel dashboard: **Project → Settings → Domains → Add** (skip this
   if Option B's workflow already added it).
2. Enter your domain, e.g. `mis.musengaschool.zm` or `musengaschool.com`.
3. Vercel shows the DNS record(s) to create at your domain registrar:
   - **Subdomain** (e.g. `mis.musengaschool.zm`): add a `CNAME` record
     pointing to `cname.vercel-dns.com`.
   - **Apex/root domain** (e.g. `musengaschool.com`): add an `A` record
     pointing to `76.76.21.21` (Vercel's anycast IP — the dashboard always
     shows the current value to use, prefer that over this doc if they
     differ).
4. Save the DNS record at your registrar (Namecheap, GoDaddy, Zambia's ZICTA-
   accredited `.zm` registrars, etc.) — propagation is usually minutes to a
   few hours.
5. Vercel automatically issues and renews a free HTTPS certificate for the
   domain once DNS resolves.

If you don't own a domain yet, the `*.vercel.app` URL is already globally
reachable over HTTPS — a custom domain is a cosmetic/branding upgrade, not a
requirement for global availability.

## AI Teacher Assistant (schemes of work, lesson plans, quizzes, coding tutor)

These live in `api/ai/*.js` as Vercel serverless functions (Node, no
dependencies — plain `fetch` against the Anthropic API) and are called by
the frontend's "AI Tools" nav group. They need one environment variable to
work at all, set the same way regardless of which deploy option you used
above — **Vercel Project → Settings → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | From https://console.anthropic.com/settings/keys. Without it, every AI page shows a clear "not configured" error instead of failing silently. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5`. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | No | Only for the optional usage/telemetry log — see below. Everything works without these. |

After adding/changing any of these, redeploy for them to take effect (Option
A redeploys automatically on the next push; Option B on the next workflow
run — trigger one manually from the Vercel dashboard if you just want the
env var to apply without a code change).

**Testing locally**: `npm run dev` is a plain static file server with no
`/api` support, so it can't exercise the AI pages. Use the Vercel CLI's
local emulator instead, which runs both the static site and the `api/`
functions:

```bash
cd Musenga-MIS
npm install -g vercel   # once
vercel dev
```

### Optional: Supabase usage log (multi-tenant-ready, not required)

`supabase/schema.sql` defines a `schools` table (seeded with just Musenga)
and an `ai_usage` table scoped by `school_id`, with RLS enabled. This exists
so a second school can be added later (one `INSERT` + a new `schoolId`
passed from the frontend) without a schema change — it is **not** a
migration of the app's actual data (students, grades, etc.), which stays in
each device's IndexedDB exactly as it does today.

To enable it: create a free project at https://supabase.com, run
`supabase/schema.sql` in its SQL editor, then set `SUPABASE_URL` (Project
Settings → API) and `SUPABASE_SERVICE_ROLE_KEY` (same page — keep this
secret, it bypasses RLS) as Vercel environment variables. If you skip this
entirely, the AI features still work identically; usage just isn't logged
anywhere.

## What CI checks before any of this deploys

`.github/workflows/musenga-mis-ci.yml` runs `npm run validate`
(`scripts/validate.js`) on every push/PR touching `Musenga-MIS/`: it confirms
`public/index.html` is a well-formed HTML document and that every inline
`<script>` block parses as valid JavaScript, so a typo can't silently reach
production.
