'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

/* ---------------------------------------- translation review workflow ---- */

test('pending templates are listed for reviewers, hidden from teachers', async () => {
  const counselor = await h.login('counselor');
  const { status, data } = await h.req('GET', '/api/templates/pending', { token: counselor });
  assert.equal(status, 200);
  assert.ok(data.length > 0, 'there should be pending local-language templates');
  assert.ok(data.every(t => ['pending_review', 'draft'].includes(t.status)));

  const teacher = await h.login('teacher');
  const denied = await h.req('GET', '/api/templates/pending', { token: teacher });
  assert.equal(denied.status, 403);
});

test('an unreviewed language falls back to approved English when sending', async () => {
  const teacher = await h.login('teacher');
  // Bemba (bem) is seeded as pending_review → should fall back to English copy.
  const { data } = await h.req('POST', '/api/attendance', {
    token: teacher, body: { student_id: 3, status: 'absent', language: 'bem' }
  });
  assert.ok(data.notifications.length >= 1);
  assert.match(data.notifications[0].body, /was absent today/); // English fallback
});

test('approving a translation makes it the one that is sent', async () => {
  const counselor = await h.login('counselor');
  const pending = (await h.req('GET', '/api/templates/pending', { token: counselor })).data;
  const tpl = pending.find(t => t.key === 'absent' && t.language === 'bem');
  assert.ok(tpl);

  const approved = await h.req('POST', `/api/templates/${tpl.id}/review`, {
    token: counselor, body: { decision: 'approved' }
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.status, 'approved');

  // Now sending in Bemba should use the approved Bemba copy, not English.
  const teacher = await h.login('teacher');
  const { data } = await h.req('POST', '/api/attendance', {
    token: teacher, body: { student_id: 4, status: 'absent', language: 'bem' }
  });
  assert.match(data.notifications[0].body, /taisile kusukulu/); // Bemba text
});

test('editing a translation sends it back to pending_review', async () => {
  const counselor = await h.login('counselor');
  const pending = (await h.req('GET', '/api/templates/pending', { token: counselor })).data;
  const tpl = pending[0];
  const res = await h.req('PUT', `/api/templates/${tpl.id}`, {
    token: counselor, body: { body: 'SafeGirl: {name} — updated copy.' }
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'pending_review');
});

/* --------------------------------------------------- parent portal ------- */

test('parent sees only their linked children and no risk score', async () => {
  const parent = await h.login('parent');
  const { status, data } = await h.req('GET', '/api/portal/children', { token: parent });
  assert.equal(status, 200);
  assert.equal(data.length, 2); // Mary + Grace seeded to the parent account
  assert.ok(data.every(c => !('score' in c) && !('level' in c)), 'risk must not be exposed to parents');
  assert.ok(data.every(c => 'attendanceRate' in c));
});

test('parent cannot access a child that is not theirs', async () => {
  const parent = await h.login('parent');
  // Student 5 (Bwalya Tembo) is not linked to the parent account.
  const { status } = await h.req('GET', '/api/portal/children/5', { token: parent });
  assert.equal(status, 404);
});

test('parent is blocked from the school-wide analytics summary', async () => {
  const parent = await h.login('parent');
  const { status } = await h.req('GET', '/api/analytics/summary', { token: parent });
  assert.equal(status, 403);
});

/* ----------------------------------------------- academic analytics ------ */

test('academic analytics returns term trends, pass rates and decliners', async () => {
  const token = await h.login('admin');
  const { status, data } = await h.req('GET', '/api/analytics/academic', { token });
  assert.equal(status, 200);
  assert.ok(data.terms.length >= 2);
  assert.equal(data.overall.length, data.terms.length);
  assert.ok(data.overall.every(o => o.passRate >= 0 && o.passRate <= 100));
  assert.ok(data.bySubject.length > 0);
  // Mary Phiri was seeded with a sharp drop → should be the top decliner.
  assert.ok(data.decliners.length > 0);
  assert.equal(data.decliners[0].full_name, 'Mary Phiri');
});
