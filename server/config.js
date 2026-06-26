'use strict';

/**
 * Central configuration. Everything is overridable via environment variables so
 * the same build can run on a developer laptop, a school server, or the
 * Government of Zambia Smart Zambia / data-centre deployment without code edits.
 */
const path = require('path');

module.exports = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',

  // Database lives on disk so data survives restarts. In production this path
  // should point at an encrypted volume.
  dbFile: process.env.SEWSMS_DB || path.join(__dirname, '..', 'data', 'sewsms.db'),

  // Session token lifetime (ms). Default 12 hours (a school day + buffer).
  sessionTtlMs: Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000),

  // Messaging gateway. "mock" logs to the outbox table only (zero airtime cost,
  // fully demonstrable). For go-live, set MESSAGING_PROVIDER to a real adapter:
  //   - "africastalking": Africa's Talking SMS (common Zambian aggregator)
  //   - "http": a generic JSON HTTP gateway (Zamtel / MTN / Airtel bulk SMS)
  // and supply the matching credentials. No other code changes are required.
  messaging: {
    provider: process.env.MESSAGING_PROVIDER || 'mock',
    senderId: process.env.SMS_SENDER_ID || 'SAFEGIRL',
    // Generic HTTP gateway
    apiKey: process.env.SMS_API_KEY || '',
    apiUrl: process.env.SMS_API_URL || '',
    // Africa's Talking
    atUsername: process.env.AT_USERNAME || '',
    atApiKey: process.env.AT_API_KEY || '',
    atApiUrl: process.env.AT_API_URL || 'https://api.africastalking.com/version1/messaging',
    // Shared secret used to authenticate inbound delivery-report webhooks.
    webhookSecret: process.env.SMS_WEBHOOK_SECRET || ''
  },

  // How often (ms) the counseling reminder dispatcher runs. Default hourly.
  reminderIntervalMs: Number(process.env.REMINDER_INTERVAL_MS || 60 * 60 * 1000),

  // Risk-engine thresholds (see riskEngine.js). Kept here so District Education
  // Officers / M&E teams can tune policy without touching logic.
  risk: {
    consecutiveAbsenceFlag: Number(process.env.RISK_CONSECUTIVE || 3),
    monthlyAbsenceFlag: Number(process.env.RISK_MONTHLY || 5),
    mediumScore: Number(process.env.RISK_MEDIUM || 30),
    highScore: Number(process.env.RISK_HIGH || 60)
  }
};
