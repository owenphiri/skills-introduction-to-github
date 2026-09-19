'use strict';
const path = require('path');

/**
 * Every tunable lives here so that the same build runs on a laptop, on Vercel,
 * or on a container host with nothing but environment variables changed.
 */
module.exports = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || '0.0.0.0',
  /**
   * Demo mode runs entirely in memory and reseeds itself on every cold start.
   * It exists so the service can be shown on a platform with an ephemeral,
   * per-invocation filesystem (Vercel) without a Supabase project — nothing
   * written in demo mode outlives the instance, which is exactly the point.
   */
  demoMode: process.env.DEMO_MODE === '1',
  dbFile: process.env.LELO_DB || (process.env.DEMO_MODE === '1'
    ? ':memory:'
    : path.join(__dirname, '..', 'data', 'lelo.db')),

  serviceName: process.env.SERVICE_NAME || 'Lelo',
  shortCode: process.env.USSD_SHORT_CODE || '*2255#',
  supportPhone: process.env.SUPPORT_PHONE || '+260 972 000 000',

  /**
   * All money is integer ngwee (1 ZMW = 100 ngwee). Nothing in this codebase
   * stores an amount as a float — rounding drift on a million daily K1 charges
   * is a reconciliation problem you cannot undo.
   */
  dailyPriceNgwee: Number(process.env.DAILY_PRICE_NGWEE || 100),

  /** Days of free content before the first draw-down. */
  trialDays: Number(process.env.TRIAL_DAYS || 7),

  /**
   * Low-balance warning threshold. Sent with the digest so a subscriber tops up
   * before the service cuts out rather than after.
   */
  lowBalanceNgwee: Number(process.env.LOW_BALANCE_NGWEE || 200),

  /** Hard limits of the delivery channels — see docs/ARCHITECTURE.md. */
  limits: {
    ussdScreenChars: 182,
    smsSegmentChars: 160
  },

  messaging: {
    provider: process.env.MESSAGING_PROVIDER || 'mock',
    senderId: process.env.SMS_SENDER_ID || 'LELO',
    apiUrl: process.env.SMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || ''
  },

  whatsapp: {
    // WhatsApp Business Platform (Cloud API) — see docs/COMPLIANCE.md before
    // sending anything that is not a reply inside the 24-hour service window.
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'dev-verify-token',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    graphUrl: process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com/v21.0'
  },

  payments: {
    /**
     * The licensed Payment Service Provider that is merchant of record for
     * collections. We never touch a mobile-money float ourselves — see
     * docs/COMPLIANCE.md on why that boundary matters for BoZ licensing.
     */
    provider: process.env.PSP_PROVIDER || 'mock',
    apiUrl: process.env.PSP_API_URL || '',
    apiKey: process.env.PSP_API_KEY || '',
    webhookSecret: process.env.PSP_WEBHOOK_SECRET || ''
  },

  /** Shared secret for the daily billing/digest cron endpoint. */
  cronSecret: process.env.CRON_SECRET || 'dev-cron-secret',

  /** Static admin token for the operator console (replace with real auth). */
  adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token'
};
