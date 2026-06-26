'use strict';

/**
 * Poultry KPI + analytics engine.
 *
 * Computes the industry metrics shown on the PrimeAxis dashboards — FCR,
 * Average Daily Gain, mortality/survival, Hen-Day Egg Production — plus farm
 * financials and a transparent (explainable) AI prediction layer.
 */
const db = require('./db');

const CHICK_WEIGHT_G = 42; // typical day-old chick weight

function daysBetween(a, b) {
  return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
}
function round(n, d = 1) { const p = 10 ** d; return Math.round((n + Number.EPSILON) * p) / p; }

/** Full KPI set for one flock. */
function flockKpis(flockId) {
  const flock = db.prepare('SELECT * FROM flocks WHERE id = ?').get(flockId);
  if (!flock) throw new Error('Flock not found');
  const logs = db.prepare('SELECT * FROM daily_logs WHERE flock_id = ? ORDER BY date').all(flockId);

  const deaths = logs.reduce((s, l) => s + l.mortality + l.culls, 0);
  const feedKg = logs.reduce((s, l) => s + l.feed_kg, 0);
  const ageDays = daysBetween(flock.start_date, new Date().toISOString().slice(0, 10));
  const mortalityRate = flock.initial_count ? (deaths / flock.initial_count) * 100 : 0;

  const k = {
    id: flock.id, name: flock.name, type: flock.type, breed: flock.breed,
    ageDays, initialCount: flock.initial_count, currentCount: flock.current_count,
    deaths, mortalityRate: round(mortalityRate, 2), survivalRate: round(100 - mortalityRate, 2),
    feedKg: round(feedKg)
  };

  if (flock.type === 'broiler') {
    const weighted = logs.filter(l => l.avg_weight_g != null);
    const latestWeight = weighted.length ? weighted[weighted.length - 1].avg_weight_g : null;
    k.avgWeightG = latestWeight ? round(latestWeight) : null;
    k.adg = latestWeight ? round((latestWeight - CHICK_WEIGHT_G) / ageDays, 1) : null; // g/day
    const liveWeightKg = latestWeight ? (flock.current_count * latestWeight) / 1000 : 0;
    k.liveWeightKg = round(liveWeightKg);
    // FCR = feed consumed / live weight produced (cumulative, approximate).
    k.fcr = liveWeightKg > 0 ? round(feedKg / liveWeightKg, 2) : null;
    k.marketReady = latestWeight != null && latestWeight >= 1800; // ~1.8kg
  } else {
    const eggs = logs.reduce((s, l) => s + (l.eggs_collected || 0), 0);
    const broken = logs.reduce((s, l) => s + (l.eggs_broken || 0), 0);
    k.totalEggs = eggs;
    k.brokenRate = eggs ? round((broken / eggs) * 100, 1) : 0;
    const recent = logs.slice(-7).filter(l => l.eggs_collected != null);
    const hdep = recent.length
      ? recent.reduce((s, l) => s + (l.eggs_collected / Math.max(1, flock.current_count)) * 100, 0) / recent.length
      : 0;
    k.henDayProduction = round(hdep, 1); // % HDEP, 7-day avg
    k.eggsPerDay = recent.length ? Math.round(recent.reduce((s, l) => s + l.eggs_collected, 0) / recent.length) : 0;
    k.feedPerDozen = eggs ? round(feedKg / (eggs / 12), 2) : null;
  }
  return k;
}

/** Farm financial summary over the last `days` (default 30). */
function farmFinancials(farmId, days = 30) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString().slice(0, 10);

  const revenue = db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM sales WHERE farm_id = ? AND date >= ?').get(farmId, sinceISO).v;
  const byCat = db.prepare('SELECT category, COALESCE(SUM(amount),0) AS v FROM expenses WHERE farm_id = ? AND date >= ? GROUP BY category').all(farmId, sinceISO);
  const expenseMap = Object.fromEntries(byCat.map(r => [r.category, r.v]));
  const feedPurchases = db.prepare('SELECT COALESCE(SUM(quantity_kg*unit_cost),0) AS v FROM feed_inventory WHERE farm_id = ? AND purchased_at >= ?').get(farmId, sinceISO).v;

  const directCosts = (expenseMap.feed || 0) + (expenseMap.medication || 0) + feedPurchases;
  const totalExpenses = byCat.reduce((s, r) => s + r.v, 0) + feedPurchases;
  const grossProfit = revenue - directCosts;
  const netProfit = revenue - totalExpenses;

  const totalBirds = db.prepare("SELECT COALESCE(SUM(current_count),0) AS v FROM flocks WHERE farm_id = ? AND status = 'active'").get(farmId).v;

  return {
    days, revenue: round(revenue), totalExpenses: round(totalExpenses),
    feedCost: round((expenseMap.feed || 0) + feedPurchases),
    grossProfit: round(grossProfit), netProfit: round(netProfit),
    grossMargin: revenue ? round((grossProfit / revenue) * 100, 1) : 0,
    netMargin: revenue ? round((netProfit / revenue) * 100, 1) : 0,
    revenuePerBird: totalBirds ? round(revenue / totalBirds, 2) : 0,
    profitPerBird: totalBirds ? round(netProfit / totalBirds, 2) : 0,
    expensesByCategory: expenseMap, feedPurchases: round(feedPurchases)
  };
}

