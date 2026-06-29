# ⚡ VoltexAI — Africa's AI Trading Terminal & Managed-Alpha Platform

**By PrimeAxis ICT Trade & Solutions Ltd · Methodology by Owens Forex Academy (OFA)**
_Trade Smart · Trade Safe · Trade Consistently._

VoltexAI is a full-stack, deploy-ready trading platform: a Claude-powered AI terminal,
a live multi-asset markets board, an algorithmic signal scanner, chart-vision analysis,
prop-firm & broker directories, an Africa-first payments stack, and a managed-AUM
program with an investor pitch deck — across **web, installable PWA, and a native
mobile app**.

---

## What's inside

```
voltexai/
├── backend/              FastAPI (Python 3.12)
│   ├── routes/           auth · ai · payments · markets · signals · directory · fund
│   ├── services/         claude · market_service · signal_engine · stripe · flutterwave
│   ├── data/             instruments · prop_firms · brokers · fund (AUM/pitch)
│   ├── models/           User · Subscription · Payment · Conversation · Message
│   ├── middleware/       JWT auth · plan-aware rate limiting
│   ├── prompts/          trading-domain system prompts (4 modes)
│   └── Dockerfile
├── frontend/             React + Vite (SPA + PWA)
│   ├── src/pages/        Landing · Markets · Signals · PropFirms · Brokers · AUM
│   │                     · Terminal · Pricing · Account · auth pages
│   ├── src/components/   NavBar · LiveTicker · Chart (candles/sparkline)
│   ├── src/services/     api · ai · markets · signals · directory · payments · auth
│   ├── public/           manifest · service worker · icons (installable PWA)
│   └── Dockerfile + nginx.conf
├── mobile/               Expo / React Native (Markets · Signals · AI · More)
├── docs/                 PITCH_DECK · DEPLOYMENT · API_REFERENCE · WEBHOOKS · INTEGRATION
├── docker-compose.yml    one-command stack (api + web + Postgres)
└── render.yaml           one-click Render.com blueprint
```

## Feature highlights

| Area | What it does |
|---|---|
| 🧠 **AI Terminal** | Claude streaming chat with 4 modes (Terminal/Analysis/Signals/Academy), vision chart analysis, conversation history, plan-aware quotas |
| 📈 **Live Markets** | 35 instruments across FX, metals, energy, indices, crypto, US equities — REST + **WebSocket** stream, candlesticks, movers. **Real feed via Twelve Data / Finnhub / Binance, plus real-time OANDA bid/ask streaming for forex & metals**, with a high-fidelity simulated fallback (zero-config) |
| ⚡ **Signal Scanner** | Deterministic quant engine (EMA/RSI/MACD/Bollinger/ATR + market structure) → ranked, risk-bracketed signals. No AI quota burned |
| 💹 **Trade Execution** | One-click trading from signals. Safe built-in **paper broker** (long/short, limit orders, P&L) by default, or **real execution via Alpaca** (paper/live). See [docs/TRADING.md](docs/TRADING.md) |
| 🏦 **Prop Firms** | Compare FTMO, FundedNext, FundingPips, The5ers, HolaPrime & more — splits, rules, payouts |
| 🏛️ **Brokers** | Regulated brokers with Africa-friendly funding (M-Pesa, local bank), spreads, leverage |
| 💼 **Managed AUM** | Investor pitch deck, equity curve, mandates, allocation, enquiry capture |
| 🧾 **Reconciliation** | Cross-venue statement: consolidated cash/equity/P&L, net exposure per symbol, automatic discrepancy flags (`/api/trade/reconciliation`) |
| ✉️ **Email + KYC** | Transactional email (console/SMTP/Resend) for verify, welcome & reset; KYC submit/review flow with optional live-trading gate |
| 💳 **Payments** | Stripe (cards/USD) + Flutterwave (MTN/Airtel/M-Pesa, ZMW/NGN/KES) with webhooks |
| 📱 **Web + Mobile** | Installable PWA (offline shell) + native Expo app sharing the same API |

> **Runs with zero external keys.** Markets, signals, directories and the AUM pages
> are fully functional out of the box. Add `ANTHROPIC_API_KEY` for the AI Terminal and
> Stripe/Flutterwave keys for live payments.

---

## 60-second quickstart (dev)

**Backend**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill JWT_SECRET (+ ANTHROPIC_API_KEY for AI)
cd ..                      # run uvicorn from the voltexai/ dir (package = backend)
uvicorn backend.main:app --reload --port 8000
# → http://localhost:8000/docs
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
# → http://localhost:5173
```

**Everything (Docker)**
```bash
docker compose up --build       # web :8080 · api :8000 · Postgres
```

**Mobile**
```bash
cd mobile && npm install && npx expo start
```

**Tests**
```bash
cd backend && pip install -r requirements-dev.txt
cd .. && pytest          # 31 tests: markets, signals, execution, router, auth, KYC, API
```

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Render/Docker/Expo production deploys
and **[docs/PITCH_DECK.md](docs/PITCH_DECK.md)** for the investor story.

---

## API surface (public unless noted)

```
GET  /api/markets/instruments | /quotes | /quote/{s} | /candles/{s} | /movers
WS   /api/markets/stream
GET  /api/signals | /signals/{s} | /signals/board/top
GET  /api/directory/prop-firms | /brokers
GET  /api/fund/summary | /performance | /pitch        POST /api/fund/enquire
GET  /api/trade/account | /positions | /orders | /broker | /reconciliation  (auth)
POST /api/trade/orders | /orders/{id}/cancel                         (auth, paid)
POST /api/auth/verify   GET /api/kyc/status   POST /api/kyc/submit          (auth)
POST /api/kyc/{user_id}/decision                                    (auth, admin)
POST /api/auth/register | /login | /refresh           GET  /api/auth/me   (auth)
POST /api/ai/chat | /stream | /signal | /analyze-chart                (auth)
POST /api/payments/stripe/checkout | /flutterwave/checkout            (auth)
```

---

## Important disclaimer

VoltexAI provides **technology and educational analysis, not personalised investment
advice**. Trading leveraged products carries a high risk of loss. AUM/performance
figures shown in the app and deck are **illustrative targets/model figures**, not
audited live results, and not a guarantee of future performance. Managed programs are
offered only where lawful and to eligible investors. Directory listings are editorial
reference, not endorsements.

— OFA / PrimeAxis ICT · Built for African traders.
