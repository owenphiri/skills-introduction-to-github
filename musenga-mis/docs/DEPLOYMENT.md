# Deploying Musenga MIS to Vercel

This app is a single static HTML file (`public/index.html`), so hosting it is
just "serve this file over HTTPS from a CDN." Vercel does that for free with
a global edge network, automatic HTTPS, and preview URLs per pull request —
which covers "accessible anywhere across the globe."

There are two ways to wire up continuous deployment. **Pick one, not both**
(running both at once means two things deploying the same folder).

## Option A — Vercel Git integration (recommended, simplest)

No GitHub secrets to manage; Vercel's own GitHub App does the building.

1. Sign in at https://vercel.com (or create an account) and click **Add New
   → Project**.
2. Import this GitHub repository (`owenphiri/skills-introduction-to-github`).
3. When asked for the project settings:
   - **Root Directory**: `musenga-mis`
   - **Framework Preset**: `Other`
   - Build/output settings are already picked up from `musenga-mis/vercel.json`
     (`outputDirectory: public`) — no build command needed.
4. Click **Deploy**. Vercel gives you a live URL immediately, e.g.
   `musenga-mis.vercel.app`.
5. From then on: every push to `main` redeploys production automatically,
   and every pull request gets its own preview URL posted as a GitHub check —
   no extra workflow needed. You can leave
   `.github/workflows/musenga-mis-deploy.yml` in the repo unused (it
   no-ops safely without secrets), or delete it if you don't want the
   duplicate CI entry.

## Option B — GitHub Actions + Vercel CLI (this repo's `musenga-mis-deploy.yml`)

Use this if you want the deploy to show up as a GitHub Actions run (e.g. to
gate it on other checks, or because your org standardizes on Actions for
deploys). It reads `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
from GitHub repo secrets. If Vercel's Git integration (Option A) is already
handling deploys for this project, don't also set these secrets, or you'll
get duplicate deployments.

1. Create a Vercel project once (either via `vercel link` locally from
   `musenga-mis/`, or by importing it in the dashboard and then removing the
   Git integration from **Project Settings → Git** so it stops
   auto-deploying and only this workflow deploys it).
2. Get the three values:
   - `VERCEL_TOKEN` — https://vercel.com/account/tokens → Create Token.
   - `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` — run `vercel link` inside
     `musenga-mis/` once locally; it writes `.vercel/project.json` with both
     IDs (that folder is gitignored, don't commit it).
3. In the GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, add all three.
4. Push to `main` (or open a PR) — `.github/workflows/musenga-mis-deploy.yml`
   builds and deploys automatically. PRs get a comment with the preview URL.

## Custom domain

Once the project is live under `*.vercel.app` (either option above), point
your own domain at it:

1. In the Vercel dashboard: **Project → Settings → Domains → Add**.
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

## What CI checks before any of this deploys

`.github/workflows/musenga-mis-ci.yml` runs `npm run validate`
(`scripts/validate.js`) on every push/PR touching `musenga-mis/`: it confirms
`public/index.html` is a well-formed HTML document and that every inline
`<script>` block parses as valid JavaScript, so a typo can't silently reach
production.
