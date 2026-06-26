'use strict';

/**
 * SMS / WhatsApp gateway abstraction.
 *
 * The rest of the system never talks to a telco directly — it calls send().
 * Today the "mock" provider just records the message in the outbox (so the
 * whole app is demonstrable with zero airtime cost). To go live for the
 * Government of Zambia, implement an adapter for the chosen aggregator
 * (Africa's Talking, Zamtel, MTN, Airtel, or the Smart Zambia bulk-SMS bus)
 * and set MESSAGING_PROVIDER — no other code changes.
 */
const db = require('./db');
const config = require('./config');

const providers = {
  /** Demo provider: persists to outbox, marks as "sent", no network call. */
  async mock(message) {
    return { ok: true, ref: `mock-${Date.now()}`, status: 'sent' };
  },

  /**
   * Generic JSON HTTP gateway. Wire to a Zamtel / MTN / Airtel bulk-SMS bus by
   * setting SMS_API_URL + SMS_API_KEY. Adjust the payload to the vendor's spec.
   */
  async http(message) {
    if (!config.messaging.apiUrl) {
      return { ok: false, ref: null, status: 'failed', error: 'SMS_API_URL not set' };
    }
    try {
      const res = await fetch(config.messaging.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.messaging.apiKey}`
        },
        body: JSON.stringify({
          from: config.messaging.senderId,
          to: message.recipient_phone,
          channel: message.channel,
          text: message.body
        })
      });
      const ok = res.ok;
      return { ok, ref: `http-${Date.now()}`, status: ok ? 'sent' : 'failed' };
    } catch (err) {
      return { ok: false, ref: null, status: 'failed', error: err.message };
    }
  },

  /**
   * Africa's Talking SMS adapter (a common aggregator with Zambian coverage).
   * Returns the provider message id as `ref` so delivery-report webhooks can
   * later reconcile the final status.
   * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
   */
  async africastalking(message) {
    const { atUsername, atApiKey, atApiUrl, senderId } = config.messaging;
    if (!atUsername || !atApiKey) {
      return { ok: false, ref: null, status: 'failed', error: 'AT_USERNAME / AT_API_KEY not set' };
    }
    try {
      const form = new URLSearchParams({
        username: atUsername,
        to: message.recipient_phone,
        message: message.body
      });
      if (senderId) form.set('from', senderId);
      const res = await fetch(atApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          apiKey: atApiKey
        },
        body: form.toString()
      });
      const data = await res.json().catch(() => ({}));
      const recipient = data?.SMSMessageData?.Recipients?.[0];
      // AT statusCode 100/101/102 = queued/sent successfully.
      const ok = res.ok && recipient && [100, 101, 102].includes(recipient.statusCode);
      return {
        ok,
        ref: recipient?.messageId || null,
        status: ok ? 'sent' : 'failed',
        error: ok ? undefined : (recipient?.status || `HTTP ${res.status}`)
      };
    } catch (err) {
      return { ok: false, ref: null, status: 'failed', error: err.message };
    }
  }
};

/**
 * Apply an inbound delivery report (from the aggregator's webhook) to the
 * outbox. Matches on the provider reference (message id). Africa's Talking
 * delivery statuses: Success, Sent, Submitted, Buffered, Rejected, Failed.
 * @returns {boolean} whether a matching message was updated.
 */
function applyDeliveryReport({ providerRef, status }) {
  if (!providerRef) return false;
  const map = {
    Success: 'delivered', Delivered: 'delivered',
    Sent: 'sent', Submitted: 'sent', Buffered: 'sent',
    Rejected: 'failed', Failed: 'failed'
  };
  const mapped = map[status] || null;
  if (!mapped) return false;
  const row = db.prepare('SELECT id FROM messages WHERE provider_ref = ?').get(providerRef);
  if (!row) return false;
  db.prepare('UPDATE messages SET delivery_status = ? WHERE id = ?').run(mapped, row.id);
  return true;
}

/**
 * Queue + dispatch a message. Always records to the outbox first (audit trail),
 * then attempts delivery and updates the status.
 *
 * @returns {object} the stored message row.
 */
async function send({ studentId = null, phone, channel = 'sms', category, body, language = 'en' }) {
  if (!phone) throw new Error('Recipient phone is required');

  // Guardian-consent gate (Data Protection Act): never transmit a message about
  // a learner whose guardian has not granted consent. The attempt is still
  // recorded as "blocked" for audit, but nothing leaves the system.
  let blocked = false;
  if (studentId) {
    const st = db.prepare('SELECT consent_status FROM students WHERE id = ?').get(studentId);
    if (st && st.consent_status !== 'granted') blocked = true;
  }

  const insert = db.prepare(`
    INSERT INTO messages (student_id, recipient_phone, channel, category, body, language, delivery_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(studentId, phone, channel, category, body, language, blocked ? 'blocked' : 'queued');

  const id = insert.lastInsertRowid;
  if (blocked) return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  const provider = providers[config.messaging.provider] || providers.mock;
  const result = await provider(message);

  db.prepare('UPDATE messages SET delivery_status = ?, provider_ref = ? WHERE id = ?')
    .run(result.status, result.ref, id);

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

module.exports = { send, applyDeliveryReport };
