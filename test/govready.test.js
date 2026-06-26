'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

/* ------------------------------------------------ guardian consent ------- */

test('messages to a non-consented guardian are blocked, not sent', async () => {
  const teacher = await h.login('teacher');
  // Student 8 (Esther Ngoma) is seeded with consent pending.
  const r = await h.req('POST', '/api/attendance', { token: teacher, body: { student_id: 8, status: 'present' } });
  assert.equal(r.status, 201);
  assert.ok(r.data.notifications.length >= 1);
  assert.equal(r.data.notifications[0].delivery_status, 'blocked');
});

test('granting consent allows messages to flow', async () => {
  const teacher = await h.login('teacher');
  const consent = await h.req('PUT', '/api/students/8/consent', {
    token: teacher, body: { status: 'granted', method: 'verbal' }
  });
  assert.equal(consent.status, 200);
  assert.equal(consent.data.consent_status, 'granted');
  assert.ok(consent.data.consent_date);

  const r = await h.req('POST', '/api/attendance', { token: teacher, body: { student_id: 8, status: 'absent' } });
  assert.equal(r.data.notifications[0].delivery_status, 'sent');
});

test('consent requires a valid status and respects scope', async () => {
  const teacher = await h.login('teacher');
  const bad = await h.req('PUT', '/api/students/1/consent', { token: teacher, body: { status: 'maybe' } });
  assert.equal(bad.status, 400);
  // Student 12 is in another school → 403.
  const outOfScope = await h.req('PUT', '/api/students/12/consent', { token: teacher, body: { status: 'granted' } });
  assert.equal(outOfScope.status, 403);
});

/* ------------------------------------------------ QR / biometric check-in - */

test('QR check-in code is issued and check-in marks attendance present', async () => {
  const teacher = await h.login('teacher');
  const code = await h.req('GET', '/api/students/1/checkin-code', { token: teacher });
  assert.equal(code.status, 200);
  assert.ok(code.data.token);
  assert.ok(code.data.svg.startsWith('<svg'), 'should return a QR SVG');

  const checkin = await h.req('POST', '/api/attendance/checkin', {
    token: teacher, body: { token: code.data.payload }
  });
  assert.equal(checkin.status, 201);
  assert.equal(checkin.data.status, 'present');
  assert.equal(checkin.data.student_id, 1);
});

test('check-in with an unknown code returns 404', async () => {
  const teacher = await h.login('teacher');
  const r = await h.req('POST', '/api/attendance/checkin', { token: teacher, body: { token: 'SAFEGIRL:nope' } });
  assert.equal(r.status, 404);
});

test('QR check-in is gated to the Platinum (biometric) tier', async () => {
  const admin = await h.login('admin');
  await h.req('POST', '/api/users', {
    token: admin, body: { full_name: 'Silver T', username: 'silvert2', password: 'Passw0rd', role: 'teacher', school_id: 3 }
  });
  const silver = await h.login('silvert2', 'Passw0rd');
  // School 3 is silver → biometric (platinum) blocked with 402.
  const code = await h.req('GET', '/api/students/12/checkin-code', { token: silver });
  assert.equal(code.status, 402);
  assert.equal(code.data.requiredTier, 'platinum');
});
