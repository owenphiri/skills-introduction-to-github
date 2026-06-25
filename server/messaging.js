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
   * Skeleton HTTP provider. Wire this to the real endpoint + payload format of
   * your aggregator. Left intentionally generic.
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
  }
};

/**
 * Queue + dispatch a message. Always records to the outbox first (audit trail),
 * then attempts delivery and updates the status.
 *
 * @returns {object} the stored message row.
 */
async function send({ studentId = null, phone, channel = 'sms', category, body, language = 'en' }) {
  if (!phone) throw new Error('Recipient phone is required');

  const insert = db.prepare(`
    INSERT INTO messages (student_id, recipient_phone, channel, category, body, language, delivery_status)
    VALUES (?, ?, ?, ?, ?, ?, 'queued')
  `).run(studentId, phone, channel, category, body, language);

  const id = insert.lastInsertRowid;
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

  const provider = providers[config.messaging.provider] || providers.mock;
  const result = await provider(message);

  db.prepare('UPDATE messages SET delivery_status = ?, provider_ref = ? WHERE id = ?')
    .run(result.status, result.ref, id);

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

module.exports = { send };
