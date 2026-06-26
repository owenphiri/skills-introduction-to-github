'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const security = require('../server/security');

before(h.start);
after(h.stop);

test('responses carry hardening headers', async () => {
  const res = await fetch(h.url('/api/health'));
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok(res.headers.get('content-security-policy'));
});

test('password policy rejects weak passwords', () => {
  assert.ok(security.passwordProblem('short'));        // too short
  assert.ok(security.passwordProblem('onlyletters'));  // no number
  assert.ok(security.passwordProblem('12345678'));     // no letter
  assert.equal(security.passwordProblem('Secure123'), null);
});

test('creating a user with a weak password is rejected (400)', async () => {
  const admin = await h.login('admin');
  const weak = await h.req('POST', '/api/users', {
    token: admin, body: { full_name: 'Weak', username: 'weakuser', password: 'abc', role: 'teacher' }
  });
  assert.equal(weak.status, 400);

  const strong = await h.req('POST', '/api/users', {
    token: admin, body: { full_name: 'Strong', username: 'stronguser', password: 'Strong123', role: 'teacher' }
  });
  assert.equal(strong.status, 201);
});

test('audit log records sensitive actions and is admin-only', async () => {
  const admin = await h.login('admin');
  const { status, data } = await h.req('GET', '/api/audit', { token: admin });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.some(e => e.action === 'login.success'), 'logins should be audited');

  const teacher = await h.login('teacher');
  const denied = await h.req('GET', '/api/audit', { token: teacher });
  assert.equal(denied.status, 403);
});
