'use strict';

/**
 * USSD menu.
 *
 * Deliberately STATELESS. Gateways send the full accumulated input on every
 * step ("3*2*1"), so the menu is a pure function of that path. Nothing is read
 * back from a session store, which means a dropped gateway session, a failover
 * between our own instances, or a restart mid-menu all behave identically.
 * `ussd_sessions` rows are written for analytics only and nothing reads them.
 *
 * Wire format is the Africa's Talking convention — `CON` to keep the session
 * open, `END` to close it — which the common Zambian aggregators either speak
 * natively or adapt to with a thin shim. See parseRequest() for the shim
 * points.
 *
 * Every screen must fit 182 characters. respond() enforces that rather than
 * trusting the copy to stay short.
 */
const db = require('./db');
const config = require('./config');
const money = require('./money');
const wallet = require('./wallet');
const content = require('./content');
const verticals = require('./verticals');
const payments = require('./payments');

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'bem', name: 'Bemba' },
  { code: 'nya', name: 'Nyanja' },
  { code: 'toi', name: 'Tonga' },
  { code: 'loz', name: 'Lozi' }
];

function respond(keepOpen, body) {
  const limit = config.limits.ussdScreenChars;
  // USSD is GSM-7 as well: a stray em dash costs characters off a 182-char
  // screen for nothing.
  let text = content.toGsm7Safe(body).trim();
  if (text.length > limit) {
    // Never let a gateway truncate for us — it cuts mid-word and mid-option.
    text = content.clamp(text, limit);
  }
  return { keepOpen, text: `${keepOpen ? 'CON' : 'END'} ${text}` };
}

const CON = body => respond(true, body);
const END = body => respond(false, body);

/**
 * Normalise a gateway payload. Africa's Talking-style fields are the default;
 * the fallbacks cover the field names the other aggregators commonly use.
 */
function parseRequest(payload = {}) {
  const sessionId = payload.sessionId || payload.sessionID || payload.session_id || '';
  const msisdn = payload.phoneNumber || payload.msisdn || payload.MSISDN || payload.from || '';
  const raw = payload.text != null ? payload.text : (payload.input != null ? payload.input : '');
  const steps = String(raw).split('*').filter(s => s !== '');
  return { sessionId, msisdn, raw: String(raw), steps };
}

/* ----------------------------------------------------------- SCREENS -- */

function welcomeScreen() {
  return CON(
    `${config.serviceName} - K1/day\n` +
    'Farm, mining, road, health,\nmoney & daily encouragement.\n' +
    `First ${config.trialDays} days free.\n` +
    '1. Accept & start\n2. What it costs\n3. Exit'
  );
}

function mainMenu(sub) {
  const days = wallet.daysRemaining(sub.id);
  const status = wallet.inTrial(sub)
    ? `Free trial to ${sub.trial_ends_on}`
    : `Bal ${money.format(wallet.balance(sub.id))} (${days}d)`;
  return CON(
    `${config.serviceName}\n${status}\n` +
    "1. Today's bulletin\n2. My topics\n3. Top up\n4. My district\n5. Language\n6. Help / Stop"
  );
}

function topicsScreen(sub) {
  const mine = new Set(wallet.topics(sub.id));
  const lines = verticals.list().map((v, i) => `${i + 1}. ${mine.has(v.code) ? '[on] ' : ''}${v.shortName}`);
  return CON(`Topics - reply a number to\nturn on/off.\n${lines.join('\n')}\n0. Back`);
}

function topUpScreen(sub) {
  const lines = money.BUNDLES.map((b, i) => `${i + 1}. ${b.label} ${money.format(b.priceNgwee)}`);
  return CON(
    `Bal ${money.format(wallet.balance(sub.id))}\nBuy days (K1/day):\n${lines.join('\n')}\n0. Back`
  );
}

function languageScreen() {
  return CON(`Language:\n${LANGUAGES.map((l, i) => `${i + 1}. ${l.name}`).join('\n')}\n0. Back`);
}

function districtSearchScreen() {
  return CON('My district\nType the first letters of\nyour district name.\ne.g. CHIP for Chipata');
}

function districtMatches(query) {
  return db.prepare('SELECT id, name FROM districts WHERE name LIKE ? ORDER BY name LIMIT 8')
    .all(`${String(query).trim()}%`);
}

/* ------------------------------------------------------------ ROUTER -- */

/**
 * Resolve one USSD step.
 *
 * @param {object} payload raw gateway body
 * @returns {{keepOpen:boolean, text:string}}
 */
