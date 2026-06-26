'use strict';

/**
 * Database layer for the PrimeAxis Smart Poultry Management System.
 * Uses Node's built-in node:sqlite — no native build, runs anywhere Node 22.5+
 * is available (a farm office laptop or a cloud server, same code).
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
  CREATE TABLE IF NOT EXISTS farms (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    location  TEXT,
    owner_name TEXT,
    package   TEXT NOT NULL DEFAULT 'bronze'
                CHECK (package IN ('bronze','silver','gold','platinum')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner','manager','worker','accountant','viewer')),
    farm_id       INTEGER REFERENCES farms(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A flock/batch of birds (broiler batch or layer flock).
  CREATE TABLE IF NOT EXISTS flocks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id       INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('broiler','layer')),
    breed         TEXT,
    house         TEXT,
    start_date    TEXT NOT NULL,
    initial_count INTEGER NOT NULL,
    current_count INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One daily record per flock: mortality, feed, and either weight (broiler) or
  -- egg metrics (layer).
  CREATE TABLE IF NOT EXISTS daily_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    flock_id     INTEGER NOT NULL REFERENCES flocks(id) ON DELETE CASCADE,
    date         TEXT NOT NULL,
    mortality    INTEGER NOT NULL DEFAULT 0,
    culls        INTEGER NOT NULL DEFAULT 0,
    feed_kg      REAL NOT NULL DEFAULT 0,
    avg_weight_g REAL,              -- broilers: average live weight (grams)
    eggs_collected INTEGER,         -- layers: eggs collected
    eggs_broken  INTEGER,           -- layers: broken/cracked eggs
    water_l      REAL,
    notes        TEXT,
    recorded_by  INTEGER REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (flock_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_logs_flock_date ON daily_logs(flock_id, date);

  -- Feed stock purchases (consumption is recorded in daily_logs.feed_kg).
  CREATE TABLE IF NOT EXISTS feed_inventory (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id     INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    feed_type   TEXT NOT NULL,      -- e.g. Starter, Grower, Finisher, Layer Mash
    quantity_kg REAL NOT NULL,
    unit_cost   REAL NOT NULL DEFAULT 0,
    purchased_at TEXT NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS vaccinations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    flock_id        INTEGER NOT NULL REFERENCES flocks(id) ON DELETE CASCADE,
    vaccine         TEXT NOT NULL,
    scheduled_date  TEXT NOT NULL,
    administered_date TEXT,
    status          TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','done','missed')),
    notes           TEXT
  );

  CREATE TABLE IF NOT EXISTS sales (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id   INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    flock_id  INTEGER REFERENCES flocks(id) ON DELETE SET NULL,
    category  TEXT NOT NULL CHECK (category IN ('birds','eggs','manure','other')),
    quantity  REAL NOT NULL,
    unit      TEXT,                 -- birds | trays | kg
    unit_price REAL NOT NULL DEFAULT 0,
    amount    REAL NOT NULL DEFAULT 0,
    customer  TEXT,
    date      TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id   INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category  TEXT NOT NULL CHECK (category IN ('feed','medication','labour','utilities','equipment','transport','other')),
    amount    REAL NOT NULL,
    note      TEXT,
    date      TEXT NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id   INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role      TEXT,
    phone     TEXT,
    salary    REAL DEFAULT 0,
    active    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);

module.exports = db;
