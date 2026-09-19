'use strict';

/**
 * Lelo — HTTP surface.
 *
 * Exported as a bare Express app with no listen() call so the same object
 * serves three hosts unchanged: `server/index.js` locally, `api/index.js` on
 * Vercel, and the test harness in-process.
 */
const path = require('path');
const express = require('express');
const config = require('./config');
const db = require('./db');
const money = require('./money');
const wallet = require('./wallet');
const verticals = require('./verticals');
const content = require('./content');
const ussd = require('./ussd');
const whatsapp = require('./whatsapp');
const payments = require('./payments');
const messaging = require('./messaging');
const billing = require('./billing');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error', ...(err.concerns ? { concerns: err.concerns } : {}) });
});

/* ------------------------------------------------------- RAW-BODY ROUTES --
 * Signature verification must run over the exact bytes received, so these two
 * webhooks are mounted with a raw parser ahead of the global JSON parser.
 */
const rawJson = express.raw({ type: '*/*', limit: '1mb' });

/** WhatsApp Cloud API — Meta's verification handshake. */
app.get('/api/whatsapp/webhook', (req, res) => {
  const challenge = whatsapp.verifyHandshake(req.query);
  if (challenge == null) return res.sendStatus(403);
  res.type('text/plain').send(challenge);
});

/** WhatsApp Cloud API — inbound messages and status callbacks. */
app.post('/api/whatsapp/webhook', rawJson, wrap(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

  // Meta retries aggressively on a non-200, so acknowledge first and let a
  // bad signature be a logged rejection rather than a retry storm.
  if (config.whatsapp.appSecret && !whatsapp.verifySignature(raw, req.get('X-Hub-Signature-256'))) {
    db.audit('whatsapp', 'webhook.rejected', 'bad signature');
    return res.sendStatus(403);
  }

  let payload = {};
  try { payload = JSON.parse(raw.toString('utf8') || '{}'); } catch { /* fall through */ }

  const replies = [];
  for (const msg of whatsapp.extractMessages(payload)) {
    if (msg.status) { messaging.recordDeliveryReport(msg.messageId, msg.status === 'read' ? 'delivered' : msg.status); continue; }
    const { reply } = whatsapp.handleInbound(msg);
    const sub = wallet.findByMsisdn(msg.from);
    if (sub && reply) {
      // Inside the 24-hour service window opened by their inbound message,
      // a free-form reply is allowed. allowDuplicate because this is a reply,
      // not the once-a-day digest.
      await messaging.send({ subscriber: sub, channel: 'whatsapp', body: reply, allowDuplicate: true });
      replies.push({ to: msg.from, reply });
    }
  }
  res.json({ ok: true, handled: replies.length });
}));

/** PSP settlement callback. */
app.post('/api/payments/webhook', rawJson, wrap(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

  if (config.payments.webhookSecret &&
      !payments.verifySignature(raw, req.get('X-Signature') || req.get('X-Webhook-Signature'))) {
    db.audit('psp', 'webhook.rejected', 'bad signature');
    return res.sendStatus(403);
  }

  let body = {};
  try { body = JSON.parse(raw.toString('utf8') || '{}'); } catch { return res.status(400).json({ error: 'Bad JSON' }); }

  const result = payments.settle({
    pspRef: body.reference || body.psp_ref || body.id,
    status: body.status === 'SUCCESSFUL' || body.status === 'success' ? 'succeeded' : body.status,
    amountNgwee: body.amount_ngwee != null ? Number(body.amount_ngwee)
      : body.amount != null ? money.toNgwee(body.amount) : undefined,
    msisdn: body.msisdn || body.phone,
    bundleCode: body.bundle_code,
    raw: body
  });

  if (result.applied) {
    const sub = wallet.byId(result.subscriberId);
    await messaging.send({
      subscriber: sub, channel: 'sms', allowDuplicate: true,
      body: `${config.serviceName}: ${money.format(result.amountNgwee)} received. ` +
            `${result.daysAdded} more days. Balance ${money.format(result.balanceNgwee)}.`
    });
  }
  res.json({ ok: true, ...result });
}));

/* ------------------------------------------------------- PARSED ROUTES -- */

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', service: 'lelo', time: new Date().toISOString() }));

/** Public catalogue for the landing page. */
app.get('/api/catalog', (req, res) => res.json({
  service: config.serviceName,
  shortCode: config.shortCode,
  // The landing page only shows its USSD simulator in demo mode. Against a
  // real database that widget would be an unauthenticated way for anyone to
  // create subscriber rows.
  demo: config.demoMode,
  dailyPrice: money.format(config.dailyPriceNgwee),
  dailyPriceNgwee: config.dailyPriceNgwee,
  trialDays: config.trialDays,
  verticals: verticals.list().map(v => ({ code: v.code, name: v.name, blurb: v.blurb, sources: v.sources })),
  bundles: money.BUNDLES.map(b => ({ ...b, price: money.format(b.priceNgwee) }))
}));

