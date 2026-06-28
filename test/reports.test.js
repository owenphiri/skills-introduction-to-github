'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('dashboard endpoint returns all required sections', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/reports/dashboard', { token });
  assert.equal(status, 200);
  assert.ok(data.kpis,         'dashboard must include kpis');
  assert.ok(data.trend,        'dashboard must include 30-day revenue trend');
  assert.ok(data.catSales,     'dashboard must include category sales breakdown');
  assert.ok(data.topProducts,  'dashboard must include top products');
  assert.ok(data.payMethods,   'dashboard must include payment method distribution');
  assert.ok(data.recentSales,  'dashboard must include recent sales');
  assert.ok(data.lowStockItems,'dashboard must include low-stock alert items');
});

test('dashboard KPIs contain expected numeric business metrics', async () => {
  const token = await h.login('admin');
  const { data } = await h.req('GET', '/api/reports/dashboard', { token });
  const k = data.kpis;

  assert.ok(typeof k.total_products  === 'number', 'total_products must be a number');
  assert.ok(typeof k.total_customers === 'number', 'total_customers must be a number');
  assert.ok(typeof k.inventory_value === 'number', 'inventory_value must be a number');
  assert.ok(typeof k.month.revenue   === 'number', 'month.revenue must be a number');
  assert.ok(typeof k.month.profit    === 'number', 'month.profit must be a number');

  assert.ok(k.total_products  >= 54, 'should count all 54 seeded products');
  assert.ok(k.total_customers >= 15, 'should count all 15 seeded customers');
  assert.ok(k.inventory_value  >= 0, 'inventory value must be non-negative');
});

test('dashboard reflects historical seeded sales data', async () => {
  const token = await h.login('admin');
  const { data } = await h.req('GET', '/api/reports/dashboard', { token });

  // ~280 historical sales were seeded, spread over the last 120 days
  assert.ok(data.trend.length > 0, '30-day trend should have at least one data point');
  assert.ok(data.trend.every(t => 'date' in t && 'revenue' in t), 'each trend point needs date + revenue');
});

test('monthly report returns entries with correct shape', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/reports/monthly', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data), 'monthly report must be an array');
  assert.ok(data.length > 0, 'should have at least one month of data from seeded sales');
  assert.ok('month'   in data[0], 'each entry must have month');
  assert.ok('revenue' in data[0], 'each entry must have revenue');
});

test('sales summary with date range returns structured report', async () => {
  const token = await h.login('admin');
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const { status, data } = await h.req(
    'GET', `/api/reports/sales-summary?from=${from}&to=${to}`, { token }
  );
  assert.equal(status, 200);
  assert.ok(data.summary,    'must include summary totals');
  assert.ok(data.byDay,      'must include per-day breakdown');
  assert.ok(data.byCategory, 'must include per-category breakdown');
  assert.ok(data.topProds,   'must include top products');
  assert.ok(data.byCashier,  'must include per-cashier totals');
  assert.ok(data.byPayment,  'must include payment method totals');
});

test('sales summary totals are financially coherent', async () => {
  const token = await h.login('admin');
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await h.req(
    'GET', `/api/reports/sales-summary?from=${from}&to=${to}`, { token }
  );
  const s = data.summary;
  assert.ok(s.revenue  >= 0, 'revenue must be non-negative');
  assert.ok(s.profit   <= s.revenue, 'profit must not exceed revenue');
  assert.ok(s.transactions >= 0);
});

test('cashier can access dashboard and monthly reports', async () => {
  const token = await h.login('cashier1');

  const dash    = await h.req('GET', '/api/reports/dashboard', { token });
  const monthly = await h.req('GET', '/api/reports/monthly',   { token });
  assert.equal(dash.status,    200);
  assert.equal(monthly.status, 200);
});
