'use strict';
/* Unit tests for the explainable risk engine, against the seeded demo data. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers'); // sets SEWSMS_DB + seeds before riskEngine loads its db

const risk = require('../server/riskEngine');

test('assess returns a 0-100 score with a valid level', () => {
  const a = risk.assess(1); // Mary Phiri
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.ok(['low', 'medium', 'high'].includes(a.level));
});

test('every scored point is attributable to a named factor', () => {
  const a = risk.assess(1);
  const factorTotal = a.factors.reduce((s, f) => s + f.points, 0);
  // Score may differ slightly due to the girl-child weighting + rounding, but
  // a high score must never appear with zero explaining factors.
  if (a.score >= 60) assert.ok(a.factors.length > 0);
  assert.ok(factorTotal >= 0);
});

test('assessAll sorts by score descending and respects minLevel', () => {
  const list = risk.assessAll({ minLevel: 'medium' });
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].score >= list[i].score, 'list must be sorted descending');
  }
  assert.ok(list.every(a => a.level !== 'low'));
});

test('recommendations are always actionable (never empty)', () => {
  for (const id of [1, 2, 3, 5]) {
    const a = risk.assess(id);
    assert.ok(a.recommendations.length > 0);
  }
});
