'use strict';

/**
 * WhatsApp Business Platform webhook.
 *
 * Handles the two things Meta sends us: the one-off verification handshake,
 * and inbound messages. Inbound is what creates the opt-in — a person who
 * messages us first opens a 24-hour service window in which we may reply
 * freely. Proactive digests outside that window need an approved template.
 *
 * The keyword set is the same one the SMS short code answers, because a
 * subscriber should not have to remember which channel they are on.
 */
const crypto = require('node:crypto');
const db = require('./db');
const config = require('./config');
const money = require('./money');
const wallet = require('./wallet');
const content = require('./content');
const verticals = require('./verticals');

/** Meta's GET handshake. Returns the challenge string, or null to 403. */
function verifyHandshake(query = {}) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token && token === config.whatsapp.verifyToken) return String(challenge);
  return null;
}

/**
 * Validate X-Hub-Signature-256 over the raw request body.
 *
 * Returns false when no app secret is configured. An unauthenticated webhook
 * that can flip subscription state is an abuse endpoint, so this fails closed.
 */
function verifySignature(rawBody, signature) {
  const secret = config.whatsapp.appSecret;
  if (!secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Pull the inbound text messages out of Meta's nested webhook envelope. */
function extractMessages(payload = {}) {
  const out = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const msg of value.messages || []) {
        const text = msg.type === 'text'
          ? msg.text?.body
          : msg.type === 'interactive'
            ? (msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title)
            : null;
        if (text) out.push({ from: msg.from, text: String(text), messageId: msg.id });
      }
      for (const st of value.statuses || []) {
        out.push({ status: st.status, messageId: st.id, from: st.recipient_id });
      }
    }
  }
  return out;
}

const HELP_TEXT =
  `${config.serviceName} — K1 a day.\n` +
  'Reply:\n' +
  'TODAY — today\'s bulletin\n' +
  'BAL — your balance\n' +
  'TOPICS — what you receive\n' +
  'ON <topic> / OFF <topic>\n' +
  'BUY WEEK — add 7 days\n' +
  'STOP — cancel everything';

/**
 * Turn one inbound message into a reply.
 *
 * Pure enough to test directly: it reads and writes the database but performs
 * no network I/O. The caller sends whatever string comes back.
 */
function handleInbound({ from, text }) {
  let sub;
  try {
    sub = wallet.ensure(from);
  } catch {
    return { reply: 'Sorry, we could not read your number.' };
  }

  // Messaging us is the opt-in. Record it once, on the channel it happened.
  if (!sub.consent_at) {
    wallet.recordConsent(sub.id, 'whatsapp');
    sub = wallet.byId(sub.id);
  }
  if (!sub.whatsapp_opt_in_at) {
    db.prepare("UPDATE subscribers SET whatsapp_opt_in_at = datetime('now') WHERE id = ?").run(sub.id);
    sub = wallet.byId(sub.id);
  }

  const raw = text.trim();
  const upper = raw.toUpperCase();
  const [command, ...args] = upper.split(/\s+/);

  switch (command) {
    case 'STOP':
    case 'CANCEL':
    case 'UNSUBSCRIBE':
      wallet.stop(sub.id, 'whatsapp');
      return { reply: 'Stopped. No further messages and no further charges. Send START to come back.' };

    case 'START':
    case 'HI':
    case 'HELLO':
      return {
        reply: `Welcome to ${config.serviceName}.\n` +
          `${config.trialDays} days free, then K1/day from credit you buy.\n\n${HELP_TEXT}`
      };

    case 'HELP':
    case 'MENU':
      return { reply: HELP_TEXT };

    case 'TODAY':
    case 'NEWS': {
      const charge = wallet.chargeDay(sub.id);
      if (!charge.ok && charge.reason === 'no_credit') {
        return {
          reply: 'Your credit is finished. Reply BUY WEEK (K7) or BUY MONTH (K30) to continue. ' +
            'You are not charged while you have no credit.'
        };
      }
      if (!charge.ok) return { reply: 'Your subscription is stopped. Send START to restart.' };
      return { reply: content.buildUssdDigest(sub) };
    }

    case 'BAL':
    case 'BALANCE': {
      const days = wallet.daysRemaining(sub.id);
      const trial = wallet.inTrial(sub) ? ` Free trial runs to ${sub.trial_ends_on}.` : '';
      return { reply: `Balance ${money.format(wallet.balance(sub.id))} — ${days} day(s) of service.${trial}` };
    }

    case 'TOPICS': {
      const mine = new Set(wallet.topics(sub.id));
      const lines = verticals.list().map(v => `${mine.has(v.code) ? '[on] ' : '[  ] '}${v.code} — ${v.name}`);
      return { reply: `Your topics:\n${lines.join('\n')}\n\nReply ON <code> or OFF <code>.` };
    }

    case 'ON':
    case 'OFF': {
      const code = (args[0] || '').toLowerCase();
      if (!verticals.exists(code)) {
        return { reply: `Unknown topic "${args[0] || ''}". Reply TOPICS to see the list.` };
      }
      const has = wallet.topics(sub.id).includes(code);
      if ((command === 'ON') !== has) wallet.toggleTopic(sub.id, code);
      return { reply: `${verticals.get(code).name} is now ${command === 'ON' ? 'on' : 'off'}.` };
    }

    case 'BUY': {
      const map = { DAYS: 'D3', D3: 'D3', WEEK: 'W1', W1: 'W1', MONTH: 'M1', M1: 'M1', M3: 'M3' };
      const b = money.bundle(map[args[0]] || args[0]);
      if (!b) {
        return {
          reply: 'Reply BUY WEEK (K7), BUY MONTH (K30) or BUY M3 (K85). ' +
            'You will get a prompt on your phone to approve with your PIN.'
        };
      }
      // Required lazily: payments pulls in wallet, and wallet is already here.
      const payments = require('./payments');
      payments.requestCollection({
        subscriberId: sub.id, msisdn: sub.msisdn, bundleCode: b.code, amountNgwee: b.priceNgwee
      });
      return {
        reply: `Approve ${money.format(b.priceNgwee)} on your phone to add ${b.days} days. ` +
          'Enter your mobile money PIN when the prompt appears.'
      };
    }

    case 'DISTRICT': {
      const q = args.join(' ');
      if (!q) return { reply: 'Reply DISTRICT <name>, for example DISTRICT Chipata.' };
      const match = db.prepare('SELECT id, name FROM districts WHERE name LIKE ? ORDER BY name LIMIT 1')
        .get(`${q}%`);
      if (!match) return { reply: `No district starting with "${q}". Check the spelling and try again.` };
      db.prepare('UPDATE subscribers SET district_id = ? WHERE id = ?').run(match.id, sub.id);
      return { reply: `District set to ${match.name}. Your weather and prices are now local.` };
    }

    default:
      return { reply: `I did not understand that.\n\n${HELP_TEXT}` };
  }
}

module.exports = { verifyHandshake, verifySignature, extractMessages, handleInbound, HELP_TEXT };
