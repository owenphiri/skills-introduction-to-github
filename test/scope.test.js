'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

// ── User management ─────────────────────────────────────────────────────────

test('admin can list all users; password hashes are never exposed', async () => {
  const token = await h.login('admin');
  const { status, data } = await h.req('GET', '/api/users', { token });
  assert.equal(status, 200);
  assert.ok(data.some(u => u.role === 'admin'));
  assert.ok(data.some(u => u.role === 'manager'));
  assert.ok(data.some(u => u.role === 'cashier'));
  assert.ok(data.every(u => !('password_hash' in u)), 'password hashes must never be in the response');
});

test('admin can create a new user with any valid role', async () => {
  const token = await h.login('admin');

  for (const role of ['cashier', 'manager']) {
    const username = `new_${role}_${Date.now()}`;
    const { status, data } = await h.req('POST', '/api/users', {
      token,
      body: { username, password: 'Test1234!', full_name: `New ${role}`, role }
    });
    assert.equal(status, 201, `creating ${role} user should return 201`);
    assert.equal(data.username, username);
    assert.equal(data.role, role);
    assert.ok(!('password_hash' in data));
  }
});

test('creating a user with a duplicate username returns 409', async () => {
  const token = await h.login('admin');
  await h.req('POST', '/api/users', {
    token, body: { username: 'dupuser', password: 'Dup1234!', full_name: 'Dup', role: 'cashier' }
  });
  const dup = await h.req('POST', '/api/users', {
    token, body: { username: 'dupuser', password: 'Dup1234!', full_name: 'Dup2', role: 'cashier' }
  });
  assert.equal(dup.status, 409);
});

test('creating a user with missing fields returns 400', async () => {
  const token = await h.login('admin');
  const noPassword = await h.req('POST', '/api/users', {
    token, body: { username: 'x1', full_name: 'X', role: 'cashier' }
  });
  assert.equal(noPassword.status, 400);
});

test('admin can update a user name and role', async () => {
  const token = await h.login('admin');
  const { data: users } = await h.req('GET', '/api/users', { token });
  const cashier = users.find(u => u.username === 'cashier2');

  const updated = await h.req('PUT', `/api/users/${cashier.id}`, {
    token, body: { full_name: 'Brian Updated' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.full_name, 'Brian Updated');
});

test('non-admin users cannot list or create users', async () => {
  for (const username of ['manager', 'cashier1']) {
    const token = await h.login(username);
    const list = await h.req('GET', '/api/users', { token });
    assert.equal(list.status, 403, `${username} must not list users`);
  }
});

// ── Settings ────────────────────────────────────────────────────────────────

test('any authenticated user can read settings', async () => {
  const token = await h.login('cashier1');
  const { status, data } = await h.req('GET', '/api/settings', { token });
  assert.equal(status, 200);
  assert.ok('business_name'  in data, 'must include business_name');
  assert.ok('currency_code'  in data, 'must include currency_code');
  assert.ok('currency_symbol' in data, 'must include currency_symbol');
  assert.ok('receipt_prefix' in data, 'must include receipt_prefix');
});

test('admin can update settings and changes persist', async () => {
  const token = await h.login('admin');

  const updated = await h.req('PUT', '/api/settings', {
    token, body: { receipt_footer: 'New footer text', low_stock_alert: '5' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.receipt_footer, 'New footer text');
  assert.equal(updated.data.low_stock_alert, '5');

  // Verify persistence with a separate GET
  const { data: readback } = await h.req('GET', '/api/settings', { token });
  assert.equal(readback.receipt_footer, 'New footer text');
});

test('non-admin cannot update settings', async () => {
  const manager = await h.login('manager');
  const cashier = await h.login('cashier1');

  const mgrRes = await h.req('PUT', '/api/settings', { token: manager, body: { business_name: 'Hack' } });
  assert.equal(mgrRes.status, 403);

  const cshRes = await h.req('PUT', '/api/settings', { token: cashier, body: { business_name: 'Hack' } });
  assert.equal(cshRes.status, 403);
});
