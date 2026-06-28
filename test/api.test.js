'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('login succeeds with valid credentials and returns token + user + settings', async () => {
  const { status, data } = await h.req('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'Admin123!' }
  });
  assert.equal(status, 200);
  assert.ok(data.token, 'response must include a token');
  assert.equal(data.user.username, 'admin');
  assert.equal(data.user.role, 'admin');
  assert.ok(data.settings, 'response must include business settings');
  assert.ok(!('password_hash' in data.user), 'password hash must not be exposed');
});

test('login fails with wrong password (401)', async () => {
  const { status } = await h.req('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'wrongpassword' }
  });
  assert.equal(status, 401);
});

test('login fails for unknown user (401)', async () => {
  const { status } = await h.req('POST', '/api/auth/login', {
    body: { username: 'nobody', password: 'Admin123!' }
  });
  assert.equal(status, 401);
});

test('login with missing fields returns 400', async () => {
  const noPassword = await h.req('POST', '/api/auth/login', { body: { username: 'admin' } });
  assert.equal(noPassword.status, 400);

  const noUsername = await h.req('POST', '/api/auth/login', { body: { password: 'Admin123!' } });
  assert.equal(noUsername.status, 400);
});

test('unauthenticated requests are rejected with 401', async () => {
  for (const path of ['/api/products', '/api/customers', '/api/sales', '/api/inventory']) {
    const { status } = await h.req('GET', path);
    assert.equal(status, 401, `${path} should require auth`);
  }
});

test('/api/auth/me returns current user and settings', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/auth/me', { token });
  assert.equal(status, 200);
  assert.equal(data.user.username, 'manager');
  assert.equal(data.user.role, 'manager');
  assert.ok(data.settings, 'me endpoint must include settings');
});

test('logout invalidates the token', async () => {
  const token = await h.login('cashier1');

  const logout = await h.req('POST', '/api/auth/logout', { token });
  assert.equal(logout.status, 200);

  // The same token should now be rejected
  const me = await h.req('GET', '/api/auth/me', { token });
  assert.equal(me.status, 401);
});

test('all four seeded users can log in with correct roles', async () => {
  const cases = [
    { username: 'admin',    role: 'admin' },
    { username: 'manager',  role: 'manager' },
    { username: 'cashier1', role: 'cashier' },
    { username: 'cashier2', role: 'cashier' },
  ];
  for (const { username, role } of cases) {
    const token = await h.login(username);
    const { data } = await h.req('GET', '/api/auth/me', { token });
    assert.equal(data.user.role, role, `${username} should have role ${role}`);
  }
});
