/**
 * Optional backend for DIRECT mobile-money charges (Flutterwave v3).
 *
 * The inline checkout in js/main.js needs no backend at all. Use this server
 * only if you prefer the direct-charge API (guest gets the USSD/PIN prompt
 * without leaving your page). The Flutterwave SECRET key must live here, on
 * the server, in an environment variable — NEVER in browser JavaScript,
 * where anyone could read it and charge/refund against your account.
 *
 * Run:
 *   FLW_SECRET_KEY=FLWSECK_TEST-xxxx node charge-server.js
 *
 * Then point the frontend at POST /api/pay with:
 *   { amount, phone, network, email, name, tier }
 */

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_API = "https://api.flutterwave.com/v3";

if (!FLW_SECRET_KEY) {
  console.error("Set FLW_SECRET_KEY (use your FLWSECK_TEST-… key while testing).");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(require("path").join(__dirname, "..")));

// Basic in-memory transaction log; swap for a database or Google Sheet in production.
const transactions = [];

const ZM_PHONE = /^(?:260|0)?(9[5678]|7[5678])\d{7}$/;

/* ----- RSVP storage (optional backup — WhatsApp is the primary channel) ----- */
const fs = require("fs");
const path = require("path");
const RSVP_FILE = path.join(__dirname, "rsvps.json");

function loadRsvps() {
  try {
    return JSON.parse(fs.readFileSync(RSVP_FILE, "utf8"));
  } catch (_) {
    return [];
  }
}

app.post("/api/rsvp", (req, res) => {
  const { name, phone, email, guests, events, message, submitted_at } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!ZM_PHONE.test(String(phone).replace(/\D/g, ""))) {
    return res.status(400).json({ error: "Invalid Zambian mobile number." });
  }
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "Select at least one event." });
  }

  const rsvps = loadRsvps();
  const entry = {
    id: "RSVP-" + Date.now(),
    name: String(name).trim().slice(0, 120),
    phone: String(phone).trim().slice(0, 20),
    email: String(email || "").trim().slice(0, 120),
    guests: Math.min(Math.max(Number(guests) || 1, 1), 10),
    events: events.map((e) => String(e).slice(0, 60)).slice(0, 10),
    message: String(message || "").trim().slice(0, 1000),
    submitted_at: submitted_at || new Date().toISOString(),
    received_at: new Date().toISOString(),
  };
  // Same phone re-submitting = an update, not a duplicate seat booking.
  const existing = rsvps.findIndex((r) => r.phone === entry.phone);
  if (existing >= 0) rsvps[existing] = entry;
  else rsvps.push(entry);
  fs.writeFileSync(RSVP_FILE, JSON.stringify(rsvps, null, 2));

  console.log(`[rsvp] ${entry.name} (${entry.phone}) — ${entry.guests} guest(s): ${entry.events.join(", ")}`);
  return res.json({ saved: true, id: entry.id });
});

// Guest list for the wedding committee (protect this in production —
// e.g. RSVP_ADMIN_TOKEN env var checked against a ?token= query).
app.get("/api/rsvp", (req, res) => {
  if (process.env.RSVP_ADMIN_TOKEN && req.query.token !== process.env.RSVP_ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  const rsvps = loadRsvps();
  const totalGuests = rsvps.reduce((sum, r) => sum + r.guests, 0);
  return res.json({ count: rsvps.length, totalGuests, rsvps });
});

app.post("/api/pay", async (req, res) => {
  const { amount, phone, network, email, name, tier } = req.body || {};

  const amt = Number(amount);
  if (![150, 250, 500].includes(amt)) {
    return res.status(400).json({ error: "Invalid amount." });
  }
  if (!ZM_PHONE.test(String(phone).replace(/\D/g, ""))) {
    return res.status(400).json({ error: "Invalid Zambian mobile number." });
  }
  if (!["MTN", "AIRTEL", "ZAMTEL"].includes(String(network).toUpperCase())) {
    return res.status(400).json({ error: "Network must be MTN, AIRTEL or ZAMTEL." });
  }

  const tx_ref = "OB-WED-" + Date.now();
  try {
    const flwRes = await fetch(`${FLW_API}/charges?type=mobile_money_zambia`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amt,
        currency: "ZMW",
        email: email || "guest@owenandbeauty.wedding",
        phone_number: phone,
        network: String(network).toUpperCase(),
        tx_ref,
        fullname: name || "Wedding Guest",
        meta: { tier },
      }),
    });
    const data = await flwRes.json();

    transactions.push({ tx_ref, amount: amt, phone, tier, at: new Date().toISOString(), status: data.status });
    console.log(`[pay] ${tx_ref} K${amt} ${phone} -> ${data.status}`);

    if (data.status === "success") {
      // Guest confirms the prompt on their phone; some networks return a
      // redirect URL for authorization — pass it to the frontend if present.
      return res.json({
        tx_ref,
        status: "pending",
        redirect: data?.meta?.authorization?.redirect || null,
        message: "Payment prompt sent — approve it on your phone with your PIN.",
      });
    }
    return res.status(502).json({ error: data.message || "Charge failed." });
  } catch (err) {
    console.error("[pay] error", err);
    return res.status(502).json({ error: "Payment service unreachable. Try again." });
  }
});

// Verify a transaction after the guest approves (poll from the frontend).
app.get("/api/verify/:txRef", async (req, res) => {
  try {
    const flwRes = await fetch(
      `${FLW_API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(req.params.txRef)}`,
      { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } }
    );
    const data = await flwRes.json();
    const ok =
      data.status === "success" &&
      data.data?.status === "successful" &&
      data.data?.currency === "ZMW";
    return res.json({ verified: ok, amount: data.data?.amount ?? null });
  } catch (err) {
    return res.status(502).json({ error: "Verification failed. Try again." });
  }
});

app.listen(PORT, () => console.log(`Wedding payment server on http://localhost:${PORT}`));
