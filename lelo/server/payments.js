'use strict';

/**
 * Mobile-money collections.
 *
 * We are never the merchant of record. A licensed Zambian PSP holds the float,
 * settles to our bank account, and we hold only a record of what they told us.
 * That boundary is the reason this service does not need a Bank of Zambia
 * payment-service licence of its own — see docs/COMPLIANCE.md. Keep it: the
 * moment this file starts holding customer funds, the regulatory position
 * changes completely.
 *
 * Collections are pull-initiated from the subscriber's side (they approve a
 * prompt with their PIN). We never hold a mandate to debit at will.
 */
const crypto = require('node:crypto');
const db = require('./db');
const config = require('./config');
const money = require('./money');
const wallet = require('./wallet');

const providers = {
  /**
   * Demo provider: records the intent and settles nothing. The whole service
   * is therefore demonstrable end to end with no PSP account.
   */
  async mock({ amountNgwee }) {
    return { ok: true, pspRef: `mock-${crypto.randomUUID()}`, status: 'pending', amountNgwee };
  },

  /**
   * Generic JSON collection API. Most Zambian aggregators (Lipila, PawaPay,
   * Lenco, CGrate) expose the same shape: post an amount and an MSISDN, get
   * back a reference, receive a webhook when the subscriber approves.
   * Adjust the field names to the vendor's spec — nothing else changes.
   */
  async http({ msisdn, amountNgwee, bundleCode }) {
    if (!config.payments.apiUrl) return { ok: false, error: 'PSP_API_URL not set' };
    try {
      const res = await fetch(`${config.payments.apiUrl}/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.payments.apiKey}`,
          // Our own idempotency key, so a retry of this HTTP call does not
          // raise a second prompt on the subscriber's handset.
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          msisdn,
          amount: (amountNgwee / money.NGWEE_PER_KWACHA).toFixed(2),
          currency: 'ZMW',
          narration: `${config.serviceName} ${bundleCode}`
        })
      });
      if (!res.ok) return { ok: false, error: `PSP responded ${res.status}` };
      const body = await res.json().catch(() => ({}));
      return { ok: true, pspRef: body.reference || body.id, status: 'pending', amountNgwee };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
};

/**
 * Ask the PSP to prompt the subscriber to approve a bundle purchase.
 *
 * Returns synchronously with a pending `payments` row; the credit only lands
 * when the PSP's webhook confirms settlement.
 */
function requestCollection({ subscriberId, msisdn, bundleCode, amountNgwee }) {
  const provider = providers[config.payments.provider] || providers.mock;
  const pending = { subscriberId, msisdn, bundleCode, amountNgwee };

  // The mock provider is synchronous in practice; for the HTTP one we record
  // the intent first so a webhook that beats our own response still matches.
  const localRef = `intent-${crypto.randomUUID()}`;
  db.prepare(
    'INSERT INTO payments (subscriber_id, psp, psp_ref, bundle_code, amount_ngwee, status, raw) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(subscriberId, config.payments.provider, localRef, bundleCode, amountNgwee, 'pending', JSON.stringify(pending));

  Promise.resolve(provider(pending)).then(result => {
    if (result.ok && result.pspRef) {
      db.prepare('UPDATE payments SET psp_ref = ? WHERE psp_ref = ?').run(result.pspRef, localRef);
    } else if (!result.ok) {
      db.prepare("UPDATE payments SET status = 'failed' WHERE psp_ref = ?").run(localRef);
    }
  }).catch(err => {
    db.prepare("UPDATE payments SET status = 'failed' WHERE psp_ref = ?").run(localRef);
    console.error('[payments] collection request failed', err);
  });

  return { ok: true, ref: localRef, amountNgwee };
}

/**
 * Verify a PSP webhook signature (HMAC-SHA256 over the raw body).
 *
 * Compared in constant time. An unsigned webhook endpoint that credits a
 * wallet is a free-money endpoint, so this returns false when no secret is
 * configured rather than defaulting open.
 */
function verifySignature(rawBody, signature) {
  const secret = config.payments.webhookSecret;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = String(signature || '').replace(/^sha256=/, '');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Apply a settlement notification.
 *
 * Idempotent on `pspRef` twice over: the payments row is unique on it, and the
 * ledger entry uses `pay:<pspRef>` as its ref. A PSP that retries its webhook
 * five times credits the subscriber once.
 */
function settle({ pspRef, status, amountNgwee, msisdn, bundleCode, raw }) {
  if (!pspRef) throw new Error('Settlement without a PSP reference');

  let payment = db.prepare('SELECT * FROM payments WHERE psp_ref = ?').get(pspRef);

  // A webhook can arrive for a collection we have no intent row for (for
  // example a subscriber paying into the short code directly). Create it.
  if (!payment) {
    const sub = wallet.ensure(msisdn);
    db.prepare(
      'INSERT INTO payments (subscriber_id, psp, psp_ref, bundle_code, amount_ngwee, status, raw) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(sub.id, config.payments.provider, pspRef, bundleCode || null, amountNgwee, 'pending',
      raw ? JSON.stringify(raw) : null);
    payment = db.prepare('SELECT * FROM payments WHERE psp_ref = ?').get(pspRef);
  }

  if (payment.status === 'succeeded') {
    return { applied: false, reason: 'already_settled', subscriberId: payment.subscriber_id };
  }

  if (status !== 'succeeded') {
    db.prepare("UPDATE payments SET status = 'failed', settled_at = datetime('now') WHERE psp_ref = ?").run(pspRef);
    return { applied: false, reason: 'failed', subscriberId: payment.subscriber_id };
  }

  // Trust the PSP's amount, not the one we asked for: a subscriber may have
  // approved a different sum, and the ledger must match the money received.
  const credited = Number.isInteger(amountNgwee) ? amountNgwee : payment.amount_ngwee;

  const result = wallet.creditTopup(
    payment.subscriber_id, credited, pspRef,
    `Top-up ${payment.bundle_code || bundleCode || ''}`.trim()
  );
  db.prepare(
    "UPDATE payments SET status = 'succeeded', amount_ngwee = ?, settled_at = datetime('now') WHERE psp_ref = ?"
  ).run(credited, pspRef);
  db.audit(`psp:${config.payments.provider}`, 'payment.settled', `${pspRef} ${money.format(credited)}`);

  return {
    applied: result.applied,
    subscriberId: payment.subscriber_id,
    amountNgwee: credited,
    balanceNgwee: wallet.balance(payment.subscriber_id),
    daysAdded: Math.floor(credited / config.dailyPriceNgwee)
  };
}

module.exports = { requestCollection, verifySignature, settle, providers };
