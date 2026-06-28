'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

// ── Customers ───────────────────────────────────────────────────────────────

test('customer list returns all seeded customers with code and name', async () => {
  const token = await h.login('cashier1');
  const { status, data } = await h.req('GET', '/api/customers', { token });
  assert.equal(status, 200);
  assert.ok(data.length >= 15, 'should have at least 15 seeded customers');
  assert.ok(data.every(c => c.customer_code && c.full_name));
});

test('cashier can create a new customer and retrieve their profile', async () => {
  const token = await h.login('cashier1');

  const created = await h.req('POST', '/api/customers', {
    token,
    body: { full_name: 'Test Customer', phone: '+260 900 000 001', email: 'test@example.com', city: 'Lusaka' }
  });
  assert.equal(created.status, 201);
  assert.ok(created.data.customer_code.startsWith('CUST'), 'code must have CUST prefix');
  assert.equal(created.data.full_name, 'Test Customer');

  const { data } = await h.req('GET', `/api/customers/${created.data.id}`, { token });
  assert.equal(data.id, created.data.id);
  assert.ok('stats' in data, 'customer detail must include lifetime stats');
  assert.ok('sales' in data, 'customer detail must include purchase history');
});

test('customer search filters by name and phone', async () => {
  const token = await h.login('cashier1');

  const { data } = await h.req('GET', '/api/customers?q=Mwansa', { token });
  assert.ok(Array.isArray(data));
  assert.ok(data.every(c => c.full_name.includes('Mwansa') || c.phone.includes('Mwansa') || c.customer_code.includes('Mwansa')));
});

test('creating a customer without full_name returns 400', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/customers', {
    token, body: { phone: '+260 999 999 999' }
  });
  assert.equal(status, 400);
});

// ── Sales ───────────────────────────────────────────────────────────────────

test('sale creation deducts inventory and returns a receipt', async () => {
  const token = await h.login('cashier1');
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv.find(p => p.quantity > 5);
  assert.ok(product, 'there must be at least one product with stock > 5 after seeding');

  const before = product.quantity;
  const { status, data } = await h.req('POST', '/api/sales', {
    token,
    body: {
      items: [{ product_id: product.product_id, quantity: 2 }],
      payment_method: 'cash',
      amount_paid: 9999
    }
  });
  assert.equal(status, 201);
  assert.ok(data.receipt_no.startsWith('RCP-'), 'receipt number must have RCP- prefix');
  assert.ok(data.total_amount > 0, 'total must be positive');
  assert.equal(data.items.length, 1);
  assert.ok(data.change_amount >= 0, 'change must be non-negative');

  // Inventory must be reduced by the quantity sold
  const { data: invAfter } = await h.req('GET', '/api/inventory', { token });
  const after = invAfter.find(p => p.product_id === product.product_id);
  assert.equal(after.quantity, before - 2);
});

test('sale fails with 400 when stock is insufficient', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/sales', {
    token,
    body: {
      items: [{ product_id: 1, quantity: 999999 }],
      payment_method: 'cash',
      amount_paid: 0
    }
  });
  assert.equal(status, 400);
});

test('sale requires items and payment_method', async () => {
  const token = await h.login('cashier1');

  const noItems = await h.req('POST', '/api/sales', {
    token, body: { payment_method: 'cash', amount_paid: 100 }
  });
  assert.equal(noItems.status, 400);

  const noMethod = await h.req('POST', '/api/sales', {
    token, body: { items: [{ product_id: 1, quantity: 1 }], amount_paid: 100 }
  });
  assert.equal(noMethod.status, 400);
});

test('manager can void a completed sale and stock is restored', async () => {
  const cashier = await h.login('cashier1');
  const manager = await h.login('manager');

  const { data: inv } = await h.req('GET', '/api/inventory', { token: cashier });
  const product = inv.find(p => p.quantity > 2);
  assert.ok(product, 'need a product with stock > 2 for this test');

  const { data: sale } = await h.req('POST', '/api/sales', {
    token: cashier,
    body: {
      items: [{ product_id: product.product_id, quantity: 1 }],
      payment_method: 'mobile_money',
      amount_paid: 9999
    }
  });

  const stockAfterSale = (await h.req('GET', '/api/inventory', { token: cashier })).data
    .find(p => p.product_id === product.product_id).quantity;

  const voided = await h.req('POST', `/api/sales/${sale.id}/void`, { token: manager });
  assert.equal(voided.status, 200);
  assert.ok(voided.data.ok);

  // Stock must be restored
  const stockAfterVoid = (await h.req('GET', '/api/inventory', { token: cashier })).data
    .find(p => p.product_id === product.product_id).quantity;
  assert.equal(stockAfterVoid, stockAfterSale + 1);
});

test('cashier cannot void a sale (RBAC)', async () => {
  const token = await h.login('cashier1');
  const { status } = await h.req('POST', '/api/sales/1/void', { token });
  assert.equal(status, 403);
});

test('sale list is filterable and paginated', async () => {
  const token = await h.login('manager');
  const { status, data } = await h.req('GET', '/api/sales?limit=5&offset=0', { token });
  assert.equal(status, 200);
  assert.ok('rows' in data && 'total' in data);
  assert.ok(data.rows.length <= 5, 'limit=5 must return at most 5 rows');
  assert.ok(data.total >= 0);
});

test('sale detail includes items list', async () => {
  const token = await h.login('manager');
  const { data: list } = await h.req('GET', '/api/sales?limit=1', { token });
  if (list.rows.length === 0) return; // no completed sales yet in this test run

  const { status, data } = await h.req('GET', `/api/sales/${list.rows[0].id}`, { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.items), 'sale detail must include items array');
});
