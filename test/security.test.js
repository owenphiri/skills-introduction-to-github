'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('responses include mandatory security headers', async () => {
  // Headers are set even on unauthenticated requests
  const res = await fetch(h.url('/api/products'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok(res.headers.get('referrer-policy'), 'Referrer-Policy header must be present');
});

test('cashier cannot create, update, or delete products', async () => {
  const token = await h.login('cashier1');

  const create = await h.req('POST', '/api/products', {
    token, body: { sku: 'RBAC001', name: 'Cashier Attempt' }
  });
  assert.equal(create.status, 403);

  const update = await h.req('PUT', '/api/products/1', {
    token, body: { name: 'Changed' }
  });
  assert.equal(update.status, 403);

  const del = await h.req('DELETE', '/api/products/1', { token });
  assert.equal(del.status, 403);
});

test('cashier cannot manage users', async () => {
  const token = await h.login('cashier1');

  const list = await h.req('GET', '/api/users', { token });
  assert.equal(list.status, 403);

  const create = await h.req('POST', '/api/users', {
    token, body: { username: 'hack', password: 'Hack123!', full_name: 'Hacker', role: 'admin' }
  });
  assert.equal(create.status, 403);
});

test('cashier cannot access purchase orders', async () => {
  const token = await h.login('cashier1');
  const list   = await h.req('GET', '/api/purchase-orders', { token });
  assert.equal(list.status, 403);

  const create = await h.req('POST', '/api/purchase-orders', {
    token, body: { supplier_id: 1, items: [] }
  });
  assert.equal(create.status, 403);
});

test('cashier cannot adjust inventory', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: 1, adjustment: 100 }
  });
  assert.equal(status, 403);
});

test('cashier cannot void sales', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/sales/1/void', { token });
  assert.equal(status, 403);
});

test('manager cannot access admin-only user management', async () => {
  const token = await h.login('manager');
  const list = await h.req('GET', '/api/users', { token });
  assert.equal(list.status, 403);
});

test('manager cannot update settings (admin-only)', async () => {
  const token = await h.login('manager');
  const { status } = await h.req('PUT', '/api/settings', {
    token, body: { business_name: 'Hacked Name' }
  });
  assert.equal(status, 403);
});

test('admin has full access to all management endpoints', async () => {
  const token = await h.login('admin');

  const users = await h.req('GET', '/api/users', { token });
  assert.equal(users.status, 200);

  const settings = await h.req('PUT', '/api/settings', {
    token, body: { receipt_footer: 'Admin test' }
  });
  assert.equal(settings.status, 200);
});

test('bearer token with wrong format is rejected', async () => {
  const res = await fetch(h.url('/api/auth/me'), {
    headers: { Authorization: 'Basic wrongformat' }
  });
  assert.equal(res.status, 401);
});
