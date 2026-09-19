'use strict';

/**
 * Local data layer, built on Node's built-in node:sqlite so the whole service
 * runs on a laptop with no native build and no cloud account.
 *
 * Production runs the same schema on Supabase Postgres —
 * supabase/migrations/0001_init.sql is the authoritative version and must be
 * kept in step with this file. Table and column names are deliberately
 * identical so queries port across with only dialect changes.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS districts (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    province TEXT NOT NULL
  );

  -- One row per phone number. The MSISDN is the identity: there are no
  -- passwords, because the audience includes phones that cannot hold one.
  CREATE TABLE IF NOT EXISTS subscribers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    msisdn         TEXT NOT NULL UNIQUE,
    language       TEXT NOT NULL DEFAULT 'en'
                     CHECK (language IN ('en','bem','nya','toi','loz')),
    district_id    INTEGER REFERENCES districts(id),
    status         TEXT NOT NULL DEFAULT 'trial'
                     CHECK (status IN ('trial','active','suspended','stopped')),
    trial_ends_on  TEXT,
    -- Consent is recorded, not assumed. No digest is ever sent to a row
    -- where consent_at IS NULL (Data Protection Act No. 3 of 2021).
    consent_at     TEXT,
    consent_channel TEXT,
    whatsapp_opt_in_at TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    stopped_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    vertical_code TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (subscriber_id, vertical_code)
  );

  -- Prepaid service credit. NOT a general-purpose wallet: this balance buys
  -- Daily Essential content and nothing else, and cannot be sent to another
  -- person. That distinction is what keeps us out of e-money licensing.
  CREATE TABLE IF NOT EXISTS wallet_accounts (
    subscriber_id  INTEGER PRIMARY KEY REFERENCES subscribers(id) ON DELETE CASCADE,
    balance_ngwee  INTEGER NOT NULL DEFAULT 0,
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Append-only. Balance is derivable from this table; wallet_accounts is a
  -- cache that every write keeps in step inside one transaction.
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id      INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    kind               TEXT NOT NULL
                         CHECK (kind IN ('topup','daily_charge','bonus','refund','reversal')),
    amount_ngwee       INTEGER NOT NULL,   -- signed: credits +, charges -
    balance_after_ngwee INTEGER NOT NULL,
    -- Idempotency key. For a daily charge this is 'day:<subscriber>:<date>',
    -- so a cron that runs twice cannot bill twice.
    ref                TEXT NOT NULL UNIQUE,
    note               TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id  INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    psp            TEXT NOT NULL,
    psp_ref        TEXT NOT NULL UNIQUE,   -- the PSP's own id; our replay guard
    bundle_code    TEXT,
    amount_ngwee   INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','succeeded','failed')),
    raw            TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    settled_at     TEXT
  );

  -- Editorial content. Nothing reaches a subscriber unless approved_at is set.
  CREATE TABLE IF NOT EXISTS content_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    vertical_code TEXT NOT NULL,
    district_id   INTEGER REFERENCES districts(id),  -- NULL = nationwide
    language      TEXT NOT NULL DEFAULT 'en',
    body          TEXT NOT NULL,
    valid_on      TEXT NOT NULL,                     -- YYYY-MM-DD
    source        TEXT,
    priority      INTEGER NOT NULL DEFAULT 0,        -- higher wins the slot
    approved_by   TEXT,
    approved_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    channel       TEXT NOT NULL CHECK (channel IN ('sms','whatsapp','ussd')),
    body          TEXT NOT NULL,
    segments      INTEGER NOT NULL DEFAULT 1,
    status        TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','sent','delivered','failed')),
    provider_ref  TEXT,
    sent_on       TEXT NOT NULL,                     -- YYYY-MM-DD
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Analytics only: the USSD menu itself is stateless (see ussd.js).
  CREATE TABLE IF NOT EXISTS ussd_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    msisdn      TEXT NOT NULL,
    path        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_subs_subscriber ON subscriptions(subscriber_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_subscriber ON ledger_entries(subscriber_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_content_lookup ON content_items(vertical_code, valid_on, language);
  CREATE INDEX IF NOT EXISTS idx_deliveries_day ON deliveries(subscriber_id, sent_on);
`);

/** Normalise any locally-written number to +260XXXXXXXXX. */
function normaliseMsisdn(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) throw new Error('Empty phone number');
  let national;
  if (digits.startsWith('260')) national = digits.slice(3);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;
  if (!/^\d{9}$/.test(national)) throw new Error(`Not a Zambian mobile number: ${raw}`);
  return `+260${national}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function audit(actor, action, detail) {
  db.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?, ?, ?)')
    .run(actor, action, detail == null ? null : String(detail));
}

module.exports = {
  db,
  prepare: sql => db.prepare(sql),
  exec: sql => db.exec(sql),
  normaliseMsisdn,
  today,
  addDays,
  audit
};
