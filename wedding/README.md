# 💍 Owen & Beauty — The Bold & The Beautiful

A production-ready, mobile-first wedding landing page for **Owen Phiri & Beauty Phiri**
— Kasama Church of Christ, Kasama, Zambia.

Pure HTML/CSS/JS: no build step, no framework. Host it on any static host
(GitHub Pages, Netlify, Vercel, cPanel) — **HTTPS is required** for payments.

## Features

- Hero with live countdown to the wedding date
- Our Story, Event Details (church programme), Gallery
- Invitation card tiers (Single K150 / Double K250 / VIP K500)
- **Mobile money payments** via Flutterwave (Airtel Money, MTN MoMo, Zamtel Kwacha)
  with a WhatsApp manual-payment fallback
- RSVP form that delivers straight to the couple's WhatsApp (no backend needed)
- Floating WhatsApp button with pre-populated greeting
- Responsive (mobile-first), smooth scrolling, scroll-reveal animations,
  reduced-motion support, no autoplay music

## Before you go live — 3 required edits

All configuration lives at the top of [`js/main.js`](js/main.js) in the `CONFIG` block:

1. **WhatsApp number** — set `whatsappNumber` to the couple's real number in
   international format without `+`, e.g. `260977123456`.
2. **Flutterwave public key** — set `flutterwavePublicKey`:
   - Create an account at <https://dashboard.flutterwave.com> (Flutterwave is
     licensed in Zambia and supports ZMW mobile money).
   - **Sandbox first:** switch the dashboard to *Test Mode*, copy the
     `FLWPUBK_TEST-…` public key, and test payments with Flutterwave's test
     mobile-money numbers.
   - **Production:** complete KYC, switch to *Live Mode*, and replace the key
     with your `FLWPUBK-…` live key.
   - Only the **public** key goes in this file — never the secret key.
     For server-side verification and webhooks (recommended), verify
     transactions with your secret key from a backend, keyed on the `tx_ref`
     (format `OB-WED-<Tier>-<timestamp>`).
   - Until a real key is set, the payment form automatically falls back to
     the WhatsApp payment option, so the site is safe to publish immediately.
3. **Wedding date** — confirm `weddingISO` / `weddingDisplay` (currently
   Sat 12 Dec 2026, 10:00 CAT).

## Photos

Drop the couple's photos into `img/`:

- `couple-story.jpg` — portrait (3:4) used in Our Story
- `gallery-1.jpg` … `gallery-6.jpg` — gallery grid

Until the files exist, the site shows elegant branded placeholders, so nothing
looks broken.

## Payment flow

1. Guest taps **Buy** on a card tier → modal collects name, mobile money
   number (validated for Zambian Airtel/MTN/Zamtel prefixes) and network.
2. Flutterwave inline checkout opens → guest receives a **payment prompt on
   their phone** → confirms with PIN.
3. On success, a confirmation with the transaction reference is pre-filled
   into WhatsApp so the couple's committee can log it and deliver the card.
4. Reconcile transactions in the Flutterwave dashboard against the
   `OB-WED-…` references.

### Alternative: direct-charge API (optional backend)

If you'd rather charge guests without the Flutterwave popup (USSD prompt only),
use [`server-example/charge-server.js`](server-example/charge-server.js). It
implements `POST /v3/charges?type=mobile_money_zambia` **server-side**, because
that endpoint requires your **secret** key (`FLWSECK_…`) — putting that key in
browser JavaScript would let anyone who views the page source charge and
refund against your Flutterwave account.

```bash
cd wedding/server-example
npm install express
FLW_SECRET_KEY=FLWSECK_TEST-xxxx node charge-server.js
```

It exposes `POST /api/pay` (sends the phone prompt, logs the transaction,
returns the authorization redirect if the network provides one) and
`GET /api/verify/:txRef` (server-side verification before you hand over a
card).

## Security notes

- Serve over **HTTPS only** (GitHub Pages/Netlify do this by default).
- Only the Flutterwave *publishable* key is in client code.
- All guest input is validated client-side; payment card/PIN entry happens
  inside Flutterwave's hosted checkout, never on this page.
- For airtight verification, add a tiny backend (or Flutterwave webhook →
  Google Sheet/Apps Script) that confirms each `tx_ref` server-side before
  issuing a card.

## Run locally

```bash
cd wedding
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy on GitHub Pages

Settings → Pages → deploy from branch, folder `/wedding` (or copy the folder
to its own repository). Custom domain optional.