/**
 * USSD gateway webhook.
 *
 * Responds in the Africa's Talking text convention (CON/END) as plain text,
 * which is what the aggregators expect on the wire.
 */
app.post('/api/ussd', wrap((req, res) => {
  const result = ussd.handle({ ...req.body, ...req.query });
  res.type('text/plain').send(result.text);
}));

/** Short-code SMS inbound — the same keywords WhatsApp answers. */
app.post('/api/sms/inbound', wrap(async (req, res) => {
  const from = req.body.from || req.body.msisdn || req.body.phoneNumber;
  const text = req.body.text || req.body.message || '';
  const { reply } = whatsapp.handleInbound({ from, text });
  const sub = wallet.findByMsisdn(from);
  if (sub && reply) await messaging.send({ subscriber: sub, channel: 'sms', body: reply, allowDuplicate: true });
  res.json({ ok: true, reply });
}));

/** SMS delivery reports. */
app.post('/api/sms/dlr', wrap((req, res) => {
  const ref = req.body.id || req.body.messageId || req.body.provider_ref;
  const status = String(req.body.status || '').toLowerCase();
  res.json({ ok: messaging.recordDeliveryReport(ref, status === 'success' ? 'delivered' : status) });
}));

/* ------------------------------------------------------------- CRON ---- */

function requireCron(req, res, next) {
  const given = req.get('Authorization') || '';
  if (given !== `Bearer ${config.cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

/**
 * One batch of the daily run. Returns `lastId`; call again with it until
 * `done` is true. Kept as a batch so a platform function timeout cannot
 * strand the job half-finished.
 */
app.post('/api/cron/daily', requireCron, wrap(async (req, res) => {
  const stats = await billing.runDaily({
    date: req.body.date || db.today(),
    afterId: Number(req.body.afterId || 0),
    batchSize: Number(req.body.batchSize || 200),
    channel: req.body.channel || 'sms'
  });
  res.json(stats);
}));

/**
 * Vercel Cron invokes a GET with `Authorization: Bearer $CRON_SECRET`, so the
 * schedule in vercel.json lands here. It runs batches until the base is done
 * or the time budget is nearly spent, then reports `lastId` for the next
 * invocation — a platform function timeout must never strand the run.
 */
app.get('/api/cron/daily', requireCron, wrap(async (req, res) => {
  const deadline = Date.now() + Number(req.query.budgetMs || 45_000);
  const date = req.query.date || db.today();
  const total = { processed: 0, delivered: 0, charged: 0, trial: 0, skipped: 0, lowBalance: 0, nudged: 0, failed: 0, segments: 0 };
  let afterId = Number(req.query.afterId || 0);
  let done = false;

  while (Date.now() < deadline) {
    const s = await billing.runDaily({ date, afterId, batchSize: 200 });
    for (const k of Object.keys(total)) total[k] += s[k];
    afterId = s.lastId;
    if (s.done) { done = true; break; }
  }
  res.json({ date, ...total, lastId: afterId, done });
}));

/* ------------------------------------------------------------ ADMIN ---- */

function requireAdmin(req, res, next) {
  if ((req.get('Authorization') || '') !== `Bearer ${config.adminToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/admin/summary', requireAdmin, wrap((req, res) => {
  const date = req.query.date || db.today();
  const counts = db.prepare(`
    SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status
  `).all();
  res.json({
    subscribers: counts.reduce((a, r) => ({ ...a, [r.status]: r.n }), {}),
    consented: db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE consent_at IS NOT NULL').get().n,
    ...billing.dailySummary(date)
  });
}));

app.get('/api/admin/content', requireAdmin, wrap((req, res) => {
  res.json(db.prepare(
    'SELECT * FROM content_items WHERE valid_on = ? ORDER BY vertical_code, priority DESC'
  ).all(req.query.date || db.today()));
}));

app.post('/api/admin/content', requireAdmin, wrap((req, res) => {
  res.status(201).json(content.addItem({
    verticalCode: req.body.vertical_code,
    body: req.body.body,
    validOn: req.body.valid_on,
    districtId: req.body.district_id ?? null,
    language: req.body.language || 'en',
    source: req.body.source,
    priority: Number(req.body.priority || 0)
  }));
}));

app.post('/api/admin/content/:id/approve', requireAdmin, wrap((req, res) => {
  res.json(content.approve(Number(req.params.id), req.body.approved_by || 'admin'));
}));

app.get('/api/admin/subscribers/:msisdn', requireAdmin, wrap((req, res) => {
  const sub = wallet.findByMsisdn(req.params.msisdn);
  if (!sub) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...sub,
    balance: money.format(wallet.balance(sub.id)),
    balance_ngwee: wallet.balance(sub.id),
    days_remaining: wallet.daysRemaining(sub.id),
    topics: wallet.topics(sub.id),
    ledger: wallet.ledger(sub.id)
  });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
