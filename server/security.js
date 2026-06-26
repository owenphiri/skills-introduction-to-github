'use strict';

/**
 * Security middleware and helpers — zero external dependencies.
 *   - HTTP security headers (a minimal helmet equivalent)
 *   - In-memory rate limiting (per IP) to blunt brute-force attacks
 *   - Audit logging of sensitive actions
 *   - Password-strength policy
 *
 * The rate limiter is per-process. For a multi-instance national deployment
 * this should move to a shared store (Redis); the interface stays the same.
 */
const db = require('./db');

/** Conservative security headers suitable for an app + JSON API. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  // CSP: allow the self-hosted SPA; no inline script is used by app.js.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
}

/**
 * Sliding-window rate limiter.
 * @param {object} opts windowMs, max, key (fn → bucket id)
 */
function rateLimit({ windowMs = 60_000, max = 100, key } = {}) {
  const hits = new Map(); // bucket -> [timestamps]
  return (req, res, next) => {
    const now = Date.now();
    const bucket = (key ? key(req) : null) || req.ip || req.socket.remoteAddress || 'global';
    const arr = (hits.get(bucket) || []).filter(t => now - t < windowMs);
    arr.push(now);
    hits.set(bucket, arr);
    if (arr.length > max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
    next();
  };
}

/** Record a sensitive action in the audit trail. Never throws into the request. */
function audit(req, action, entity = null, detail = null) {
  try {
    db.prepare('INSERT INTO audit_log (user_id, username, action, entity, ip, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        req.user?.id ?? null,
        req.user?.username ?? req.body?.username ?? null,
        action, entity,
        req.ip || req.socket?.remoteAddress || null,
        detail
      );
  } catch (e) {
    console.error('audit log failed:', e.message);
  }
}

/**
 * Validate password strength.
 * @returns {string|null} an error message, or null if acceptable.
 */
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain both letters and numbers';
  }
  return null;
}

module.exports = { securityHeaders, rateLimit, audit, passwordProblem };
