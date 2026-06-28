'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

// ── Categories ──────────────────────────────────────────────────────────────

test('categories list returns all seeded categories', async () => {
  const token = await h.login('cashier1');
  const { status, data } = await h.req('GET', '/api/categories', { token });
  assert.equal(status, 200);
  assert.ok(data.length >= 10, 'should have at least 10 seeded categories');
  assert.ok(data.every(c => c.name && c.color), 'each category needs name and color');
});

test('manager can create and update a category', async () => {
  const token = await h.login('manager');

  const created = await h.req('POST', '/api/categories', {
    token, body: { name: 'Test Category', description: 'Test only', color: '#FF0000' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.name, 'Test Category');
  assert.equal(created.data.color, '#FF0000');

  const updated = await h.req('PUT', `/api/categories/${created.data.id}`, {
    token, body: { name: 'Updated Category' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.name, 'Updated Category');
});

test('cashier cannot create categories (RBAC)', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/categories', {
    token, body: { name: 'Cashier Cat' }
  });
  assert.equal(status, 403);
});

test('admin can soft-delete a category', async () => {
  const token = await h.login('admin');

  const { data: cat } = await h.req('POST', '/api/categories', {
    token, body: { name: 'ToDelete Cat' }
  });
  const del = await h.req('DELETE', `/api/categories/${cat.id}`, { token });
  assert.equal(del.status, 200);

  const { data: list } = await h.req('GET', '/api/categories', { token });
  assert.ok(!list.find(c => c.id === cat.id), 'deleted category must not appear in list');
});

// ── Products ────────────────────────────────────────────────────────────────

test('products list returns all active products with stock info', async () => {
  const token = await h.login('cashier1');
  const { status, data } = await h.req('GET', '/api/products', { token });
  assert.equal(status, 200);
  assert.ok(data.length >= 54, 'should have at least 54 seeded products');
  assert.ok(data.every(p => p.sku && p.name && 'stock_qty' in p));
});

test('product search filters results by name or SKU', async () => {
  const token = await h.login('cashier1');
  const byName = await h.req('GET', '/api/products?q=Drill', { token });
  assert.ok(byName.data.length >= 1, 'should find at least one drill product');

  const bySku = await h.req('GET', '/api/products?q=PT001', { token });
  assert.equal(bySku.data.length, 1);
  assert.equal(bySku.data[0].sku, 'PT001');
});

test('manager can create a product and retrieve it by id', async () => {
  const token = await h.login('manager');
  const { data: cats } = await h.req('GET', '/api/categories', { token });

  const created = await h.req('POST', '/api/products', {
    token,
    body: {
      sku: 'TST001', name: 'Test Widget', category_id: cats[0].id,
      cost_price: 50, selling_price: 75, reorder_level: 5
    }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.sku, 'TST001');
  assert.equal(created.data.selling_price, 75);

  const fetched = await h.req('GET', `/api/products/${created.data.id}`, { token });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.data.name, 'Test Widget');
  assert.equal(fetched.data.category_name, cats[0].name);
});

test('creating a product without SKU or name returns 400', async () => {
  const token = await h.login('manager');
  const noSku  = await h.req('POST', '/api/products', { token, body: { name: 'No SKU' } });
  const noName = await h.req('POST', '/api/products', { token, body: { sku: 'NONAME' } });
  assert.equal(noSku.status, 400);
  assert.equal(noName.status, 400);
});

test('duplicate SKU is rejected with 409', async () => {
  const token = await h.login('manager');
  await h.req('POST', '/api/products', { token, body: { sku: 'DUP001', name: 'First' } });
  const dup = await h.req('POST', '/api/products', { token, body: { sku: 'DUP001', name: 'Second' } });
  assert.equal(dup.status, 409);
});

test('manager can update product details', async () => {
  const token = await h.login('manager');
  const { data: p } = await h.req('POST', '/api/products', {
    token, body: { sku: 'UPD001', name: 'Before Update', selling_price: 100 }
  });
  const updated = await h.req('PUT', `/api/products/${p.id}`, {
    token, body: { name: 'After Update', selling_price: 150 }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.name, 'After Update');
  assert.equal(updated.data.selling_price, 150);
});

test('admin can soft-delete a product and it disappears from active list', async () => {
  const admin   = await h.login('admin');
  const manager = await h.login('manager');

  const { data: p } = await h.req('POST', '/api/products', {
    token: manager, body: { sku: 'DEL001', name: 'To Delete' }
  });
  const del = await h.req('DELETE', `/api/products/${p.id}`, { token: admin });
  assert.equal(del.status, 200);

  const { data: list } = await h.req('GET', '/api/products', { token: manager });
  assert.ok(!list.find(pr => pr.id === p.id), 'deleted product must not appear in active list');
});

// ── Suppliers ───────────────────────────────────────────────────────────────

test('suppliers list is returned for any authenticated user', async () => {
  const token = await h.login('cashier1');
  const { status, data } = await h.req('GET', '/api/suppliers', { token });
  assert.equal(status, 200);
  assert.ok(data.length >= 5, 'should have 5 seeded suppliers');
  assert.ok(data.every(s => s.name));
});

test('manager can create a new supplier', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('POST', '/api/suppliers', {
    token,
    body: { name: 'Test Supplier Ltd', contact_name: 'Jane', email: 'jane@test.com', city: 'Ndola' }
  });
  assert.equal(status, 201);
  assert.equal(data.name, 'Test Supplier Ltd');
  assert.equal(data.city, 'Ndola');
});
