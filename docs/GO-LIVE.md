# Go-Live Guide — Connectivity

This system is built so that **live connectivity is a configuration change, not a
code change**. Below is exactly what it takes to switch from the demo (mock SMS,
local data) to a live deployment — and, honestly, what still requires people and
contracts that software alone cannot provide.

## 1. Real SMS / WhatsApp connectivity

The messaging layer is provider-agnostic (`server/messaging.js`). Two real
adapters ship ready:

### Option A — Africa's Talking (recommended; Zambian coverage)
1. Create an Africa's Talking account, top up SMS credit, and request an
   alphanumeric **sender ID** (`SAFEGIRL`) — this needs network approval.
2. Set:
   ```
   MESSAGING_PROVIDER=africastalking
   AT_USERNAME=your_at_username
   AT_API_KEY=your_at_api_key
   SMS_SENDER_ID=SAFEGIRL
   ```
3. In the Africa's Talking dashboard, point the **Delivery Report callback** at:
   ```
   https://YOUR_DOMAIN/api/webhooks/sms/delivery?token=YOUR_SMS_WEBHOOK_SECRET
   ```
   and set `SMS_WEBHOOK_SECRET` to the same value. Delivered/failed statuses then
   flow back into the outbox automatically.

### Option B — Direct telco / aggregator (Zamtel, MTN, Airtel)
Set `MESSAGING_PROVIDER=http`, `SMS_API_URL`, `SMS_API_KEY`, and adjust the
payload in the `http` provider to match the vendor's API. Delivery reports use
the same webhook.

> Test against the **sandbox** first (`AT_API_URL=https://api.sandbox.africastalking.com/version1/messaging`)
> before sending to real guardians.

## 2. Counseling reminders
No setup needed — the dispatcher runs hourly (`REMINDER_INTERVAL_MS`) and on
startup, sending each due session/follow-up reminder exactly once. Counselors
can also trigger it manually from the Counseling screen.

## 3. Package tiers (commercial model)
Each school's `package` (bronze/silver/gold/platinum) gates features server-side
(HTTP 402 when a school's tier is too low) and hides locked tabs in the UI. Set a
school's tier when registering it, or update the `schools.package` column.

## 4. Deployment with TLS (Docker Compose + Caddy)

A one-command deployment ships in `docker-compose.yml` + `Caddyfile`. Caddy
terminates HTTPS with automatic Let's Encrypt certificates; the app runs on an
internal network and is never exposed directly.

```bash
cp .env.example .env          # set DOMAIN, MESSAGING_PROVIDER, SMS creds, secrets
docker compose up -d          # app + Caddy (auto-HTTPS) come up
```

The database lives on the `sewsms-data` volume — **encrypt this volume at the
host level** (e.g. LUKS / cloud disk encryption) to satisfy encryption-at-rest.

## 5. Guardian consent & QR check-in (built in)
- **Consent gate:** no SMS is sent about a learner until a guardian's consent is
  recorded as `granted`; blocked attempts are logged. Capture consent per learner
  on the student profile.
- **QR check-in (Platinum):** each learner has a printable QR code; the check-in
  kiosk marks attendance in seconds.

## 6. What software cannot do for you (the honest part)
Connectivity ≠ compliance. Before sending a single live message about a real
child, the following must be in place — none are code:

- [ ] **Signed contract** with the SMS aggregator/telcos and an approved sender ID.
- [ ] **Data Protection Act No. 3 of 2021** registration + a DPIA for processing minors.
- [ ] **Ministry of Education** safeguarding sign-off and **guardian consent** captured.
- [ ] **Native-speaker + MoE approval** of every local-language template (the review
      workflow is built; the approvals are a human task).
- [ ] **TLS** in front of the app and **encryption at rest** for the database volume.
- [ ] An independent **security penetration test**.
- [ ] **Backups** and an incident-response plan.

See `docs/ROADMAP.md` for the full production checklist. The build is ready;
these items are the path to responsibly turning it on.
