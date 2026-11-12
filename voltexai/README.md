# ⚡ VoltexAI — Africa's AI Trading Terminal & Managed-Alpha Platform

**By PrimeAxis ICT Trade & Solutions Ltd · Methodology by Owens Forex Academy (OFA)**
_Trade Smart · Trade Safe · Trade Consistently._

**Live:** https://voltexai.vercel.app · **API:** https://voltexai-api.onrender.com/docs

---

## 1. The concept

Most retail traders lose money for three reasons: they trade without a plan, they
size positions by emotion, and they have no honest record of what works. VoltexAI
puts the tools that address those three problems in one place, priced and paid for
in a way that works for African traders.

The platform is built on four ideas:

1. **Rules before opinions.** Signals come from a deterministic engine (trend,
   momentum, volatility and market structure), each with a stop, targets and a
   quality grade. The AI explains a signal that has already been computed; it never
   invents price levels.
2. **Safe by default.** Every account starts on a built-in paper broker with
   simulated money. Real execution only happens when the operator deliberately
   configures a broker, and a demo environment is the default even then.
3. **Honest numbers.** Win rates are computed from closed trades, backtests are
   stamped when they ran on synthetic data, and fund figures are labelled as
   illustrative. Nothing in the product promises a profit.
4. **Africa-first access.** Mobile money (MTN MoMo, Airtel Money, M-Pesa) sits
   beside cards, prices show in local currency, and the web app installs to a phone
   and keeps an offline shell.

