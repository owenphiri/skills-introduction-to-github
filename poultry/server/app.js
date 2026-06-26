'use strict';

/**
 * PrimeAxis Smart Poultry Management System — API + static host.
 */
const path = require('path');
const express = require('express');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const features = require('./features');
const kpis = require('./kpis');

const app = express();
app.set('trust proxy', true);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  console.error(err); res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

// Keep a flock's current_count consistent with logged mortality + culls.
function recountFlock(flockId) {
  const f = db.prepare('SELECT initial_count FROM flocks WHERE id = ?').get(flockId);
  const dead = db.prepare('SELECT COALESCE(SUM(mortality+culls),0) AS d FROM daily_logs WHERE flock_id = ?').get(flockId).d;
  db.prepare('UPDATE flocks SET current_count = MAX(0, ? - ?) WHERE id = ?').run(f.initial_count, dead, flockId);
}

// Ensure a flock belongs to the caller's farm.
function flockInScope(req, res, flockId) {
  const f = db.prepare('SELECT * FROM flocks WHERE id = ?').get(flockId);
  if (!f) { res.status(404).json({ error: 'Flock not found' }); return null; }
  if (f.farm_id !== req.user.farm_id) { res.status(403).json({ error: 'Flock belongs to another farm' }); return null; }
  return f;
}

/* --------------------------------------------------------------- PUBLIC -- */

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'primeaxis-poultry', time: new Date().toISOString() }));

/** Pricing/packages for the marketing landing page (public). */
app.get('/api/packages', (req, res) => {
  res.json(Object.entries(features.PACKAGES).map(([key, p]) => ({
    key, ...p, users: p.users === Infinity ? 'Unlimited' : p.users,
    features: Object.keys(features.FEATURES).filter(f => features.tierIncludes(key, f))
  })));
});

/* ----------------------------------------------------------------- AUTH -- */

app.post('/api/auth/login', wrap((req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = auth.createSession(user.id);
  const farm = db.prepare('SELECT name, location, package FROM farms WHERE id = ?').get(user.farm_id);
  res.json({
    token,
    user: {
      id: user.id, full_name: user.full_name, role: user.role, username: user.username,
      farm: farm?.name, package: features.farmPackage(user.farm_id), features: features.featuresForUser(user)
    }
  });
}));

app.post('/api/auth/logout', auth.authenticate, wrap((req, res) => { auth.destroySession(req.token); res.json({ ok: true }); }));

app.get('/api/auth/me', auth.authenticate, wrap((req, res) => {
  const farm = db.prepare('SELECT name, location, package FROM farms WHERE id = ?').get(req.user.farm_id);
  res.json({ user: { ...req.user, farm: farm?.name, package: features.farmPackage(req.user.farm_id), features: features.featuresForUser(req.user) } });
}));

/* --------------------------------------------------------------- FLOCKS -- */

app.get('/api/flocks', auth.authenticate, wrap((req, res) => {
  const rows = db.prepare("SELECT * FROM flocks WHERE farm_id = ? ORDER BY status, start_date DESC").all(req.user.farm_id);
  res.json(rows.map(f => ({ ...f, kpis: kpis.flockKpis(f.id) })));
}));

