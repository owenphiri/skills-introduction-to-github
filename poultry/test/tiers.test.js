'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const db = require('../server/db');
const auth = require('../server/auth');

before(h.start);
after(h.stop);

/**
 * Create a farm on a given tier with one owner user, returning a login token.
 * Done directly via the DB (there is no public farm-signup endpoint in the MVP).
 */
function makeFarmUser(tier, username) {
  const farmId = db.prepare("INSERT INTO farms (name, location, package) VALUES (?, 'Test', ?)").run(tier + ' Farm', tier).lastInsertRowid;
  db.prepare('INSERT INTO users (full_name, username, password_hash, role, farm_id) VALUES (?, ?, ?, ?, ?)')
    .run(tier + ' Owner', username, auth.hashPassword('password'), 'owner', farmId);
  return farmId;
}

test('bronze farm is gated out of silver/gold/platinum features (402)', async () => {
  makeFarmUser('bronze', 'bronzeowner');
  const token = await h.login('bronzeowner');

  // Vaccination (silver) → 402
  const vax = await h.req('GET', '/api/vaccinations', { token });
  assert.equal(vax.status, 402);
  assert.equal(vax.data.requiredTier, 'silver');

  // Financial dashboard (silver) → 402
  assert.equal((await h.req('GET', '/api/dashboard/financial', { token })).status, 402);
  // Executive (gold) → 402
  assert.equal((await h.req('GET', '/api/dashboard/executive', { token })).status, 402);
  // AI predictions (platinum) → 402
  assert.equal((await h.req('GET', '/api/predictions', { token })).status, 402);

  // Feed tracking (bronze) → allowed
  assert.equal((await h.req('GET', '/api/feed', { token })).status, 200);
});

test('bronze farm cannot create a layer flock (layer module is silver)', async () => {
  const token = await h.login('bronzeowner');
  const r = await h.req('POST', '/api/flocks', { token, body: { name: 'L', type: 'layer', start_date: '2026-01-01', initial_count: 100 } });
  assert.equal(r.status, 402);
  assert.equal(r.data.requiredTier, 'silver');
});

test('gold farm unlocks executive but not platinum AI', async () => {
  makeFarmUser('gold', 'goldowner');
  const token = await h.login('goldowner');
  assert.equal((await h.req('GET', '/api/dashboard/executive', { token })).status, 200);
  assert.equal((await h.req('GET', '/api/predictions', { token })).status, 402);
});
