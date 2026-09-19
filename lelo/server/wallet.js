'use strict';

/**
 * Subscriber lifecycle and the prepaid credit ledger.
 *
 * Two invariants hold everywhere in this file:
 *
 *  1. Every balance movement writes a ledger row carrying a unique `ref`.
 *     The ref is the idempotency key, so a retried webhook or a cron that
 *     fires twice cannot move money twice.
 *  2. The ledger row and the cached balance are written in one transaction.
 *     If they ever disagree, the ledger is right.
 */
const db = require('./db');
const config = require('./config');
const verticals = require('./verticals');

const UNIQUE_VIOLATION = /UNIQUE constraint failed/i;

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function findByMsisdn(msisdn) {
  return db.prepare('SELECT * FROM subscribers WHERE msisdn = ?').get(db.normaliseMsisdn(msisdn));
}

function byId(id) {
  return db.prepare('SELECT * FROM subscribers WHERE id = ?').get(id);
}

/**
 * Fetch the subscriber for a number, creating them on first contact.
 *
 * A first-contact row is created in 'trial' status but WITHOUT consent: it
 * exists so the USSD session has something to hang on to. Nothing is ever
 * pushed to it until recordConsent() runs.
 */
function ensure(msisdn, { districtId = null, language = 'en' } = {}) {
  const normalised = db.normaliseMsisdn(msisdn);
  const existing = db.prepare('SELECT * FROM subscribers WHERE msisdn = ?').get(normalised);
  if (existing) return existing;

  return tx(() => {
    db.prepare(
      'INSERT INTO subscribers (msisdn, language, district_id, status, trial_ends_on) VALUES (?, ?, ?, ?, ?)'
    ).run(normalised, language, districtId, 'trial', db.addDays(db.today(), config.trialDays));
    const row = db.prepare('SELECT * FROM subscribers WHERE msisdn = ?').get(normalised);
    db.prepare('INSERT INTO wallet_accounts (subscriber_id, balance_ngwee) VALUES (?, 0)').run(row.id);
    for (const code of verticals.DEFAULT_CODES) {
      db.prepare('INSERT INTO subscriptions (subscriber_id, vertical_code) VALUES (?, ?)').run(row.id, code);
    }
    return row;
  });
}

/**
 * Record explicit opt-in. This is the gate on every outbound message, so it
 * stores when and through which channel the subscriber agreed.
 */
function recordConsent(subscriberId, channel) {
  db.prepare(
    "UPDATE subscribers SET consent_at = datetime('now'), consent_channel = ?, status = CASE WHEN status = 'stopped' THEN 'trial' ELSE status END WHERE id = ?"
  ).run(channel, subscriberId);
  db.audit(`subscriber:${subscriberId}`, 'consent.granted', channel);
  return byId(subscriberId);
}

/** Honour STOP. Keeps the row (for billing history) but silences it. */
function stop(subscriberId, channel) {
  db.prepare(
    "UPDATE subscribers SET status = 'stopped', stopped_at = datetime('now'), consent_at = NULL WHERE id = ?"
  ).run(subscriberId);
  db.audit(`subscriber:${subscriberId}`, 'consent.withdrawn', channel);
  return byId(subscriberId);
}

function balance(subscriberId) {
  const row = db.prepare('SELECT balance_ngwee FROM wallet_accounts WHERE subscriber_id = ?').get(subscriberId);
  return row ? row.balance_ngwee : 0;
}

function ledger(subscriberId, limit = 20) {
  return db.prepare(
    'SELECT kind, amount_ngwee, balance_after_ngwee, note, created_at FROM ledger_entries WHERE subscriber_id = ? ORDER BY id DESC LIMIT ?'
  ).all(subscriberId, limit);
}

/**
 * Move `amountNgwee` (signed) against a subscriber's credit.
 *
 * Returns { applied, entry }. `applied` is false when `ref` has been seen
 * before — the caller is retrying, and the original entry is returned
 * unchanged rather than duplicated.
 */
