'use strict';

/**
 * Vercel serverless entry.
 *
 * An Express app is a valid Node request handler, so the same app object that
 * runs locally serves every route here via the rewrite in vercel.json.
 *
 * One caveat that matters in production: server/db.js writes to the local
 * filesystem, which on Vercel is ephemeral and per-invocation. Set DE_DB only
 * for local work — a Vercel deployment must point the data layer at Supabase
 * Postgres instead. See docs/ARCHITECTURE.md ("Two data layers, one schema").
 */
module.exports = require('../server/app');
