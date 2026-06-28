'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

test('inventory list shows all active products with quantities and stock values', async () => {
  const token = await h.login('cashier1');
  const { status, data } = await h.req('GET', '/api/inventory', { token });
  assert.equal(status, 200);
  assert.ok(data.length >= 54, 'all 54 seeded products must appear in inventory');
  assert.ok(data.every(i => i.product_id && 'quantity' in i), 'each row needs product_id and quantity');
  assert.ok(data.every(i => 'stock_value' in i), 'each row must include stock_value calculation');
});

test('manager can adjust inventory upward and the movement is recorded', async () => {
  const token = await h.login('manager');
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv[0];
  const before = product.quantity;

  const { status, data } = await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: product.product_id, adjustment: 25, notes: 'Restock from warehouse' }
  });
  assert.equal(status, 200);
  assert.equal(data.quantity_before, before);
  assert.equal(data.quantity_after, before + 25);
});

test('negative inventory adjustment reduces stock', async () => {
  const token = await h.login('manager');
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv.find(p => p.quantity >= 10);
  assert.ok(product, 'need a product with at least 10 units');

  const before = product.quantity;
  const { data } = await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: product.product_id, adjustment: -5, notes: 'Damaged goods write-off' }
  });
  assert.equal(data.quantity_before, before);
  assert.equal(data.quantity_after, before - 5);
});

test('inventory cannot go below zero via adjustment (server clamps to 0)', async () => {
  const token = await h.login('manager');
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv[0];

  const { status, data } = await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: product.product_id, adjustment: -999999, notes: 'Extreme negative' }
  });
  assert.equal(status, 200);
  assert.ok(data.quantity_after >= 0, 'quantity_after must never be negative');
  assert.equal(data.quantity_after, 0);
});

test('stock movements are recorded and retrievable per product', async () => {
  const token = await h.login('manager');
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv[0];

  await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: product.product_id, adjustment: 10, notes: 'Audit movement test' }
  });

  const { status, data } = await h.req(
    'GET', `/api/inventory/movements?product_id=${product.product_id}`, { token }
  );
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  const movement = data.find(m => m.notes === 'Audit movement test');
  assert.ok(movement, 'the adjustment should appear in the movements log');
  assert.equal(movement.movement_type, 'adjustment');
  assert.equal(movement.quantity_change, 10);
});

test('adjustment without product_id or adjustment value returns 400', async () => {
  const token = await h.login('manager');

  const noPid = await h.req('POST', '/api/inventory/adjust', {
    token, body: { adjustment: 10 }
  });
  assert.equal(noPid.status, 400);

  const noAdj = await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: 1 }
  });
  assert.equal(noAdj.status, 400);
});

test('low-stock filter returns only products at or below their reorder level', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/products?low_stock=1', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(
    data.every(p => p.stock_qty <= p.reorder_level),
    'every returned product must be at or below its reorder level'
  );
});

test('cashier cannot adjust inventory (RBAC)', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/inventory/adjust', {
    token, body: { product_id: 1, adjustment: 100 }
  });
  assert.equal(status, 403);
});