app.post('/api/flocks', auth.authenticate, auth.requireRole('owner', 'manager'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.name || !b.type || !b.start_date || !b.initial_count) {
    return res.status(400).json({ error: 'name, type, start_date and initial_count are required' });
  }
  if (b.type === 'layer' && !features.tierIncludes(features.farmPackage(req.user.farm_id), 'layer_module')) {
    return res.status(402).json({ error: 'The layer module requires the Silver package or higher.', requiredTier: 'silver' });
  }
  const info = db.prepare(`INSERT INTO flocks (farm_id, name, type, breed, house, start_date, initial_count, current_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.farm_id, b.name, b.type, b.breed || null, b.house || null, b.start_date, b.initial_count, b.initial_count);
  res.status(201).json(db.prepare('SELECT * FROM flocks WHERE id = ?').get(info.lastInsertRowid));
}));

app.get('/api/flocks/:id', auth.authenticate, wrap((req, res) => {
  const f = flockInScope(req, res, req.params.id); if (!f) return;
  const logs = db.prepare('SELECT * FROM daily_logs WHERE flock_id = ? ORDER BY date DESC LIMIT 30').all(f.id);
  const vaccinations = db.prepare('SELECT * FROM vaccinations WHERE flock_id = ? ORDER BY scheduled_date').all(f.id);
  res.json({ flock: f, kpis: kpis.flockKpis(f.id), logs, vaccinations });
}));

/* ----------------------------------------------------------- DAILY LOGS -- */

app.post('/api/flocks/:id/logs', auth.authenticate, auth.requireRole('owner', 'manager', 'worker'), wrap((req, res) => {
  const f = flockInScope(req, res, req.params.id); if (!f) return;
  const b = req.body || {};
  const date = b.date || new Date().toISOString().slice(0, 10);
  db.prepare(`INSERT INTO daily_logs (flock_id, date, mortality, culls, feed_kg, avg_weight_g, eggs_collected, eggs_broken, water_l, notes, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(flock_id, date) DO UPDATE SET
      mortality=excluded.mortality, culls=excluded.culls, feed_kg=excluded.feed_kg,
      avg_weight_g=excluded.avg_weight_g, eggs_collected=excluded.eggs_collected,
      eggs_broken=excluded.eggs_broken, water_l=excluded.water_l, notes=excluded.notes`)
    .run(f.id, date, b.mortality || 0, b.culls || 0, b.feed_kg || 0,
      b.avg_weight_g ?? null, b.eggs_collected ?? null, b.eggs_broken ?? null, b.water_l ?? null, b.notes || null, req.user.id);
  recountFlock(f.id);
  res.status(201).json({ ok: true, kpis: kpis.flockKpis(f.id) });
}));

/* ------------------------------------------------------------------ FEED -- */

app.get('/api/feed', auth.authenticate, features.requireFeature('feed_tracking'), wrap((req, res) => {
  const purchases = db.prepare('SELECT * FROM feed_inventory WHERE farm_id = ? ORDER BY purchased_at DESC LIMIT 50').all(req.user.farm_id);
  const purchasedKg = db.prepare('SELECT COALESCE(SUM(quantity_kg),0) AS v FROM feed_inventory WHERE farm_id = ?').get(req.user.farm_id).v;
  const consumedKg = db.prepare('SELECT COALESCE(SUM(d.feed_kg),0) AS v FROM daily_logs d JOIN flocks f ON f.id=d.flock_id WHERE f.farm_id = ?').get(req.user.farm_id).v;
  res.json({ purchases, stockKg: Math.round((purchasedKg - consumedKg) * 10) / 10, purchasedKg, consumedKg: Math.round(consumedKg * 10) / 10 });
}));

app.post('/api/feed', auth.authenticate, auth.requireRole('owner', 'manager'), features.requireFeature('feed_tracking'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.feed_type || !b.quantity_kg) return res.status(400).json({ error: 'feed_type and quantity_kg are required' });
  const info = db.prepare('INSERT INTO feed_inventory (farm_id, feed_type, quantity_kg, unit_cost, purchased_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.farm_id, b.feed_type, b.quantity_kg, b.unit_cost || 0, b.purchased_at || new Date().toISOString().slice(0, 10));
  res.status(201).json({ id: info.lastInsertRowid });
}));

/* ---------------------------------------------------------- VACCINATIONS -- */

app.get('/api/vaccinations', auth.authenticate, features.requireFeature('vaccination'), wrap((req, res) => {
  res.json(db.prepare(`SELECT v.*, fl.name AS flock_name FROM vaccinations v JOIN flocks fl ON fl.id = v.flock_id
    WHERE fl.farm_id = ? ORDER BY v.status, v.scheduled_date`).all(req.user.farm_id));
}));

app.post('/api/vaccinations', auth.authenticate, auth.requireRole('owner', 'manager'), features.requireFeature('vaccination'), wrap((req, res) => {
  const b = req.body || {};
  if (!flockInScope(req, res, b.flock_id)) return;
  if (!b.vaccine || !b.scheduled_date) return res.status(400).json({ error: 'vaccine and scheduled_date are required' });
  const info = db.prepare('INSERT INTO vaccinations (flock_id, vaccine, scheduled_date, notes) VALUES (?, ?, ?, ?)')
    .run(b.flock_id, b.vaccine, b.scheduled_date, b.notes || null);
  res.status(201).json(db.prepare('SELECT * FROM vaccinations WHERE id = ?').get(info.lastInsertRowid));
}));

app.put('/api/vaccinations/:id', auth.authenticate, auth.requireRole('owner', 'manager', 'worker'), features.requireFeature('vaccination'), wrap((req, res) => {
  const v = db.prepare('SELECT v.*, fl.farm_id FROM vaccinations v JOIN flocks fl ON fl.id=v.flock_id WHERE v.id = ?').get(req.params.id);
  if (!v || v.farm_id !== req.user.farm_id) return res.status(404).json({ error: 'Not found' });
  const status = req.body?.status || 'done';
  db.prepare("UPDATE vaccinations SET status = ?, administered_date = CASE WHEN ?='done' THEN date('now') ELSE administered_date END WHERE id = ?")
    .run(status, status, req.params.id);
  res.json(db.prepare('SELECT * FROM vaccinations WHERE id = ?').get(req.params.id));
}));

/* ----------------------------------------------------------------- SALES -- */

app.get('/api/sales', auth.authenticate, features.requireFeature('sales'), wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM sales WHERE farm_id = ? ORDER BY date DESC, id DESC LIMIT 100').all(req.user.farm_id));
}));

app.post('/api/sales', auth.authenticate, auth.requireRole('owner', 'manager', 'accountant'), features.requireFeature('sales'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.category || !b.quantity) return res.status(400).json({ error: 'category and quantity are required' });
  const amount = b.amount != null ? b.amount : (b.quantity * (b.unit_price || 0));
  const info = db.prepare(`INSERT INTO sales (farm_id, flock_id, category, quantity, unit, unit_price, amount, customer, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.farm_id, b.flock_id || null, b.category, b.quantity, b.unit || null,
    b.unit_price || 0, amount, b.customer || null, b.date || new Date().toISOString().slice(0, 10));
  res.status(201).json(db.prepare('SELECT * FROM sales WHERE id = ?').get(info.lastInsertRowid));
}));