/** Daily revenue/expense series for charts. */
function cashflowSeries(farmId, days = 14) {
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(); date.setDate(date.getDate() - d);
    const iso = date.toISOString().slice(0, 10);
    const rev = db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM sales WHERE farm_id = ? AND date = ?').get(farmId, iso).v;
    const exp = db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE farm_id = ? AND date = ?').get(farmId, iso).v;
    out.push({ date: iso, revenue: round(rev), expense: round(exp) });
  }
  return out;
}

/**
 * Explainable AI prediction layer (Platinum). Heuristic, trend-based forecasts
 * and anomaly/disease-risk flags — transparent so farmers can trust them.
 */
function predictions(farmId) {
  const flocks = db.prepare("SELECT * FROM flocks WHERE farm_id = ? AND status = 'active'").all(farmId);
  const alerts = [];
  let feed7d = 0;
  let eggForecast7d = 0;

  for (const f of flocks) {
    const logs = db.prepare('SELECT * FROM daily_logs WHERE flock_id = ? ORDER BY date DESC LIMIT 14').all(f.id);
    if (!logs.length) continue;

    // Feed requirement (next 7 days) = avg daily feed over recent history × 7.
    const recentFeed = logs.slice(0, 7);
    const avgFeed = recentFeed.reduce((s, l) => s + l.feed_kg, 0) / recentFeed.length;
    feed7d += avgFeed * 7;

    // Mortality anomaly / disease risk — compare the worst of the last 3 days
    // against the baseline of the preceding fortnight.
    const mort = logs.map(l => l.mortality);
    const recentMort = mort.slice(0, 3);
    const peakRecent = Math.max(0, ...recentMort);
    const baseline = mort.slice(3);
    const avgMort = baseline.length ? baseline.reduce((s, m) => s + m, 0) / baseline.length : 0;
    if (peakRecent > 0 && peakRecent >= Math.max(5, avgMort * 2.5)) {
      alerts.push({ level: 'high', flock: f.name, type: 'mortality_spike',
        message: `Mortality spike in ${f.name}: ${peakRecent} deaths in a recent day vs ~${round(avgMort, 1)}/day baseline. Inspect for disease.` });
    }

    // Falling feed intake is an early disease signal.
    if (recentFeed.length >= 4) {
      const firstHalf = recentFeed.slice(Math.ceil(recentFeed.length / 2));
      const secondHalf = recentFeed.slice(0, Math.floor(recentFeed.length / 2));
      const a = firstHalf.reduce((s, l) => s + l.feed_kg, 0) / firstHalf.length;
      const b = secondHalf.reduce((s, l) => s + l.feed_kg, 0) / secondHalf.length;
      if (a > 0 && b < a * 0.8) {
        alerts.push({ level: 'medium', flock: f.name, type: 'feed_drop',
          message: `Feed intake in ${f.name} dropped ${round((1 - b / a) * 100)}%. Watch for illness or water/heat stress.` });
      }
    }

    // Egg production forecast (layers): project recent HDEP.
    if (f.type === 'layer') {
      const recentEggs = logs.filter(l => l.eggs_collected != null).slice(0, 7);
      if (recentEggs.length) {
        const avgEggs = recentEggs.reduce((s, l) => s + l.eggs_collected, 0) / recentEggs.length;
        eggForecast7d += Math.round(avgEggs * 7);
      }
    }
  }

  // Revenue forecast = avg daily revenue (30d) × 30.
  const rev30 = db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM sales WHERE farm_id = ? AND date >= date('now','-30 days')").get(farmId).v;
  const revForecast = round((rev30 / 30) * 30);

  if (!alerts.length) alerts.push({ level: 'low', type: 'ok', message: 'No anomalies detected — flocks are within normal ranges.' });

  return {
    feedRequirement7dKg: round(feed7d),
    eggForecast7d,
    revenueForecast30d: revForecast,
    alerts
  };
}

module.exports = { flockKpis, farmFinancials, cashflowSeries, predictions };
