'use strict';
const path = require('path');

module.exports = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || '0.0.0.0',
  dbFile: process.env.POULTRY_DB || path.join(__dirname, '..', 'data', 'poultry.db'),
  sessionTtlMs: Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000),
  currency: process.env.CURRENCY || 'ZMW',
  // SMS gateway (mock by default; same pluggable design as production deployments).
  messaging: { provider: process.env.MESSAGING_PROVIDER || 'mock', senderId: process.env.SMS_SENDER_ID || 'PRIMEAXIS' }
};