/* -------------------------------------------------------------- EXPENSES -- */

app.get('/api/expenses', auth.authenticate, features.requireFeature('expense_tracking'), wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM expenses WHERE farm_id = ? ORDER BY date DESC, id DESC LIMIT 100').all(req.user.farm_id));
}));

app.post('/api/expenses', auth.authenticate, auth.requireRole('owner', 'manager', 'accountant'), features.requireFeature('expense_tracking'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.category || b.amount == null) return res.status(400).json({ error: 'category and amount are required' });
  const info = db.prepare('INSERT INTO expenses (farm_id, category, amount, note, date) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.farm_id, b.category, b.amount, b.note || null, b.date || new Date().toISOString().slice(0, 10));
  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid));
}));

/* ------------------------------------------------------------- EMPLOYEES -- */

app.get('/api/employees', auth.authenticate, features.requireFeature('employees'), wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM employees WHERE farm_id = ? ORDER BY active DESC, full_name').all(req.user.farm_id));
}));

app.post('/api/employees', auth.authenticate, auth.requireRole('owner', 'manager'), features.requireFeature('employees'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.full_name) return res.status(400).json({ error: 'full_name is required' });
  const info = db.prepare('INSERT INTO employees (farm_id, full_name, role, phone, salary) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.farm_id, b.full_name, b.role || null, b.phone || null, b.salary || 0);
  res.status(201).json(db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid));
}));

/* ------------------------------------------------------------ DASHBOARDS -- */

