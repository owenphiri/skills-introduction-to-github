'use strict';

/**
 * Outbound delivery.
 *
 * Nothing in this service calls a telco or Meta directly — it calls send(),
 * which enforces the two rules that keep us lawful and cheap:
 *
 *   1. No consent, no message. A subscriber with consent_at NULL or status
 *      'stopped' is never sent to, whatever the caller asked for.
 *   2. One digest per subscriber per day per channel. A retried cron cannot
 *      double-send, which matters because every duplicate is both a cost and
 *      a complaint.
 */
const db = require('./db');
const config = require('./config');
const content = require('./content');

const providers = {
  /** Demo provider: records the delivery, sends nothing, costs nothing. */
  async mock(message) {
    return { ok: true, ref: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  },

  /** Generic bulk-SMS gateway — set SMS_API_URL and SMS_API_KEY. */
  async http(message) {
    if (!config.messaging.apiUrl) return { ok: false, error: 'SMS_API_URL not set' };
    try {
      const res = await fetch(config.messaging.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.messaging.apiKey}` },
        body: JSON.stringify({ from: config.messaging.senderId, to: message.to, text: message.body })
      });
      return res.ok ? { ok: true, ref: `http-${Date.now()}` } : { ok: false, error: `Gateway ${res.status}` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  /**
   * WhatsApp Business Platform (Cloud API).
   *
   * Outside the 24-hour customer-service window Meta only delivers approved
   * template messages, so `message.template` must be set for a proactive
   * digest. Sending free-form text to a cold contact silently fails and
   * counts against quality rating — see docs/COMPLIANCE.md.
   */
  async whatsapp(message) {
    const { phoneNumberId, accessToken, graphUrl } = config.whatsapp;
    if (!phoneNumberId || !accessToken) return { ok: false, error: 'WhatsApp credentials not set' };

    const payload = message.template
      ? {
          messaging_product: 'whatsapp',
          to: message.to.replace('+', ''),
          type: 'template',
          template: {
            name: message.template.name,
            language: { code: message.template.language || 'en' },
            components: message.template.components || []
          }
        }
      : {
          messaging_product: 'whatsapp',
          to: message.to.replace('+', ''),
          type: 'text',
          text: { body: message.body }
        };

    try {
      const res = await fetch(`${graphUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body?.error?.message || `Graph ${res.status}` };
      return { ok: true, ref: body?.messages?.[0]?.id || `wa-${Date.now()}` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
};

function providerFor(channel) {
  if (channel === 'whatsapp') return providers.whatsapp;
  return providers[config.messaging.provider] || providers.mock;
}

/** Has this subscriber already had a digest on this channel today? */
function alreadySentToday(subscriberId, channel, date) {
  return Boolean(db.prepare(
    "SELECT 1 AS x FROM deliveries WHERE subscriber_id = ? AND channel = ? AND sent_on = ? AND status != 'failed'"
  ).get(subscriberId, channel, date));
}

/**
 * Send one message.
 *
 * @returns {{sent:boolean, reason?:string, deliveryId?:number, segments?:number}}
 */
async function send({ subscriber, channel, body, template = null, date = db.today(), allowDuplicate = false }) {
  if (!subscriber) return { sent: false, reason: 'unknown_subscriber' };
  if (!subscriber.consent_at || subscriber.status === 'stopped') {
    return { sent: false, reason: 'no_consent' };
  }
  if (channel === 'whatsapp' && !subscriber.whatsapp_opt_in_at) {
    return { sent: false, reason: 'no_whatsapp_opt_in' };
  }
  if (!allowDuplicate && alreadySentToday(subscriber.id, channel, date)) {
    return { sent: false, reason: 'already_sent' };
  }

  const segments = channel === 'sms' ? content.segments(body) : 1;
  db.prepare(
    'INSERT INTO deliveries (subscriber_id, channel, body, segments, status, sent_on) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(subscriber.id, channel, body, segments, 'queued', date);
  const deliveryId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const result = await providerFor(channel)({ to: subscriber.msisdn, body, template });

  db.prepare('UPDATE deliveries SET status = ?, provider_ref = ? WHERE id = ?')
    .run(result.ok ? 'sent' : 'failed', result.ref || null, deliveryId);

  return result.ok
    ? { sent: true, deliveryId, segments }
    : { sent: false, reason: result.error || 'provider_error', deliveryId, segments };
}

/** Delivery-report webhook from an SMS gateway. */
function recordDeliveryReport(providerRef, status) {
  const allowed = new Set(['sent', 'delivered', 'failed']);
  if (!allowed.has(status)) return false;
  const res = db.prepare('UPDATE deliveries SET status = ? WHERE provider_ref = ?').run(status, providerRef);
  return res.changes > 0;
}

module.exports = { send, providers, alreadySentToday, recordDeliveryReport };
