# Webhooks Setup — Stripe & Flutterwave

Webhooks are how VoltexAI hears that a payment succeeded. Without them, users pay but their plan never upgrades. **Set both up before going live.**

---

## Stripe

### Production
1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. Endpoint URL: `https://api.voltexai.app/api/payments/stripe/webhook`
3. Listen for these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.updated`
   - `invoice.payment_failed`
4. Click the endpoint → **Reveal signing secret** → copy `whsec_…`
5. Paste it into your `.env` as `STRIPE_WEBHOOK_SECRET`

### Local dev (Stripe CLI)
```bash
brew install stripe/stripe-cli/stripe       # or scoop / apt
stripe login
stripe listen --forward-to localhost:8000/api/payments/stripe/webhook
```
The CLI prints a `whsec_…` secret on first connect. Put it in `.env` for development.

To fire a test event:
```bash
stripe trigger checkout.session.completed
```

### Test cards
- Success: `4242 4242 4242 4242`, any future date, any CVC
- 3-D Secure required: `4000 0027 6000 3184`
- Decline: `4000 0000 0000 0002`

---

## Flutterwave

### Production
1. Dashboard → **Settings → Webhooks**
2. URL: `https://api.voltexai.app/api/payments/flutterwave/webhook`
3. **Secret hash**: invent a long random string (e.g. `openssl rand -hex 32`). Paste it in the FLW dashboard AND in your `.env` as `FLW_WEBHOOK_HASH`.
4. FLW sends this string in the `verif-hash` request header on every webhook call. The backend compares it constant-time before processing.

### Events you'll receive
- `charge.completed` (most important) — body includes `data.status` which must be `"successful"` before activation. The route also calls `GET /v3/transactions/{id}/verify` server-side as a second check.
- `subscription.cancelled`

### Test mode
1. Use your `FLWSECK_TEST-…` keys
2. Test MoMo flow (Zambia): pick MTN MoMo on the hosted page; FLW will show a sandbox PIN screen. Enter `0000` to succeed.
3. Test card: `4187 4274 1556 4246` · CVV `828` · expiry any future · PIN `3310` · OTP `12345`

### Tunnel for local webhooks
Flutterwave can't reach `localhost`. Use ngrok:
```bash
ngrok http 8000
# copy the https URL, paste it as the webhook URL in the FLW dashboard
# e.g. https://abc-123.ngrok.io/api/payments/flutterwave/webhook
```

---

## Verifying webhooks are working

After completing a test purchase, you should see:

1. **Server logs**:
   ```
   INFO | voltexai | Stripe webhook: checkout.session.completed
   INFO | voltexai | FLW webhook: charge.completed
   ```
2. **Database**:
   - `subscriptions` row updated to `plan=trader|elite, status=active, current_period_end=…`
   - new `payments` row with `status=success`
3. **Frontend**: refresh `/account` → plan pill shows `TRADER` or `ELITE`

If webhook arrives but plan doesn't activate, check:
- `metadata.user_id` and `metadata.plan` are present in the event (Stripe Checkout Session metadata is set by `stripe_service.create_checkout_session`)
- FLW `meta.user_id` and `meta.plan` are present (set by `flutterwave_service.create_payment_link`)

---

## Idempotency

Both providers may retry webhooks. The handlers are safe to call multiple times:
- `activate_plan()` is an upsert — it updates the existing subscription row instead of creating duplicates
- Payment records are keyed by `provider_ref` (Stripe session id / FLW tx_ref) — duplicate webhook deliveries result in repeated `status` flips but no double-billing or double-records

For stricter idempotency in production, add a unique constraint on `payments.provider_ref` and catch `IntegrityError`.