VoltexAI is technology and education. It is not personalised investment advice.
See the [disclaimer](#12-disclaimer).

---

## 2. What it does

| Area | What you get |
|---|---|
| 🧠 **AI Terminal** | Claude chat with four modes (Terminal, Analysis, Signals, Academy), chart-image analysis, saved conversations, daily quota by plan |
| 📈 **Live markets** | 35 instruments across forex, metals, energy, indices, crypto and US stocks, over REST and WebSocket. Real feeds via Twelve Data, Finnhub or Alpha Vantage, OANDA bid/ask streaming for forex and metals, and a simulated fallback when no key is set |
| ⚡ **Signals** | Ranked, risk-bracketed setups with an A+ to C grade and a plain-language rationale. VIP Pro Signals reach Telegram channels and the in-app feed |
| 🌊 **ICT liquidity engine** | Maps liquidity pools, premium and discount zones and sweep-then-reversal setups around news events, with a walk-forward backtest of the score |
| 🔀 **Arbitrage scanner** | Fee-aware cross-venue spread scanner with a paper executor |
| 🧩 **Chart patterns & top-down** | Pattern library with multi-timeframe confluence, top-down analysis, sentiment board |
| 💹 **Trade execution** | One-click orders from a signal. Paper broker by default; OANDA (forex, metals, indices, energy) and Alpaca (stocks, crypto) when configured; a router that sends each order to the right venue |
| 🤖 **MT5 Expert Advisor** | `mt5/VoltexAI_EA.mq5` pulls Pro Signals and places risk-sized positions in MetaTrader 5 |
| 📓 **Journal & reconciliation** | Trade journal with heatmap and calendar; cross-venue statement of cash, equity, exposure and discrepancies |
| 🏦 **Directories** | Prop firms and regulated brokers compared on rules, payouts, funding methods and spreads |
| 💼 **Managed AUM** | Investor pitch deck, model equity curve, mandates and enquiry capture |
| 💳 **Payments** | Stripe (cards) and Flutterwave (mobile money and local cards), four billing periods, a one-time Store, branded receipts |
| 🪙 **Voltex Coin** | Cashback on purchases, redeemable for up to 30% off a checkout |
| ✉️ **Mailing & consent** | Newsletter signup, weekly digest, transactional email, cookie-consent banner |
| 👥 **Growth** | Referrals, community, competitions, white-label tenants, admin analytics |
| 📱 **Web + mobile** | Installable PWA and an Expo (React Native) app on the same API |

The platform runs with no external keys: markets, signals, directories and paper
trading all work on first start. Keys switch on the AI, real data, payments, email
and live brokers.

---

## 3. How it fits together

```
 Browser / PWA / Expo app
          │  HTTPS + WebSocket
          ▼
 React + Vite frontend ──────────►  Vercel
          │  VITE_API_URL
          ▼
 FastAPI backend (Python) ───────►  Render
   ├─ JWT auth, plan gates, rate limits
   ├─ signal engine · liquidity · arbitrage · patterns
   ├─ execution router ──► paper │ OANDA │ Alpaca
   ├─ market data ───────► Twelve Data │ Finnhub │ Alpha Vantage │ simulated
   ├─ Claude (Anthropic API)
   ├─ Stripe + Flutterwave (checkout and webhooks)
   └─ email (console │ SMTP │ Resend) · Telegram bot
          │  SQLAlchemy
          ▼
 Postgres ───────────────────────►  Supabase (SQLite in development)
```

The frontend never talks to the database. Every request goes through the API,
which checks the user's token and plan.

```
voltexai/
├── backend/         FastAPI app: routes · services · models · middleware · tests
├── frontend/        React + Vite single-page app and PWA
├── mobile/          Expo / React Native app
├── mt5/             MetaTrader 5 Expert Advisor
├── mcp_server/      Read-only MCP server (market data, demo account) for AI agents
├── supabase/        schema.sql and connection guide
├── scripts/         send_digest.py (weekly email), deriv_smoke.py
├── docs/            Deployment, API, trading, webhooks, market data, pitch deck
├── docker-compose.yml   api + web + Postgres in one command
└── render.yaml      Render blueprint
```

---

## 4. Run it locally

**Backend** (Python 3.11 or 3.12)

```bash
cd voltexai/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set JWT_SECRET; everything else is optional
cd ..                           # run from voltexai/ so `backend` is importable
uvicorn backend.main:app --reload --port 8000
# API docs → http://localhost:8000/docs
```

**Frontend** (Node 20)

```bash
cd voltexai/frontend
npm install
cp .env.example .env.local      # VITE_API_URL=http://localhost:8000
npm run dev
# App → http://localhost:5173
```

**Everything with Docker**

```bash
cd voltexai && docker compose up --build    # web :8080 · api :8000 · Postgres
```

**Mobile**

```bash
cd voltexai/mobile && npm install && npx expo start
```

**Tests**

```bash
cd voltexai/backend && pip install -r requirements-dev.txt
cd .. && pytest                 # 260+ tests
cd frontend && npm run build    # production build check
```

---

## 5. Deploy to production

The production setup is **Vercel** (web), **Render** (API) and **Supabase**
(database). Do the steps in this order.

### Step 1 — Database on Supabase

1. Create a project at supabase.com.
2. Copy the connection string from Project Settings → Database. Use the session
   pooler or direct connection on port `5432`.
3. Keep it for step 2 as `DATABASE_URL`. Tables are created on first start.
   `supabase/schema.sql` also locks the public data API with deny-all row security.

Details: [supabase/README.md](supabase/README.md).

### Step 2 — API on Render

1. New → Web Service → connect this repository, branch `main`.
2. Build command: `pip install -r voltexai/backend/requirements.txt`
3. Start command: `cd voltexai && uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Health check path: `/health`
5. Add the environment variables from [section 6](#6-environment-variables). The
   minimum is `ENVIRONMENT=production`, `DATABASE_URL`, `JWT_SECRET`,
   `FRONTEND_URL` and `CORS_ORIGINS`.

`render.yaml` describes the same service as a blueprint if you prefer one click.

The free Render instance sleeps when idle and wipes local disk on every deploy. Use
a paid instance for live streaming, and never run production on the SQLite default.

### Step 3 — Web on Vercel

1. New Project → import this repository.
2. Root directory: `voltexai/frontend`. Vercel detects Vite.
3. Set `VITE_API_URL` to the Render URL, plus `VITE_STRIPE_PUBLISHABLE_KEY` and
   `VITE_FLW_PUBLIC_KEY` if you take payments.
4. Deploy. Every push to `main` redeploys.

### Step 4 — Custom domain

1. Add the domain to the Vercel project and follow its DNS instructions.
2. On Render, set `FRONTEND_URL` and `CORS_ORIGINS` to the new address so checkout
   redirects, email links and browser requests work.

### Step 5 — Payment webhooks

| Provider | Webhook URL | Secret to set |
|---|---|---|
| Stripe | `https://<api>/api/payments/stripe/webhook` | `STRIPE_WEBHOOK_SECRET` |
| Flutterwave | `https://<api>/api/payments/flutterwave/webhook` | `FLW_WEBHOOK_HASH` |

A plan is only activated when the webhook confirms payment. Details:
[docs/WEBHOOKS_SETUP.md](docs/WEBHOOKS_SETUP.md).

### Step 6 — Automatic backend deploys

The CI workflow can deploy the API after tests pass on `main`. In the GitHub
repository settings, under Secrets and variables → Actions:

- Secret `RENDER_DEPLOY_HOOK_URL` — from Render → service → Settings → Deploy Hook
- Variable `ENABLE_RENDER_DEPLOY` = `true`

Without these, deploy the API by hand from the Render dashboard after each merge.

### Step 7 — Check it

- `https://<api>/health/ready` returns OK when the database is reachable.
- `https://<api>/api/payments/plans` returns five plans, each with four periods.
- Sign up on the web app, open Markets, and place a paper trade.

Other targets: Docker on your own server and Netlify are covered in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/GO_LIVE.md](docs/GO_LIVE.md);
GitLab CI with Firebase Hosting is in
[../docs/DEPLOY_GITLAB_FIREBASE.md](../docs/DEPLOY_GITLAB_FIREBASE.md).

