'use strict';

/**
 * Authentication & authorisation.
 *
 * Passwords are hashed with scrypt (Node built-in crypto — no external deps).
 * Sessions are opaque random bearer tokens stored server-side, so they can be
 * revoked instantly (important for safeguarding: a compromised teacher account
 * touching sensitive girl-child welfare data must be killable immediately).
 */
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derived] = String(stored).split(':');
  if (!salt || !derived) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(check, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + config.sessionTtlMs;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expires);
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function userForToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    destroySession(token);
    return null;
  }
  return db.prepare(
    'SELECT id, full_name, username, role, phone, school_id, district FROM users WHERE id = ?'
  ).get(row.user_id);
}

/** Express middleware: require a valid session. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userForToken(token);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  req.token = token;
  next();
}

/** Express middleware factory: require one of the given roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  userForToken,
  authenticate,
  requireRole
};
