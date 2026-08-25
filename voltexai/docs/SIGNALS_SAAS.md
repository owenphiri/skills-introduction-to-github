# Voltex Signals SaaS — setup

The managed pipeline: **TradingView → Voltex Signal Engine → Free/VIP + MT5**.
Everything works with no config (signals just log instead of posting to Telegram).
Add these in **Render → voltexai-api → Environment** to go live:

| Variable | Purpose |
|---|---|
| `TRADINGVIEW_WEBHOOK_SECRET` | shared secret TradingView must include in the alert body |
| `SIGNAL_MIN_SCORE` | minimum Voltex Quality Score to accept/publish (default 70) |
| `TELEGRAM_BOT_TOKEN` | BotFather token for `@VoltexAIForexBot` |
| `TELEGRAM_FREE_CHANNEL` | free channel `@handle` or `-100…` id |
| `TELEGRAM_VIP_CHANNEL` | VIP channel `@handle` or `-100…` id |
| `MT5_GATEWAY_KEY` | shared key the MT5 EA uses to pull signals / post events |

## TradingView alert
Webhook URL: `https://voltexai-api.onrender.com/api/pro-signals/webhook`
(TradingView needs ports 80/443 and a <3s response — the engine acks fast.)

Alert message (JSON):
```json
{
  "secret": "YOUR_TRADINGVIEW_WEBHOOK_SECRET",
  "symbol": "XAUUSD",
  "direction": "BUY",
  "timeframe": "15",
  "entry": 3385.50,
  "sl": 3378.50,
  "strategy": "Voltex AI SwingMaster",
  "session": "London",
  "signal_id": "XAUUSD-20260825-001",
  "htf": true, "liquidity": true, "ob": true, "fvg": true,
  "trend": true, "momentum": true
}
```
The engine computes TP1–TP4 (1:R ladder), the Voltex Quality Score + grade,
rejects setups below `SIGNAL_MIN_SCORE`, dedupes by `signal_id`, stores the
signal, and posts the basic card to Free and the full setup to VIP.
**Never put broker/MT5 credentials in the webhook.**

## MT5 EA (gateway key)
- Pull active signals: `GET /api/pro-signals/mt5/pull` with header `X-Gateway-Key: <key>`
- Report a lifecycle event: `POST /api/pro-signals/{uuid}/events` with `X-Gateway-Key`
  body `{ "event": "filled|tp1|tp2|tp3|tp4|be|closed|cancelled", "price": …, "result_r": … }`
- Report an execution: `POST /api/pro-signals/mt5/execution` with `X-Gateway-Key`

## Feed & VIP gating
- `GET /api/pro-signals/feed` — free users get a preview (entry + TP1); VIP
  (Trader/Elite plan) or admins get the full entry zone, SL and TP2–TP4.
- `GET /api/pro-signals/performance` — win rate, profit factor, total R, weekly report.
- Admin can post a manual signal: `POST /api/pro-signals` (JWT, admin role).

## Telegram bot + Stars subscriptions (Phase 3)

Extra env vars:
| Variable | Purpose |
|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | secret path segment for the webhook |
| `TELEGRAM_BOT_USERNAME` | bot handle for deep links (default `VoltexAIForexBot`) |

Setup:
1. Create the bot with **@BotFather**, set `TELEGRAM_BOT_TOKEN`.
2. In BotFather, enable payments with **Telegram Stars** (no provider token needed).
3. Add the bot as **admin** of the VIP channel (`TELEGRAM_VIP_CHANNEL`) so it can mint invite links.
4. As an admin user call **`POST /api/telegram/set-webhook`** (JWT) — it registers
   `https://voltexai-api.onrender.com/api/telegram/webhook/<secret>` with Telegram.

Commands: `/start /help /vip /subscribe /signals /performance /status /rules /support`
plus an inline menu. Plans (Stars): **VIP Basic 30d = 499⭐ (recurring)**,
**VIP Pro 90d = 1299⭐**, **VIP Elite 365d = 3999⭐**.

Payment flow: buy button → `sendInvoice` (XTR) → `pre_checkout_query` auto-approved
→ `successful_payment` grants/extends `vip_until`, records the charge, and DMs a
single-use VIP channel invite link. The MT5 EA / server can check VIP with
`GET /api/telegram/vip/{telegram_id}` (gateway key).

## RL self-optimizing scoring (Phase 4)

An online contextual-bandit layer learns which confluence components actually
produce winners and re-scores incoming signals accordingly:

- **Features:** the 0–1 confluence vector (structure, liquidity, OB, FVG, trend,
  momentum, session, RR, HTF) captured on every signal (`rl_observations`).
- **Model:** online logistic regression predicting P(win); one SGD step per
  closed trade, reward-weighted by |R|. Weights persist in `rl_model_state`.
- **Scoring:** `rl_score = P(win)×100`; `combined_score` blends the deterministic
  base score with the RL score, trusting RL more as it accumulates updates
  (confidence = updates/(updates+20), capped 70%). Once the model has ≥5 updates
  the min-score gate uses `combined_score`, so only setups the model believes in
  get published.
- **Learning:** `POST /{uuid}/events` with a closing `result_r` triggers a step.
- **Inspect:** `GET /api/pro-signals/rl/model` returns learned importance, win
  rate, confidence and status (learning → optimized). Shown on the admin desk;
  `rl_score`/`combined_score` appear on the feed and signal cards.
