'use strict';

/**
 * Vercel serverless entry.
 *
 * An Express app is a valid Node request handler, so the same app object that
 * runs locally serves every route here via the rewrite in vercel.json.
 *
 * One caveat that matters in production: server/db.js writes to the local
 * filesystem, which on Vercel is ephemeral and per-invocation. Set LELO_DB only
 * for local work — a Vercel deployment must point the data layer at Supabase
 * Postgres instead. See docs/ARCHITECTURE.md ("Two data layers, one schema").
 *
 * DEMO_MODE=1 is the exception: it runs in memory and seeds a fresh demo
 * database on each cold start, so the USSD menu, billing and digest are all
 * explorable from a public URL with no database attached. Data does not
 * survive the instance — which is the honest behaviour for a demo, not a bug.
 */
const config = require('../server/config');
const app = require('../server/app');

if (config.demoMode) {
  require('../server/seed').seed();
  console.log('[lelo] demo mode: in-memory database seeded');
}

module.exports = app;
