# Integration Guide — drop into your existing VoltexAI repo

Your existing prototype already has Terminal/Analysis/Signals/Academy/Pricing pages and a FastAPI backend with 17 endpoints. This guide shows how to merge this finishing-work package without rewriting what's already there.

---

## Backend merge

### 1. Copy these into your backend folder
- `backend/services/claude_service.py`
- `backend/services/auth_service.py`
- `backend/services/stripe_service.py`
- `backend/services/flutterwave_service.py`
- `backend/services/subscription_service.py`
- `backend/middleware/auth_middleware.py`
- `backend/middleware/rate_limit.py`
- `backend/prompts/trading_prompts.py`
- `backend/models/` (all four — merge with your existing models or replace)
- `backend/routes/auth_routes.py`
- `backend/routes/ai_routes.py`
- `backend/routes/payment_routes.py`

### 2. Add to your `main.py`
```python
from .routes import auth_router, ai_router, payment_router
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(payment_router)
```

### 3. Add to `config.py` or your settings module
Copy the new env vars from `.env.example` — Anthropic, Stripe, Flutterwave, JWT.

### 4. Migrate DB
On first boot `init_db()` creates the new tables (`users`, `subscriptions`, `payments`, `conversations`, `messages`). If you already had `User` and `Subscription` tables, run an Alembic migration or drop-and-recreate your dev DB.

### 5. Install new deps
Add to `requirements.txt`:
```
anthropic==0.39.0
stripe==10.12.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.2
email-validator==2.2.0
```

---

## Frontend merge

### 1. Add new files
- `src/contexts/AuthContext.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/services/api.js`, `auth.js`, `payments.js`, `ai.js`
- `src/pages/Login.jsx`, `Signup.jsx`, `Forgot.jsx`, `Reset.jsx`, `Account.jsx`
- `src/voltexai.css` (or merge into your existing stylesheet)

### 2. Replace your existing Pricing.jsx
The new one is wired to real checkout. Keep your existing visual layout if you prefer — just lift the `startCheckout`, `paymentsService.listPlans`, and region toggle logic into it.

### 3. Replace or wrap your App.jsx
Wrap the existing `<BrowserRouter>` content in `<AuthProvider>`, and put protected pages inside `<ProtectedRoute>`. The provided `App.jsx` is a reference layout — adapt it to your route paths.

### 4. Update your existing Terminal/Analysis/Signals pages
Replace your previous fetch calls with the new service functions:
```js
// before
const res = await fetch("/api/chat", {...})

// after
import { aiService } from "../services/ai"
const data = await aiService.chat({ message, mode: "terminal" })
// or stream:
aiService.stream({ message, mode: "terminal" }, { onDelta, onDone, onError })
```

---

## Webhook setup

### Stripe
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://api.voltexai.app/api/payments/stripe/webhook`
3. Listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `invoice.payment_failed`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

For local dev:
```bash
stripe listen --forward-to localhost:8000/api/payments/stripe/webhook
# copy the printed whsec_… into your .env
```

### Flutterwave
1. FLW Dashboard → Settings → Webhooks
2. URL: `https://api.voltexai.app/api/payments/flutterwave/webhook`
3. Secret hash: invent a long random string, paste it both into the FLW dashboard and into your `FLW_WEBHOOK_HASH` env var
4. Flutterwave sends the secret in the `verif-hash` request header — the route compares against `FLW_WEBHOOK_HASH`

---

## Creating Stripe products

In Stripe Dashboard:
1. Products → Add product → **Trader**, $29/mo recurring
2. Products → Add product → **Elite**, $99/mo recurring
3. Copy each Price ID (`price_…`) into `STRIPE_PRICE_TRADER` and `STRIPE_PRICE_ELITE`

You can do it via API too:
```bash
stripe products create --name="VoltexAI Trader"
stripe prices create --product=prod_XXX --currency=usd --unit-amount=2900 \
  --recurring[interval]=month
```

---

## Testing the full flow

1. `POST /api/auth/register` → get tokens
2. `GET  /api/auth/me` → confirms free plan
3. `POST /api/ai/chat` with `{"message": "hi", "mode": "terminal"}` → streams a reply
4. `POST /api/payments/flutterwave/checkout` with `{"plan": "trader"}` → redirects to FLW
5. Complete the FLW sandbox payment
6. Webhook fires → `activate_plan` runs → user is now on Trader
7. `GET /api/ai/quota` → shows 250/day limit

---

## What's NOT included (next session)

- Transactional email for password reset (we print the token to console in dev)
- WhatsApp signal delivery (you have a separate Twilio bot for that)
- Admin dashboard (user list, payment ledger UI)
- Trade journal binding (your separate journaling app can hit `/api/ai/analyze-chart` with chart screenshots)
- Backtest data ingestion + RL agent endpoints (Option A/B from your OFA RL System)

Those are scoped for the next push.

— Done. Now run it. ⚡