function post(subscriberId, kind, amountNgwee, ref, note = null) {
  if (!Number.isInteger(amountNgwee)) throw new Error('amount must be integer ngwee');

  const prior = db.prepare('SELECT * FROM ledger_entries WHERE ref = ?').get(ref);
  if (prior) return { applied: false, entry: prior };

  try {
    return tx(() => {
      const current = db.prepare(
        'SELECT balance_ngwee FROM wallet_accounts WHERE subscriber_id = ?'
      ).get(subscriberId);
      if (!current) throw new Error(`No wallet for subscriber ${subscriberId}`);

      const after = current.balance_ngwee + amountNgwee;
      if (after < 0) throw new Error('Insufficient credit');

      db.prepare(
        'INSERT INTO ledger_entries (subscriber_id, kind, amount_ngwee, balance_after_ngwee, ref, note) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(subscriberId, kind, amountNgwee, after, ref, note);
      db.prepare(
        "UPDATE wallet_accounts SET balance_ngwee = ?, updated_at = datetime('now') WHERE subscriber_id = ?"
      ).run(after, subscriberId);

      return { applied: true, entry: db.prepare('SELECT * FROM ledger_entries WHERE ref = ?').get(ref) };
    });
  } catch (err) {
    // Lost a race against a concurrent retry of the same ref — that is the
    // idempotent outcome, not an error.
    if (UNIQUE_VIOLATION.test(err.message)) {
      return { applied: false, entry: db.prepare('SELECT * FROM ledger_entries WHERE ref = ?').get(ref) };
    }
    throw err;
  }
}

/** Credit a settled payment and move the subscriber out of trial. */
function creditTopup(subscriberId, amountNgwee, pspRef, note) {
  const result = post(subscriberId, 'topup', amountNgwee, `pay:${pspRef}`, note);
  if (result.applied) {
    db.prepare("UPDATE subscribers SET status = 'active' WHERE id = ? AND status IN ('trial','suspended')")
      .run(subscriberId);
  }
  return result;
}

/** True while the free trial window is still open. */
function inTrial(subscriber, date = db.today()) {
  return Boolean(subscriber.trial_ends_on) && date <= subscriber.trial_ends_on;
}

/**
 * Decide and take today's K1.
 *
 * Returns one of:
 *   { ok: true,  reason: 'trial' }      — free trial day, nothing charged
 *   { ok: true,  reason: 'charged' }    — K1 drawn from credit
 *   { ok: true,  reason: 'already' }    — this day was already billed
 *   { ok: false, reason: 'no_credit' }  — balance too low; caller should not deliver
 *   { ok: false, reason: 'stopped' }    — opted out
 */
function chargeDay(subscriberId, date = db.today()) {
  const sub = byId(subscriberId);
  if (!sub) return { ok: false, reason: 'unknown' };
  if (sub.status === 'stopped' || !sub.consent_at) return { ok: false, reason: 'stopped' };

  if (inTrial(sub, date)) return { ok: true, reason: 'trial', balance: balance(subscriberId) };

  const ref = `day:${subscriberId}:${date}`;
  const seen = db.prepare('SELECT * FROM ledger_entries WHERE ref = ?').get(ref);
  if (seen) return { ok: true, reason: 'already', balance: balance(subscriberId) };

  if (balance(subscriberId) < config.dailyPriceNgwee) {
    db.prepare("UPDATE subscribers SET status = 'suspended' WHERE id = ? AND status = 'active'").run(subscriberId);
    return { ok: false, reason: 'no_credit', balance: balance(subscriberId) };
  }

  post(subscriberId, 'daily_charge', -config.dailyPriceNgwee, ref, `Daily service ${date}`);
  return { ok: true, reason: 'charged', balance: balance(subscriberId) };
}

/** Topics a subscriber currently receives. */
function topics(subscriberId) {
  return db.prepare('SELECT vertical_code FROM subscriptions WHERE subscriber_id = ? ORDER BY vertical_code')
    .all(subscriberId).map(r => r.vertical_code);
}

/** Flip one topic on or off; returns the resulting list. */
function toggleTopic(subscriberId, code) {
  if (!verticals.exists(code)) throw new Error(`Unknown vertical: ${code}`);
  const has = db.prepare('SELECT 1 AS x FROM subscriptions WHERE subscriber_id = ? AND vertical_code = ?')
    .get(subscriberId, code);
  if (has) {
    db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? AND vertical_code = ?').run(subscriberId, code);
  } else {
    db.prepare('INSERT INTO subscriptions (subscriber_id, vertical_code) VALUES (?, ?)').run(subscriberId, code);
  }
  return topics(subscriberId);
}

/** Days of service the current balance still buys. */
function daysRemaining(subscriberId) {
  return Math.floor(balance(subscriberId) / config.dailyPriceNgwee);
}

module.exports = {
  tx, ensure, findByMsisdn, byId, recordConsent, stop,
  balance, ledger, post, creditTopup, chargeDay, inTrial,
  topics, toggleTopic, daysRemaining
};
