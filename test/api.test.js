'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('login succeeds with valid credentials and fails otherwise', async () => {
  const ok = await h.req('POST', '/api/auth/login', { body: { username: 'admin', password: 'password' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);
  assert.equal(ok.data.user.role, 'admin');

  const bad = await h.req('POST', '/api/auth/login', { body: { username: 'admin', password: 'wrong' } });
  assert.equal(bad.status, 401);
});

test('unauthenticated requests are rejected', async () => {
  const { status } = await h.req('GET', '/api/students');
  assert.equal(status, 401);
});

test('RBAC: teacher cannot create users, admin can', async () => {
  const teacher = await h.login('teacher');
  const denied = await h.req('POST', '/api/users', {
    token: teacher, body: { full_name: 'X', username: 'x1', password: 'p', role: 'teacher' }
  });
  assert.equal(denied.status, 403);

  const admin = await h.login('admin');
  const allowed = await h.req('POST', '/api/users', {
    token: admin, body: { full_name: 'New Teacher', username: 'newteacher', password: 'Passw0rd', role: 'teacher' }
  });
  assert.equal(allowed.status, 201);
});

test('risk engine flags the deteriorating learner as high risk', async () => {
  const token = await h.login('counselor');
  const { status, data } = await h.req('GET', '/api/risk?minLevel=high', { token });
  assert.equal(status, 200);
  const mary = data.find(r => r.student.full_name === 'Mary Phiri');
  assert.ok(mary, 'Mary Phiri should be in the high-risk list');
  assert.equal(mary.level, 'high');
  assert.ok(mary.score >= 60);
  assert.ok(mary.factors.length > 0, 'high-risk score must be explained by factors');
  assert.ok(mary.recommendations.length > 0);
});

test('marking attendance notifies the parent and re-assesses risk', async () => {
  const token = await h.login('teacher');
  const { status, data } = await h.req('POST', '/api/attendance', {
    token, body: { student_id: 2, status: 'absent', language: 'nya' }
  });
  assert.equal(status, 201);
  assert.equal(data.notifications.length >= 1, true);
  assert.match(data.notifications[0].body, /Mwana wanu/); // Nyanja template rendered
  assert.ok(['low', 'medium', 'high'].includes(data.risk.level));
});

test('registering a student persists and is retrievable', async () => {
  const token = await h.login('teacher');
  const created = await h.req('POST', '/api/students', {
    token, body: { full_name: 'Test Learner', grade: '8A', gender: 'F', parent_phone: '0999000000' }
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const fetched = await h.req('GET', '/api/students/' + id, { token });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.data.student.full_name, 'Test Learner');
  assert.ok(fetched.data.risk, 'profile should include a risk assessment');
});

test('analytics summary returns coherent totals', async () => {
  const token = await h.login('district');
  const { status, data } = await h.req('GET', '/api/analytics/summary', { token });
  assert.equal(status, 200);
  assert.ok(data.totalStudents >= 8);
  assert.ok(data.girls <= data.totalStudents);
  assert.equal(data.risk.high + data.risk.medium + data.risk.low, data.totalStudents);
});

test('awareness broadcast queues messages to guardians', async () => {
  const token = await h.login('district');
  const { status, data } = await h.req('POST', '/api/messages/broadcast', {
    token, body: { body: 'Keep girls in school.', language: 'en' }
  });
  assert.equal(status, 200);
  assert.ok(data.sent >= 1);
});