function handle(payload) {
  const { sessionId, msisdn, raw, steps } = parseRequest(payload);

  let sub;
  try {
    sub = wallet.ensure(msisdn);
  } catch (err) {
    return END('Sorry, we could not read your number. Please dial again.');
  }

  if (sessionId) {
    db.prepare('INSERT INTO ussd_sessions (session_id, msisdn, path) VALUES (?, ?, ?)')
      .run(sessionId, sub.msisdn, raw);
  }

  // Un-consented callers see the opt-in screen and nothing else. Consent is
  // the gate on the whole service, not a checkbox further down the funnel.
  if (!sub.consent_at) {
    if (steps.length === 0) return welcomeScreen();
    if (steps[0] === '1') {
      wallet.recordConsent(sub.id, 'ussd');
      return END(
        `Welcome to ${config.serviceName}.\n` +
        `Your first ${config.trialDays} days are free, then K1/day from your\n` +
        `credit. Dial ${config.shortCode} any time.\nSend STOP to cancel.`
      );
    }
    if (steps[0] === '2') {
      return CON(
        'K1 per day, taken from\ncredit you buy in advance\n(3 days K3, week K7,\nmonth K30). No credit =\nno charge. Stop any time.\n1. Accept & start\n3. Exit'
      );
    }
    return END('No problem. Dial again any time.');
  }

  if (steps.length === 0) return mainMenu(sub);

  const [first, ...rest] = steps;

  switch (first) {
    /* ---- 1. Today's bulletin -------------------------------------- */
    case '1': {
      const charge = wallet.chargeDay(sub.id);
      if (!charge.ok && charge.reason === 'no_credit') {
        return CON(
          `Your credit is finished.\nBuy days to continue:\n` +
          money.BUNDLES.slice(0, 3).map((b, i) => `${i + 1}. ${b.label} ${money.format(b.priceNgwee)}`).join('\n')
        );
      }
      if (!charge.ok) return END('Your subscription is stopped. Dial again and choose Accept to restart.');
      return END(content.buildUssdDigest(sub));
    }

    /* ---- 2. My topics --------------------------------------------- */
    case '2': {
      if (rest.length === 0) return topicsScreen(sub);
      if (rest[0] === '0') return mainMenu(sub);
      const idx = Number(rest[rest.length - 1]) - 1;
      const all = verticals.list();
      if (!Number.isInteger(idx) || idx < 0 || idx >= all.length) return topicsScreen(sub);
      wallet.toggleTopic(sub.id, all[idx].code);
      return topicsScreen(sub);
    }

    /* ---- 3. Top up ------------------------------------------------- */
    case '3': {
      if (rest.length === 0) return topUpScreen(sub);
      if (rest[0] === '0') return mainMenu(sub);
      const b = money.BUNDLES[Number(rest[0]) - 1];
      if (!b) return topUpScreen(sub);
      const req = payments.requestCollection({
        subscriberId: sub.id, msisdn: sub.msisdn, bundleCode: b.code, amountNgwee: b.priceNgwee
      });
      if (!req.ok) return END('Top-up is unavailable right now. Please try again shortly.');
      return END(
        `Approve ${money.format(b.priceNgwee)} on your phone to\nadd ${b.days} days.\n` +
        'A payment prompt is on its\nway. Enter your mobile\nmoney PIN to confirm.'
      );
    }

    /* ---- 4. My district -------------------------------------------- */
    case '4': {
      if (rest.length === 0) return districtSearchScreen();
      const matches = districtMatches(rest[0]);
      if (!matches.length) return END(`No district starts with "${rest[0]}". Dial again to retry.`);
      if (rest.length === 1) {
        if (matches.length === 1) {
          db.prepare('UPDATE subscribers SET district_id = ? WHERE id = ?').run(matches[0].id, sub.id);
          return END(`District set to ${matches[0].name}. Your weather and prices are now local.`);
        }
        return CON(`Choose your district:\n${matches.map((m, i) => `${i + 1}. ${m.name}`).join('\n')}`);
      }
      const chosen = matches[Number(rest[1]) - 1];
      if (!chosen) return END('That was not one of the options. Dial again to retry.');
      db.prepare('UPDATE subscribers SET district_id = ? WHERE id = ?').run(chosen.id, sub.id);
      return END(`District set to ${chosen.name}. Your weather and prices are now local.`);
    }

    /* ---- 5. Language ------------------------------------------------ */
    case '5': {
      if (rest.length === 0) return languageScreen();
      if (rest[0] === '0') return mainMenu(sub);
      const lang = LANGUAGES[Number(rest[0]) - 1];
      if (!lang) return languageScreen();
      db.prepare('UPDATE subscribers SET language = ? WHERE id = ?').run(lang.code, sub.id);
      return END(`Language set to ${lang.name}.`);
    }

    /* ---- 6. Help / Stop ---------------------------------------------- */
    case '6': {
      if (rest.length === 0) {
        return CON(
          `${config.serviceName} K1/day.\nHelp: ${config.supportPhone}\n1. Stop my subscription\n0. Back`
        );
      }
      if (rest[0] === '1') {
        wallet.stop(sub.id, 'ussd');
        return END('Stopped. You will receive no further messages and no further charges. Dial again to restart.');
      }
      return mainMenu(sub);
    }

    default:
      return mainMenu(sub);
  }
}

module.exports = { handle, parseRequest, respond, LANGUAGES };
