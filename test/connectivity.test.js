'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.start);
after(h.stop);

// ── Purchase Orders ─────────────────────────────────────────────────────────

test('manager can create a purchase order', async () => {
  const token = await h.login('manager');
  const { data: suppliers } = await h.req('GET', '/api/suppliers', { token });
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv[0];

  const { status, data } = await h.req('POST', '/api/purchase-orders', {
    token,
    body: {
      supplier_id: suppliers[0].id,
      items: [{ product_id: product.product_id, quantity_ordered: 50, unit_cost: product.cost_price }],
      notes: 'Test purchase order'
    }
  });
  assert.equal(status, 201);
  assert.ok(data.po_number.startsWith('PO-'), 'PO number must have PO- prefix');
  assert.ok(data.total_amount > 0, 'PO total must be positive');
});

test('purchase order list is accessible to manager and admin', async () => {
  for (const role of ['manager', 'admin']) {
    const token = await h.login(role);
    const { status, data } = await h.req('GET', '/api/purchase-orders', { token });
    assert.equal(status, 200, `${role} should be able to list purchase orders`);
    assert.ok(Array.isArray(data));
  }
});

test('receiving a purchase order increases inventory by the ordered quantity', async () => {
  const token = await h.login('manager');
  const { data: suppliers } = await h.req('GET', '/api/suppliers', { token });
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv[0];
  const stockBefore = product.quantity;

  const { data: po } = await h.req('POST', '/api/purchase-orders', {
    token,
    body: {
      supplier_id: suppliers[0].id,
      items: [{ product_id: product.product_id, quantity_ordered: 20, unit_cost: 100 }]
    }
  });

  const received = await h.req('POST', `/api/purchase-orders/${po.id}/receive`, { token });
  assert.equal(received.status, 200);
  assert.ok(received.data.ok);

  const { data: invAfter } = await h.req('GET', '/api/inventory', { token });
  const after = invAfter.find(p => p.product_id === product.product_id);
  assert.equal(after.quantity, stockBefore + 20);
});

test('receiving creates stock_movement records of type purchase', async () => {
  const token = await h.login('manager');
  const { data: suppliers } = await h.req('GET', '/api/suppliers', { token });
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv[1]; // use a different product index to avoid cross-test interference

  const { data: po } = await h.req('POST', '/api/purchase-orders', {
    token,
    body: {
      supplier_id: suppliers[0].id,
      items: [{ product_id: product.product_id, quantity_ordered: 15, unit_cost: 50 }]
    }
  });
  await h.req('POST', `/api/purchase-orders/${po.id}/receive`, { token });

  const { data: movements } = await h.req(
    'GET', `/api/inventory/movements?product_id=${product.product_id}`, { token }
  );
  const purchaseMove = movements.find(m => m.movement_type === 'purchase' && m.reference_id === po.id);
  assert.ok(purchaseMove, 'receiving a PO must create a purchase movement');
  assert.equal(purchaseMove.quantity_change, 15);
});

test('cashier cannot access purchase orders', async () => {
  const token = await h.login('cashier1');
  const list = await h.req('GET', '/api/purchase-orders', { token });
  assert.equal(list.status, 403);

  const create = await h.req('POST', '/api/purchase-orders', {
    token, body: { supplier_id: 1, items: [{ product_id: 1, quantity_ordered: 1, unit_cost: 10 }] }
  });
  assert.equal(create.status, 403);
});

test('purchase order creation requires supplier_id and non-empty items', async () => {
  const token = await h.login('manager');

  const noSupplier = await h.req('POST', '/api/purchase-orders', {
    token, body: { items: [{ product_id: 1, quantity_ordered: 1, unit_cost: 10 }] }
  });
  assert.equal(noSupplier.status, 400);

  const noItems = await h.req('POST', '/api/purchase-orders', {
    token, body: { supplier_id: 1, items: [] }
  });
  assert.equal(noItems.status, 400);
});

// ── Multi-payment-method sales ───────────────────────────────────────────────

test('sales with different payment methods all succeed', async () => {
  const token = await h.login('cashier1');
  const { data: inv } = await h.req('GET', '/api/inventory', { token });
  const product = inv.find(p => p.quantity > 10);
  assert.ok(product, 'need a product with at least 10 units for this test');

  for (const method of ['cash', 'card', 'mobile_money']) {
    const { status, data } = await h.req('POST', '/api/sales', {
      token,
      body: {
        items: [{ product_id: product.product_id, quantity: 1 }],
        payment_method: method,
        amount_paid: 9999
      }
    });
    assert.equal(status, 201, `sale with payment_method="${method}" must succeed`);
    assert.equal(data.payment_method, method);
    assert.ok(data.receipt_no.startsWith('RCP-'));
  }
});
