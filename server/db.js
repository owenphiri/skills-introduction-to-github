'use strict';

/**
 * Database layer for SafeGirl EduTrack.
 *
 * Uses Node's built-in `node:sqlite` (no native build step, no external DB
 * server) so the system runs anywhere Node 22.5+ is available — from a rural
 * school laptop in offline mode to a national data centre. The schema is the
 * same; only the deployment target changes.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

// Ensure the data directory exists.
fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Schema. Designed around the SEWSMS modules:
 * users, students, attendance, performance, counseling, messages (outbox),
 * awareness content, and audit sessions.
 */
function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name     TEXT NOT NULL,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN
                      ('admin','teacher','counselor','parent','district','community','reviewer')),
      phone         TEXT,
      school_id     INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schools (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      district  TEXT NOT NULL,
      province  TEXT,
      package   TEXT NOT NULL DEFAULT 'bronze'
                  CHECK (package IN ('bronze','silver','gold','platinum'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name           TEXT NOT NULL,
      nrc                 TEXT,                 -- NRC / Birth Certificate No.
      grade               TEXT NOT NULL,
      gender              TEXT NOT NULL CHECK (gender IN ('F','M')),
      date_of_birth       TEXT,
      parent_name         TEXT,
      parent_phone        TEXT,
      village             TEXT,
      gps_lat             REAL,
      gps_lng             REAL,
      vulnerability_status TEXT DEFAULT 'none'  -- none | orphan | low_income | disability | other
                  ,
      health_info         TEXT,
      emergency_contact   TEXT,
      school_id           INTEGER REFERENCES schools(id),
      active              INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      date        TEXT NOT NULL,               -- YYYY-MM-DD
      status      TEXT NOT NULL CHECK (status IN ('present','absent','late')),
      marked_by   INTEGER REFERENCES users(id),
      note        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date
      ON attendance(student_id, date);

    CREATE TABLE IF NOT EXISTS performance (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      term        TEXT NOT NULL,               -- e.g. "2026-T1" or "2026-06"
      subject     TEXT NOT NULL,
      score       REAL NOT NULL CHECK (score >= 0 AND score <= 100),
      recorded_by INTEGER REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_performance_student
      ON performance(student_id);

    CREATE TABLE IF NOT EXISTS counseling (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      type          TEXT NOT NULL CHECK (type IN
                      ('session','home_visit','parent_meeting','welfare_case','referral')),
      notes         TEXT,
      counselor_id  INTEGER REFERENCES users(id),
      scheduled_date TEXT,
      status        TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','in_progress','resolved','escalated')),
      follow_up_date TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_counseling_student
      ON counseling(student_id);

    -- Messaging outbox. Every SMS / WhatsApp is recorded for audit and for the
    -- analytics "community engagement" metrics. delivery_status is updated by
    -- the gateway adapter.
    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id      INTEGER REFERENCES students(id) ON DELETE SET NULL,
      recipient_phone TEXT NOT NULL,
      channel         TEXT NOT NULL CHECK (channel IN ('sms','whatsapp')),
      category        TEXT NOT NULL,           -- attendance | results | counseling | awareness | system
      body            TEXT NOT NULL,
      language        TEXT NOT NULL DEFAULT 'en',
      delivery_status TEXT NOT NULL DEFAULT 'queued'
                        CHECK (delivery_status IN ('queued','sent','delivered','failed','blocked')),
      provider_ref    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(category);

    -- Multilingual awareness library (English, Bemba, Nyanja, Tonga, Lozi).
    CREATE TABLE IF NOT EXISTS awareness (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      language  TEXT NOT NULL,
      category  TEXT NOT NULL,
      title     TEXT NOT NULL,
      body      TEXT NOT NULL
    );

    -- Auth sessions (opaque bearer tokens).
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    -- Message templates with a native-speaker review workflow. Only 'approved'
    -- translations are ever sent to guardians; un-reviewed languages fall back
    -- to approved English so a learner's family is never sent unchecked copy.
    CREATE TABLE IF NOT EXISTS message_templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT NOT NULL,        -- present | absent | results | counseling
      language    TEXT NOT NULL,        -- en | bem | nya | toi | loz
      body        TEXT NOT NULL,        -- with {name} {avg} {date} placeholders
      status      TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_review','approved','rejected')),
      reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_note TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (key, language)
    );

    -- Tamper-evident audit trail. Access to minors' welfare data must be
    -- traceable (safeguarding + Data Protection Act requirement).
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username   TEXT,
      action     TEXT NOT NULL,        -- e.g. login, student.create, attendance.mark
      entity     TEXT,                 -- e.g. student:42
      ip         TEXT,
      detail     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  `);
}

migrate();

/** Idempotent column additions for databases created by earlier versions. */
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
// Link a guardian (parent user) to a learner for the read-only parent portal.
addColumnIfMissing('students', 'guardian_user_id', 'INTEGER REFERENCES users(id)');
// District scope for District Education Officers (which district they oversee).
addColumnIfMissing('users', 'district', 'TEXT');
// Counseling reminder tracking (so a session/follow-up is only reminded once).
addColumnIfMissing('counseling', 'reminded_scheduled', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('counseling', 'reminded_followup', 'INTEGER NOT NULL DEFAULT 0');
// Guardian consent for messaging/data processing (Data Protection Act).
addColumnIfMissing('students', 'consent_status', "TEXT NOT NULL DEFAULT 'pending'");
addColumnIfMissing('students', 'consent_date', 'TEXT');
addColumnIfMissing('students', 'consent_by', 'INTEGER REFERENCES users(id)');
addColumnIfMissing('students', 'consent_method', 'TEXT');
// Per-learner QR check-in token (Platinum biometric/QR attendance).
addColumnIfMissing('students', 'qr_token', 'TEXT');

module.exports = db;