---

## 6. Environment variables

Set these on the API host. Only the first group is required.

| Group | Variables | Notes |
|---|---|---|
| **Core (required)** | `ENVIRONMENT`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `BASE_URL`, `CORS_ORIGINS` | `JWT_SECRET` must be 32+ random characters |
| **AI** | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Without a key the AI Terminal is off; signal rationales fall back to a rule-based text |
| **Market data** | `MARKET_DATA_PROVIDER`, `TWELVEDATA_API_KEY`, `FINNHUB_API_KEY`, `ALPHAVANTAGE_API_KEY` | `auto` picks the first provider with a key, else simulated prices |
| **Brokers** | `BROKER`, `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`, `OANDA_ENVIRONMENT`, `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ALPACA_BASE_URL`, `PAPER_STARTING_BALANCE`, `REQUIRE_KYC_FOR_LIVE` | See [section 7](#7-from-paper-to-a-live-account) |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_<PLAN>`, `STRIPE_PRICE_<PLAN>_ANNUAL` | Price IDs are optional; without them the amount is sent inline |
| **Flutterwave** | `FLW_SECRET_KEY`, `FLW_PUBLIC_KEY`, `FLW_ENCRYPTION_KEY`, `FLW_WEBHOOK_HASH`, `USD_TO_ZMW_RATE` | Mobile money and African cards |
| **Email** | `EMAIL_PROVIDER` (`console`, `smtp`, `resend`), `EMAIL_FROM`, `SMTP_*`, `RESEND_API_KEY` | `console` only writes to the log |
| **Telegram & MT5** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_FREE_CHANNEL`, `TELEGRAM_VIP_CHANNEL`, `TELEGRAM_WEBHOOK_SECRET`, `MT5_GATEWAY_KEY`, `TRADINGVIEW_WEBHOOK_SECRET` | Signal delivery and the Expert Advisor |

Full list with defaults: `backend/.env.example` and `backend/config.py`. Never
commit real keys; set them in the host's dashboard.

---

## 7. From paper to a live account

`BROKER` decides where orders go:

| `BROKER` | Orders go to |
|---|---|
| `paper` (default) | Built-in simulated broker. No real money. |
| `oanda` | OANDA only |
| `alpaca` | Alpaca only |
| `router` | OANDA for forex, metals, indices and energy; Alpaca for stocks and crypto; paper for anything not configured |

If the chosen broker's keys are missing, the API falls back to paper.

Move up one stage at a time:

1. **Paper.** Leave `BROKER=paper`. Learn the flow with simulated money.
2. **Demo with real prices.** Set `OANDA_API_TOKEN` and `OANDA_ACCOUNT_ID` from an
   OANDA practice account, keep `OANDA_ENVIRONMENT=practice`, set `BROKER=oanda` or
   `router`, and add a market-data key. Check that orders, stops, targets and
   position sizes match what you asked for, and that Reconciliation shows no
   discrepancies.
3. **Small live account.** Only after stage 2 is clean: switch the token and
   account ID to a live account and set `OANDA_ENVIRONMENT=live`. For Alpaca, point
   `ALPACA_BASE_URL` at the live host. Start with the smallest position size, and
   consider `REQUIRE_KYC_FOR_LIVE=true`.

Read [docs/TRADING.md](docs/TRADING.md) before stage 3. The liquidity backtest
currently runs on synthetic candles and says so in its output; treat its results as
a test of the logic, not as evidence of live performance.

---

## 8. Plans and billing

| Plan | Monthly | AI calls / day | Adds |
|---|---|---|---|
| Free | $0 | 10 | Delayed prices, community, session replays |
| Starter | $19 | 60 | Real-time data, calendar, basic journal, pattern scanner |
| Trader | $49 | 300 | VIP Pro Signals, full pattern library, chart vision, advanced journal |
| Pro | $99 | 800 | MT5 Expert Advisor, copy trading, prop-firm challenges, backtest critique |
| Elite | $199 | 2,500 | 1:1 monthly call, public API access, priority support |

Each paid plan can be billed four ways. Longer periods cost less per month:

| Period | Discount | Trader example |
|---|---|---|
| Monthly | none | $49.00 |
| 3 months | 5% | $139.65 |
| 6 months | 10% | $264.60 |
| Annual | 2 months free (about 17%) | $490.00 |

All prices and discounts live in `backend/services/pricing_service.py` and the
`PLAN_*_USD` settings. Change them there and the catalog, checkout amounts,
receipts and the Pricing page all follow.

---

## 9. CI/CD

`.github/workflows/voltexai-ci.yml` runs on every push that touches `voltexai/`:

- Backend test suite
- Frontend production build
- Dependency audit (advisory)
- Optional deploy jobs from `main`, each switched on by a repository variable:
  `ENABLE_VERCEL_DEPLOY`, `ENABLE_NETLIFY_DEPLOY`, `ENABLE_RENDER_DEPLOY`

---

## 10. API overview

Interactive reference: `https://<api>/docs`. Written reference:
[docs/API_REFERENCE.md](docs/API_REFERENCE.md).

```
/api/auth         register · login · refresh · verify · me
/api/markets      instruments · quotes · candles · movers · WS stream
/api/signals      scanner board · per-symbol signal · rationale
/api/pro-signals  VIP feed · performance · MT5 pull
/api/liquidity    map · assess · news board · backtest
/api/arbitrage    scan · quotes · status · run (paper)
/api/patterns     chart-pattern scanner
/api/trade        account · positions · orders · reconciliation
/api/autotrade    automated execution settings
/api/ai           chat · stream · signal · analyze-chart
/api/payments     plans · stripe/flutterwave checkout · webhooks · store · cancel
/api/coin         Voltex Coin wallet and redemption
/api/mailing      newsletter subscribe · campaigns · digest
/api/journal      trade journal          /api/kyc        submit · status · review
/api/referrals    referral program       /api/community  posts and social
/api/directory    prop firms · brokers   /api/fund       AUM summary · enquiry
/api/tenant       white-label tenants    /api/admin      analytics (admin only)
/health  ·  /health/ready
```

---

## 11. More documentation

| Document | Covers |
|---|---|
| [docs/GO_LIVE.md](docs/GO_LIVE.md) | Full launch runbook |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, Expo and alternative hosts |
| [docs/TRADING.md](docs/TRADING.md) | Brokers, order types, risk controls |
| [docs/MARKET_DATA.md](docs/MARKET_DATA.md) | Data providers and fallbacks |
| [docs/WEBHOOKS_SETUP.md](docs/WEBHOOKS_SETUP.md) | Stripe, Flutterwave, Telegram, TradingView |
| [docs/SIGNALS_SAAS.md](docs/SIGNALS_SAAS.md) | Pro Signals product |
| [docs/VOLTEX_COIN.md](docs/VOLTEX_COIN.md) | Cashback and redemption rules |
| [docs/WHITE_LABEL.md](docs/WHITE_LABEL.md) | Running VoltexAI for another brand |
| [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) | Using the API from other systems |
| [docs/PITCH_DECK.md](docs/PITCH_DECK.md) | Investor story |
| [mt5/README.md](mt5/README.md) | Installing the Expert Advisor |
| [mcp_server/README.md](mcp_server/README.md) | Read-only MCP server for AI agents |

---

## 12. Disclaimer

VoltexAI provides **technology and educational analysis, not personalised
investment advice**. Trading leveraged products carries a high risk of loss, and
most retail traders lose money. Signals, backtests and scanner output are not
guarantees. AUM and performance figures shown in the app and deck are
**illustrative model figures**, not audited live results. Hypothetical and
backtested results have inherent limitations and do not represent actual trading.
Managed programs are offered only where lawful and to eligible investors. Directory
listings are editorial reference, not endorsements.

— OFA / PrimeAxis ICT · Built for African traders.
