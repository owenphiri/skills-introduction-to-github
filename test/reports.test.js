'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('at-risk CSV report downloads with headers and rows', async () => {
  const token = await h.login('district');
  const res = await fetch(h.url('/api/reports/at-risk.csv'), {
    headers: { Authorization: 'Bearer ' + token }
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment/);
  const body = await res.text();
  assert.match(body, /Name,Grade,Sex/);          // header row
  assert.match(body, /Mary Phiri/);              // high-risk learner present
});

test('attendance CSV report aggregates per learner', async () => {
  const token = await h.login('admin');
  const res = await fetch(h.url('/api/reports/attendance.csv?days=30'), {
    headers: { Authorization: 'Bearer ' + token }
  });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Name,Grade,Present,Absent,Late,Total,Rate%/);
});

test('attendance trend returns a dated rate series', async () => {
  const token = await h.login('teacher');
  const { status, data } = await h.req('GET', '/api/analytics/attendance-trend?days=14', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  if (data.length) {
    assert.ok('date' in data[0] && 'rate' in data[0]);
  }
});

test('GIS endpoint returns only geo-located learners', async () => {
  const token = await h.login('counselor');
  const { status, data } = await h.req('GET', '/api/analytics/gis', { token });
  assert.equal(status, 200);
  assert.ok(data.every(p => typeof p.gps_lat === 'number' && typeof p.gps_lng === 'number'));
  assert.ok(data.every(p => p.level && typeof p.score === 'number'));
});

test('teacher cannot pull the at-risk CSV (RBAC)', async () => {
  const token = await h.login('teacher');
  const res = await fetch(h.url('/api/reports/at-risk.csv'), {
    headers: { Authorization: 'Bearer ' + token }
  });
  assert.equal(res.status, 403);
});
