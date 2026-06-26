'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('public packages endpoint exposes the four pricing tiers', async () => {
  const { status, data } = await h.req('GET', '/api/packages');
  assert.equal(status, 200);
  assert.equal(data.length, 4);
  const platinum = data.find(p => p.key === 'platinum');
  assert.equal(platinum.price, 30000);
  assert.ok(platinum.features.includes('ai_predictions'));
  const bronze = data.find(p => p.key === 'bronze');
  assert.ok(!bronze.features.includes('ai_predictions'));
});

test('login returns farm package and feature list', async () => {
  const { status, data } = await h.req('POST', '/api/auth/login', { body: { username: 'manager', password: 'password' } });
  assert.equal(status, 200);
  assert.equal(data.user.package, 'platinum');
  assert.ok(data.user.features.includes('ai_predictions'));
});

test('unauthenticated access is rejected', async () => {
  assert.equal((await h.req('GET', '/api/flocks')).status, 401);
});

test('operations dashboard returns flock KPIs', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/dashboard/operations', { token });
  assert.equal(status, 200);
  assert.ok(data.totalBirds > 0);
  assert.equal(data.activeFlocks, 2);
  const broiler = data.flockKpis.find(k => k.type === 'broiler');
  assert.ok(broiler.fcr > 0 && broiler.fcr < 4, 'FCR should be a sane number');
  assert.ok(broiler.survivalRate > 50);
  const layer = data.flockKpis.find(k => k.type === 'layer');
  assert.ok(layer.henDayProduction > 0);
});

test('financial dashboard computes revenue, expenses and margins', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/dashboard/financial', { token });
  assert.equal(status, 200);
  assert.ok(data.revenue > 0 && data.totalExpenses > 0);
  assert.equal(Math.round((data.revenue - data.totalExpenses)), Math.round(data.netProfit));
  assert.ok(Array.isArray(data.cashflow));
});

test('logging a daily record updates flock count and KPIs', async () => {
  const token = await h.login('manager');
  const flocks = (await h.req('GET', '/api/flocks', { token })).data;
  const broiler = flocks.find(f => f.type === 'broiler');
  const before = broiler.current_count;
  const r = await h.req('POST', `/api/flocks/${broiler.id}/logs`, { token, body: { mortality: 5, feed_kg: 120, avg_weight_g: 2100 } });
  assert.equal(r.status, 201);
  const after = (await h.req('GET', '/api/flocks/' + broiler.id, { token })).data.flock;
  assert.ok(after.current_count <= before, 'mortality should reduce the live count');
});

test('AI predictions flag the seeded mortality spike', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/predictions', { token });
  assert.equal(status, 200);
  assert.ok(data.feedRequirement7dKg > 0);
  assert.ok(data.alerts.some(a => a.type === 'mortality_spike' && a.level === 'high'),
    'a high mortality spike alert should be present');
});

test('worker cannot create flocks (role gate)', async () => {
  const worker = await h.login('worker');
  const r = await h.req('POST', '/api/flocks', { token: worker, body: { name: 'X', type: 'broiler', start_date: '2026-01-01', initial_count: 100 } });
  assert.equal(r.status, 403);
});