/** Operations dashboard — flock health, mortality, feed, upcoming vaccinations. */
app.get('/api/dashboard/operations', auth.authenticate, wrap((req, res) => {
  const flocks = db.prepare("SELECT * FROM flocks WHERE farm_id = ? AND status='active'").all(req.user.farm_id);
  const flockKpis = flocks.map(f => kpis.flockKpis(f.id));
  const totalBirds = flockKpis.reduce((s, k) => s + k.currentCount, 0);
  const avgMortality = flockKpis.length ? flockKpis.reduce((s, k) => s + k.mortalityRate, 0) / flockKpis.length : 0;
  const eggsToday = db.prepare(`SELECT COALESCE(SUM(eggs_collected),0) AS v FROM daily_logs d JOIN flocks f ON f.id=d.flock_id
    WHERE f.farm_id = ? AND d.date = date('now')`).get(req.user.farm_id).v;
  let upcomingVax = [];
  if (features.tierIncludes(features.farmPackage(req.user.farm_id), 'vaccination')) {
    upcomingVax = db.prepare(`SELECT v.*, fl.name AS flock_name FROM vaccinations v JOIN flocks fl ON fl.id=v.flock_id
      WHERE fl.farm_id = ? AND v.status='scheduled' AND v.scheduled_date >= date('now') ORDER BY v.scheduled_date LIMIT 5`).all(req.user.farm_id);
  }
  res.json({
    totalBirds, activeFlocks: flocks.length, avgMortalityRate: Math.round(avgMortality * 100) / 100,
    eggsToday, flockKpis, upcomingVax
  });
}));

/** Financial dashboard (Silver+). */
app.get('/api/dashboard/financial', auth.authenticate, features.requireFeature('financial_reports'), wrap((req, res) => {
  const days = Math.min(365, Number(req.query.days) || 30);
  res.json({ ...kpis.farmFinancials(req.user.farm_id, days), cashflow: kpis.cashflowSeries(req.user.farm_id, 14) });
}));

/** Executive dashboard (Gold+) — trends and productivity indices. */
app.get('/api/dashboard/executive', auth.authenticate, features.requireFeature('executive_dashboard'), wrap((req, res) => {
  const fin30 = kpis.farmFinancials(req.user.farm_id, 30);
  const fin60 = kpis.farmFinancials(req.user.farm_id, 60);
  const prev30Revenue = fin60.revenue - fin30.revenue;
  const growthRate = prev30Revenue > 0 ? Math.round(((fin30.revenue - prev30Revenue) / prev30Revenue) * 1000) / 10 : null;
  const flocks = db.prepare("SELECT id, type FROM flocks WHERE farm_id = ? AND status='active'").all(req.user.farm_id);
  const ks = flocks.map(f => kpis.flockKpis(f.id));
  const broilers = ks.filter(k => k.type === 'broiler');
  const layers = ks.filter(k => k.type === 'layer');
  res.json({
    revenue30d: fin30.revenue, netProfit30d: fin30.netProfit, netMargin: fin30.netMargin,
    revenueGrowthRate: growthRate,
    avgFcr: broilers.length ? Math.round(broilers.reduce((s, k) => s + (k.fcr || 0), 0) / broilers.length * 100) / 100 : null,
    avgHenDayProduction: layers.length ? Math.round(layers.reduce((s, k) => s + (k.henDayProduction || 0), 0) / layers.length * 10) / 10 : null,
    survivalRate: ks.length ? Math.round(ks.reduce((s, k) => s + k.survivalRate, 0) / ks.length * 10) / 10 : null,
    profitPerBird: fin30.profitPerBird
  });
}));

/** AI predictions (Platinum). */
app.get('/api/predictions', auth.authenticate, features.requireFeature('ai_predictions'), wrap((req, res) => {
  res.json(kpis.predictions(req.user.farm_id));
}));

/* ------------------------------------------------------------------ SPA -- */

app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

if (require.main === module) {
  app.listen(config.port, config.host, () => console.log(`PrimeAxis Poultry running at http://${config.host}:${config.port}`));
}

module.exports = app;
