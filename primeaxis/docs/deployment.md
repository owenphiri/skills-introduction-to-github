# Deployment & Environment Setup

Three supported paths, cheapest-first. All of them read the same
`.env` variables — see `.env.example` for the full annotated list.

## 0. Prerequisites (all paths)

1. **Secrets**: generate `JWT_SECRET` (`openssl rand -hex 64`).
2. **Stripe**: create 3 recurring Prices (Starter/Professional/Enterprise) →
   set `STRIPE_PRICE_*`, `STRIPE_SECRET_KEY`; add a webhook endpoint
   `https://<api-host>/webhooks/stripe` for `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.deleted` → `STRIPE_WEBHOOK_SECRET`.
3. **PayPal**: create a REST app (client id/secret) and a webhook for
   `PAYMENT.CAPTURE.COMPLETED` + `PAYMENT.CAPTURE.DENIED` → `PAYPAL_WEBHOOK_ID`.
4. **Coinbase Commerce**: API key + webhook shared secret; endpoint
   `https://<api-host>/webhooks/coinbase`.
5. **Icons**: drop the three PNGs into `apps/web/public/icons/` (see its README).

## 1. Vercel (web) + Railway (API + Postgres) — recommended start

**Railway**
1. New project → add **PostgreSQL** plugin (encrypted at rest, daily backups on paid plans).
2. Add a service from this repo, root `primeaxis/apps/api` (Railway detects the
   Dockerfile). Set env vars: `DATABASE_URL` (from the plugin), `JWT_SECRET`,
   `CORS_ORIGINS=https://<your-web-domain>`, all payment keys.
3. Deploy. Release command runs `npx prisma migrate deploy` (baked into the
   compose command; on Railway set it as the service "pre-deploy" command).
4. Seed once (optional): `railway run npm run seed`.

**Vercel**
1. Import the repo, set **Root Directory** to `primeaxis/apps/web`.
2. Env vars: `NEXT_PUBLIC_API_URL=https://<railway-api-domain>`,
   `NEXT_PUBLIC_WS_URL=https://<railway-api-domain>`.
3. Deploy — Next.js and the PWA (manifest + `/sw.js`) work out of the box.

**Render** is a drop-in alternative to Railway: create a Postgres instance +
a Web Service pointed at `apps/api` with the same env vars.

## 2. Single VPS with Docker Compose (full control / lowest cost)

```bash
git clone <repo> && cd primeaxis
cp .env.example .env   # fill everything in
docker compose up -d --build
```

Put Caddy or nginx in front for TLS:

```
api.yourfarm.com  → localhost:4000   # enable WebSocket proxying
app.yourfarm.com  → localhost:3000
```

(Caddy does this in 4 lines and auto-provisions Let's Encrypt certificates —
the repo's root `Caddyfile` from the sibling project is a working reference.)

Backups: `pg_dump` nightly via cron to object storage. The `pgdata` volume is
the only stateful thing in the stack.

## 3. AWS (scale-out)

- **RDS PostgreSQL** (Multi-AZ, encryption at rest) — paste the URL into `DATABASE_URL`.
- **ECS Fargate** for `apps/api` (build the Dockerfile via ECR). Put an ALB in
  front with **sticky sessions ON** (Socket.IO) or add the Redis adapter
  (`@socket.io/redis-adapter` + ElastiCache) once you run >1 API task.
- **Amplify Hosting or Vercel** for the web app.
- Secrets in **AWS Secrets Manager**, injected as env vars in the task definition.

## Production checklist

- [ ] `JWT_SECRET` rotated from the example; `.env` never committed
- [ ] HTTPS on both hosts; `CORS_ORIGINS` locked to the real web origin
- [ ] All 3 payment webhooks registered and their secrets set (test with
      `stripe listen --forward-to localhost:4000/webhooks/stripe`)
- [ ] `npx prisma migrate deploy` in the release step (never `migrate dev` in prod)
- [ ] Database backups scheduled + restore tested
- [ ] Error tracking (Sentry SDK drops into `main.ts` and Next.js in minutes)
- [ ] Uptime monitor on `GET /plans` (public, cheap, exercises DB)
- [ ] Rate limits reviewed for your traffic (`app.module.ts` throttler config)
- [ ] Seed data removed / demo accounts disabled on the production database
