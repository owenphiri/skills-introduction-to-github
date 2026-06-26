'use strict';

/** Authentication & authorisation — scrypt hashing + revocable bearer sessions. */
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
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
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, Date.now() + config.sessionTtlMs);
  return token;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function userForToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) { destroySession(token); return null; }
  return db.prepare('SELECT id, full_name, username, role, farm_id FROM users WHERE id = ?').get(row.user_id);
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userForToken(token);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

module.exports = { hashPassword, verifyPassword, createSession, destroySession, userForToken, authenticate, requireRole };
