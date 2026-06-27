'use strict';

/**
 * HardWare Plus — Point of Sale System
 * Complete REST API covering auth, products, inventory, customers, sales,
 * purchase orders, reports & settings. Serves the dashboard from /public.
 */
const path    = require('path');
const crypto  = require('crypto');
const http    = require('http');
const express = require('express');
const db      = require('./db');
const config  = require('./config');
const { hashPassword, verifyPassword, createSession, destroySession, authenticate, requireRole } = require('./auth');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Security headers
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options':        'DENY',
    'Referrer-Policy':        'no-referrer',
  });
  next();
});

// ─────────────────────────── AUTH ─────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = createSession(user.id);
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  const settings = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
  );
  res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone },
    settings,
  });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const settings = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
  );
  res.json({ user: req.user, settings });
});

// ─────────────────────────── CATEGORIES ──────────────────────────────────────

app.get('/api/categories', authenticate, (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE active=1 ORDER BY name').all());
});

app.post('/api/categories', authenticate, requireRole('admin','manager'), (req, res) => {
  const { name, description = '', color = '#3B82F6' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    db.prepare('INSERT INTO categories (name,description,color) VALUES (?,?,?)').run(name, description, color);
    const id = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
  } catch { res.status(409).json({ error: 'Category name already exists' }); }
});

app.put('/api/categories/:id', authenticate, requireRole('admin','manager'), (req, res) => {
  const { name, description, color } = req.body;
  db.prepare('UPDATE categories SET name=COALESCE(?,name), description=COALESCE(?,description), color=COALESCE(?,color) WHERE id=?')
    .run(name, description, color, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id));
});

app.delete('/api/categories/:id', authenticate, requireRole('admin'), (req, res) => {
  db.prepare('UPDATE categories SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────── SUPPLIERS ───────────────────────────────────────

app.get('/api/suppliers', authenticate, (_req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers WHERE active=1 ORDER BY name').all());
});

app.post('/api/suppliers', authenticate, requireRole('admin','manager'), (req, res) => {
  const { name, contact_name='', email='', phone='', address='', city='', notes='' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('INSERT INTO suppliers (name,contact_name,email,phone,address,city,notes) VALUES (?,?,?,?,?,?,?)')
    .run(name, contact_name, email, phone, address, city, notes);
  const id = db.prepare('SELECT last_insert_rowid() AS id').get().id;
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(id));
});

app.put('/api/suppliers/:id', authenticate, requireRole('admin','manager'), (req, res) => {
  const { name, contact_name, email, phone, address, city, notes } = req.body;
  db.prepare(`UPDATE suppliers SET
    name=COALESCE(?,name), contact_name=COALESCE(?,contact_name), email=COALESCE(?,email),
    phone=COALESCE(?,phone), address=COALESCE(?,address), city=COALESCE(?,city), notes=COALESCE(?,notes)
    WHERE id=?`).run(name, contact_name, email, phone, address, city, notes, req.params.id);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id));
});

// ─────────────────────────── PRODUCTS ────────────────────────────────────────

app.get('/api/products', authenticate, (req, res) => {
  const { q, category_id, low_stock, active = '1' } = req.query;
  let sql = `
    SELECT p.*, c.name AS category_name, s.name AS supplier_name,
           COALESCE(i.quantity,0) AS stock_qty
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suppliers  s ON s.id = p.supplier_id
    LEFT JOIN inventory  i ON i.product_id = p.id
    WHERE p.active = ?
  `;
  const params = [active === '0' ? 0 : 1];
  if (q) { sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
  if (low_stock === '1') { sql += ' AND COALESCE(i.quantity,0) <= p.reorder_level'; }
  sql += ' ORDER BY p.name';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/products/:id', authenticate, (req, res) => {
  const row = db.prepare(`
    SELECT p.*, c.name AS category_name, s.name AS supplier_name,
           COALESCE(i.quantity,0) AS stock_qty
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suppliers  s ON s.id = p.supplier_id
    LEFT JOIN inventory  i ON i.product_id = p.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/products', authenticate, requireRole('admin','manager'), (req, res) => {
  const { sku, barcode='', name, description='', category_id=null, supplier_id=null,
          unit='each', cost_price=0, selling_price=0, tax_rate=16, reorder_level=10 } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'sku and name required' });
  try {
    db.prepare(`INSERT INTO products (sku,barcode,name,description,category_id,supplier_id,unit,cost_price,selling_price,tax_rate,reorder_level)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(sku,barcode||null,name,description,category_id,supplier_id,unit,cost_price,selling_price,tax_rate,reorder_level);
    const id = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    db.prepare('INSERT INTO inventory (product_id,quantity) VALUES (?,0)').run(id);
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id=?').get(id));
  } catch (e) {
    res.status(409).json({ error: e.message.includes('UNIQUE') ? 'SKU or barcode already exists' : e.message });
  }
});

app.put('/api/products/:id', authenticate, requireRole('admin','manager'), (req, res) => {
  const { sku, barcode, name, description, category_id, supplier_id, unit, cost_price, selling_price, tax_rate, reorder_level } = req.body;
  db.prepare(`UPDATE products SET
    sku=COALESCE(?,sku), barcode=COALESCE(?,barcode), name=COALESCE(?,name),
    description=COALESCE(?,description), category_id=COALESCE(?,category_id),
    supplier_id=COALESCE(?,supplier_id), unit=COALESCE(?,unit),
    cost_price=COALESCE(?,cost_price), selling_price=COALESCE(?,selling_price),
    tax_rate=COALESCE(?,tax_rate), reorder_level=COALESCE(?,reorder_level),
    updated_at=datetime('now') WHERE id=?`).run(sku,barcode,name,description,category_id,supplier_id,
    unit,cost_price,selling_price,tax_rate,reorder_level,req.params.id);
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id));
});

app.delete('/api/products/:id', authenticate, requireRole('admin'), (req, res) => {
  db.prepare("UPDATE products SET active=0, updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────── INVENTORY ───────────────────────────────────────

app.get('/api/inventory', authenticate, (_req, res) => {
  res.json(db.prepare(`
    SELECT p.id AS product_id, p.sku, p.name, p.reorder_level,
           c.name AS category, COALESCE(i.quantity,0) AS quantity,
           i.location, i.updated_at,
           p.cost_price, p.selling_price,
           COALESCE(i.quantity,0) * p.cost_price AS stock_value
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN inventory  i ON i.product_id = p.id
    WHERE p.active=1 ORDER BY p.name
  `).all());
});

app.post('/api/inventory/adjust', authenticate, requireRole('admin','manager'), (req, res) => {
  const { product_id, adjustment, notes = '' } = req.body;
  if (!product_id || adjustment === undefined) return res.status(400).json({ error: 'product_id and adjustment required' });
  const inv = db.prepare('SELECT quantity FROM inventory WHERE product_id=?').get(product_id);
  if (!inv) return res.status(404).json({ error: 'Product not in inventory' });
  const before = inv.quantity;
  const after  = Math.max(0, before + parseInt(adjustment, 10));
  db.prepare("UPDATE inventory SET quantity=?, updated_at=datetime('now') WHERE product_id=?").run(after, product_id);
  db.prepare(`INSERT INTO stock_movements (product_id,movement_type,quantity_change,quantity_before,quantity_after,notes,user_id)
    VALUES (?,?,?,?,?,?,?)`).run(product_id,'adjustment',after-before,before,after,notes,req.user.id);
  res.json({ product_id, quantity_before: before, quantity_after: after });
});

app.get('/api/inventory/movements', authenticate, (req, res) => {
  const { product_id, limit = 50 } = req.query;
  let sql = `
    SELECT sm.*, p.name AS product_name, p.sku, u.full_name AS user_name
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    LEFT JOIN users u ON u.id = sm.user_id
  `;
  const params = [];
  if (product_id) { sql += ' WHERE sm.product_id = ?'; params.push(product_id); }
  sql += ` ORDER BY sm.created_at DESC LIMIT ?`;
  params.push(parseInt(limit,10));
  res.json(db.prepare(sql).all(...params));
});

// ─────────────────────────── CUSTOMERS ───────────────────────────────────────

app.get('/api/customers', authenticate, (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM customers WHERE active=1';
  const params = [];
  if (q) { sql += ' AND (full_name LIKE ? OR phone LIKE ? OR customer_code LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY full_name';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/customers/:id', authenticate, (req, res) => {
  const cust = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!cust) return res.status(404).json({ error: 'Not found' });
  const sales = db.prepare(`
    SELECT s.*, COUNT(si.id) AS item_count FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.customer_id=? AND s.status='completed'
    GROUP BY s.id ORDER BY s.sale_date DESC LIMIT 20
  `).all(req.params.id);
  const stats = db.prepare(`
    SELECT COUNT(*) AS total_orders, SUM(total_amount) AS lifetime_value,
           AVG(total_amount) AS avg_order
    FROM sales WHERE customer_id=? AND status='completed'
  `).get(req.params.id);
  res.json({ ...cust, sales, stats });
});

app.post('/api/customers', authenticate, (req, res) => {
  const { full_name, phone='', email='', address='', city='', credit_limit=0, notes='' } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name required' });
  const seq  = db.prepare('SELECT COUNT(*)+1 AS n FROM customers').get().n;
  const code = `CUST${String(seq).padStart(4,'0')}`;
  db.prepare(`INSERT INTO customers (customer_code,full_name,phone,email,address,city,credit_limit,notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(code,full_name,phone,email,address,city,credit_limit,notes);
  const id = db.prepare('SELECT last_insert_rowid() AS id').get().id;
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id=?').get(id));
});

app.put('/api/customers/:id', authenticate, (req, res) => {
  const { full_name, phone, email, address, city, credit_limit, notes } = req.body;
  db.prepare(`UPDATE customers SET
    full_name=COALESCE(?,full_name), phone=COALESCE(?,phone), email=COALESCE(?,email),
    address=COALESCE(?,address), city=COALESCE(?,city),
    credit_limit=COALESCE(?,credit_limit), notes=COALESCE(?,notes)
    WHERE id=?`).run(full_name,phone,email,address,city,credit_limit,notes,req.params.id);
  res.json(db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id));
});

// ─────────────────────────── SALES ───────────────────────────────────────────

app.get('/api/sales', authenticate, (req, res) => {
  const { from, to, customer_id, user_id, status = 'completed', limit = 100, offset = 0 } = req.query;
  let sql = `
    SELECT s.*, c.full_name AS customer_name, u.full_name AS cashier_name,
           COUNT(si.id) AS item_count
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.status = ?
  `;
  const params = [status];
  if (from) { sql += ' AND DATE(s.sale_date) >= ?'; params.push(from); }
  if (to)   { sql += ' AND DATE(s.sale_date) <= ?'; params.push(to); }
  if (customer_id) { sql += ' AND s.customer_id = ?'; params.push(customer_id); }
  if (user_id)     { sql += ' AND s.user_id = ?';     params.push(user_id); }
  sql += ` GROUP BY s.id ORDER BY s.sale_date DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit,10), parseInt(offset,10));
  const rows = db.prepare(sql).all(...params);
  const total = db.prepare(
    `SELECT COUNT(DISTINCT s.id) AS n FROM sales s WHERE s.status=?${from?' AND DATE(s.sale_date)>=?':''}${to?' AND DATE(s.sale_date)<=?':''}`
  ).get(...params.slice(0, params.length - 2)).n;
  res.json({ rows, total });
});

app.get('/api/sales/:id', authenticate, (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, c.full_name AS customer_name, c.phone AS customer_phone,
           u.full_name AS cashier_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`
    SELECT si.*, p.name AS product_name, p.sku
    FROM sale_items si JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
  `).all(req.params.id);
  res.json({ ...sale, items });
});

app.post('/api/sales', authenticate, (req, res) => {
  const { customer_id = null, items, payment_method, amount_paid, discount_amount = 0, notes = '' } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'items required' });
  if (!payment_method) return res.status(400).json({ error: 'payment_method required' });

  // Verify stock & calculate totals
  let subtotal = 0, costTotal = 0;
  const enriched = [];
  for (const it of items) {
    const prod = db.prepare('SELECT p.*,COALESCE(i.quantity,0) AS stock FROM products p LEFT JOIN inventory i ON i.product_id=p.id WHERE p.id=?').get(it.product_id);
    if (!prod) return res.status(400).json({ error: `Product ${it.product_id} not found` });
    if (prod.stock < it.quantity) return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });
    const lineTotal = parseFloat(((it.unit_price || prod.selling_price) * it.quantity * (1 - (it.discount_percent||0)/100)).toFixed(2));
    subtotal  += lineTotal;
    costTotal += prod.cost_price * it.quantity;
    enriched.push({ ...it, unit_price: it.unit_price || prod.selling_price, cost_price: prod.cost_price, tax_rate: prod.tax_rate, line_total: lineTotal });
  }
  subtotal   = parseFloat(subtotal.toFixed(2));
  costTotal  = parseFloat(costTotal.toFixed(2));
  const taxAmount    = parseFloat((subtotal * (config.tax.vat / 100)).toFixed(2));
  const discountAmt  = parseFloat((discount_amount || 0).toFixed(2));
  const totalAmount  = parseFloat((subtotal + taxAmount - discountAmt).toFixed(2));
  const amountPaidN  = parseFloat((amount_paid || totalAmount).toFixed(2));
  const changeAmount = parseFloat(Math.max(0, amountPaidN - totalAmount).toFixed(2));

  const seq = db.prepare("SELECT COUNT(*)+1 AS n FROM sales").get().n;
  const receiptNo = `RCP-${String(seq).padStart(5,'0')}`;

  db.prepare(`INSERT INTO sales (receipt_no,customer_id,user_id,subtotal,tax_amount,discount_amount,total_amount,cost_total,payment_method,amount_paid,change_amount,status,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'completed',?)`).run(
    receiptNo, customer_id, req.user.id, subtotal, taxAmount, discountAmt, totalAmount, costTotal,
    payment_method, amountPaidN, changeAmount, notes
  );
  const saleId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const insertItem = db.prepare(`INSERT INTO sale_items (sale_id,product_id,quantity,unit_price,cost_price,discount_percent,tax_rate,line_total)
    VALUES (?,?,?,?,?,?,?,?)`);
  enriched.forEach(it => {
    insertItem.run(saleId, it.product_id, it.quantity, it.unit_price, it.cost_price, it.discount_percent||0, it.tax_rate, it.line_total);
    const inv = db.prepare('SELECT quantity FROM inventory WHERE product_id=?').get(it.product_id);
    const before = inv ? inv.quantity : 0;
    const after  = Math.max(0, before - it.quantity);
    db.prepare("UPDATE inventory SET quantity=?, updated_at=datetime('now') WHERE product_id=?").run(after, it.product_id);
    db.prepare(`INSERT INTO stock_movements (product_id,movement_type,quantity_change,quantity_before,quantity_after,reference_id,reference_type,user_id)
      VALUES (?,?,?,?,?,?,?,?)`).run(it.product_id,'sale',-it.quantity,before,after,saleId,'sale',req.user.id);
  });

  if (customer_id) {
    db.prepare("UPDATE customers SET last_purchase=datetime('now'), loyalty_points=loyalty_points+? WHERE id=?")
      .run(Math.floor(totalAmount/10), customer_id);
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(saleId);
  const saleItems = db.prepare('SELECT si.*,p.name AS product_name,p.sku FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.sale_id=?').all(saleId);
  let customer = null;
  if (customer_id) customer = db.prepare('SELECT * FROM customers WHERE id=?').get(customer_id);
  const settings = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value]));
  res.status(201).json({ ...sale, items: saleItems, customer, cashier_name: req.user.full_name, settings });
});

app.post('/api/sales/:id/void', authenticate, requireRole('admin','manager'), (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id=?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Not found' });
  if (sale.status !== 'completed') return res.status(400).json({ error: 'Only completed sales can be voided' });
  db.prepare("UPDATE sales SET status='voided' WHERE id=?").run(sale.id);
  // Reverse stock
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(sale.id);
  items.forEach(it => {
    const inv = db.prepare('SELECT quantity FROM inventory WHERE product_id=?').get(it.product_id);
    const before = inv ? inv.quantity : 0;
    const after  = before + it.quantity;
    db.prepare("UPDATE inventory SET quantity=?, updated_at=datetime('now') WHERE product_id=?").run(after, it.product_id);
    db.prepare(`INSERT INTO stock_movements (product_id,movement_type,quantity_change,quantity_before,quantity_after,reference_id,reference_type,user_id,notes)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(it.product_id,'return',it.quantity,before,after,sale.id,'void',req.user.id,'Sale voided');
  });
  res.json({ ok: true });
});

// ─────────────────────────── PURCHASE ORDERS ─────────────────────────────────

app.get('/api/purchase-orders', authenticate, requireRole('admin','manager'), (req, res) => {
  res.json(db.prepare(`
    SELECT po.*, s.name AS supplier_name, u.full_name AS created_by_name
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    JOIN users u ON u.id = po.user_id
    ORDER BY po.created_at DESC LIMIT 100
  `).all());
});

app.post('/api/purchase-orders', authenticate, requireRole('admin','manager'), (req, res) => {
  const { supplier_id, items, expected_date='', notes='' } = req.body;
  if (!supplier_id || !items?.length) return res.status(400).json({ error: 'supplier_id and items required' });
  let total = 0;
  items.forEach(it => { total += it.quantity_ordered * it.unit_cost; });
  const seq    = db.prepare('SELECT COUNT(*)+1 AS n FROM purchase_orders').get().n;
  const poNum  = `PO-${String(seq).padStart(5,'0')}`;
  db.prepare(`INSERT INTO purchase_orders (po_number,supplier_id,user_id,expected_date,total_amount,notes) VALUES (?,?,?,?,?,?)`)
    .run(poNum, supplier_id, req.user.id, expected_date, total, notes);
  const poId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
  const insertPOItem = db.prepare('INSERT INTO po_items (po_id,product_id,quantity_ordered,unit_cost,line_total) VALUES (?,?,?,?,?)');
  items.forEach(it => insertPOItem.run(poId, it.product_id, it.quantity_ordered, it.unit_cost, it.quantity_ordered*it.unit_cost));
  res.status(201).json(db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(poId));
});

app.post('/api/purchase-orders/:id/receive', authenticate, requireRole('admin','manager'), (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare('SELECT * FROM po_items WHERE po_id=?').all(po.id);
  items.forEach(it => {
    const qty   = it.quantity_ordered - it.quantity_received;
    if (qty <= 0) return;
    const inv   = db.prepare('SELECT quantity FROM inventory WHERE product_id=?').get(it.product_id);
    const before = inv ? inv.quantity : 0;
    const after  = before + qty;
    db.prepare("UPDATE inventory SET quantity=?, updated_at=datetime('now') WHERE product_id=?").run(after, it.product_id);
    db.prepare(`INSERT INTO stock_movements (product_id,movement_type,quantity_change,quantity_before,quantity_after,reference_id,reference_type,user_id)
      VALUES (?,?,?,?,?,?,?,?)`).run(it.product_id,'purchase',qty,before,after,po.id,'po',req.user.id);
    db.prepare('UPDATE po_items SET quantity_received=quantity_ordered WHERE id=?').run(it.id);
  });
  db.prepare("UPDATE purchase_orders SET status='received', received_date=datetime('now') WHERE id=?").run(po.id);
  res.json({ ok: true });
});

// ─────────────────────────── REPORTS / DASHBOARD ─────────────────────────────

app.get('/api/reports/dashboard', authenticate, (_req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now()-86_400_000).toISOString().slice(0,10);
  const monthStart = today.slice(0,7) + '-01';

  const todayStats = db.prepare(`
    SELECT COUNT(*) AS transactions, COALESCE(SUM(total_amount),0) AS revenue,
           COALESCE(SUM(total_amount-cost_total),0) AS profit
    FROM sales WHERE DATE(sale_date)=? AND status='completed'`).get(today);

  const yestStats = db.prepare(`
    SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS transactions
    FROM sales WHERE DATE(sale_date)=? AND status='completed'`).get(yesterday);

  const monthStats = db.prepare(`
    SELECT COALESCE(SUM(total_amount),0) AS revenue,
           COALESCE(SUM(total_amount-cost_total),0) AS profit,
           COUNT(*) AS transactions
    FROM sales WHERE DATE(sale_date) >= ? AND status='completed'`).get(monthStart);

  const lowStock = db.prepare(`
    SELECT COUNT(*) AS n FROM products p LEFT JOIN inventory i ON i.product_id=p.id
    WHERE p.active=1 AND COALESCE(i.quantity,0) <= p.reorder_level`).get().n;

  const outOfStock = db.prepare(`
    SELECT COUNT(*) AS n FROM products p LEFT JOIN inventory i ON i.product_id=p.id
    WHERE p.active=1 AND COALESCE(i.quantity,0) = 0`).get().n;

  const totalCustomers = db.prepare('SELECT COUNT(*) AS n FROM customers WHERE active=1').get().n;
  const totalProducts  = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active=1').get().n;

  const inventoryValue = db.prepare(`
    SELECT COALESCE(SUM(i.quantity*p.cost_price),0) AS value
    FROM inventory i JOIN products p ON p.id=i.product_id WHERE p.active=1`).get().value;

  // Revenue trend last 30 days
  const trend = db.prepare(`
    SELECT DATE(sale_date) AS date, SUM(total_amount) AS revenue, COUNT(*) AS transactions
    FROM sales WHERE DATE(sale_date) >= date('now','-29 days') AND status='completed'
    GROUP BY DATE(sale_date) ORDER BY date`).all();

  // Category sales this month
  const catSales = db.prepare(`
    SELECT c.name AS category, c.color, SUM(si.line_total) AS revenue
    FROM sale_items si
    JOIN products p ON p.id=si.product_id
    JOIN categories c ON c.id=p.category_id
    JOIN sales s ON s.id=si.sale_id
    WHERE DATE(s.sale_date) >= ? AND s.status='completed'
    GROUP BY c.id ORDER BY revenue DESC`).all(monthStart);

  // Top products last 30 days
  const topProducts = db.prepare(`
    SELECT p.name, p.sku, SUM(si.quantity) AS units_sold, SUM(si.line_total) AS revenue
    FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id
    WHERE DATE(s.sale_date) >= date('now','-29 days') AND s.status='completed'
    GROUP BY p.id ORDER BY revenue DESC LIMIT 10`).all();

  // Hourly distribution today
  const hourly = db.prepare(`
    SELECT strftime('%H',sale_date) AS hour, COUNT(*) AS count, SUM(total_amount) AS revenue
    FROM sales WHERE DATE(sale_date)=? AND status='completed'
    GROUP BY hour ORDER BY hour`).all(today);

  // Payment methods this month
  const payMethods = db.prepare(`
    SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS total
    FROM sales WHERE DATE(sale_date) >= ? AND status='completed'
    GROUP BY payment_method`).all(monthStart);

  // Recent 10 sales
  const recentSales = db.prepare(`
    SELECT s.id, s.receipt_no, s.sale_date, s.total_amount, s.payment_method, s.status,
           c.full_name AS customer_name, u.full_name AS cashier_name
    FROM sales s
    LEFT JOIN customers c ON c.id=s.customer_id
    LEFT JOIN users u ON u.id=s.user_id
    ORDER BY s.sale_date DESC LIMIT 10`).all();

  // Low stock products
  const lowStockItems = db.prepare(`
    SELECT p.id, p.sku, p.name, p.reorder_level, COALESCE(i.quantity,0) AS quantity, c.name AS category
    FROM products p
    LEFT JOIN inventory i ON i.product_id=p.id
    LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.active=1 AND COALESCE(i.quantity,0) <= p.reorder_level
    ORDER BY COALESCE(i.quantity,0) ASC LIMIT 10`).all();

  res.json({
    kpis: {
      today: { ...todayStats, avg_order: todayStats.transactions ? todayStats.revenue/todayStats.transactions : 0 },
      yesterday: yestStats,
      month: monthStats,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      total_customers: totalCustomers,
      total_products: totalProducts,
      inventory_value: inventoryValue,
    },
    trend,
    catSales,
    topProducts,
    hourly,
    payMethods,
    recentSales,
    lowStockItems,
  });
});

app.get('/api/reports/monthly', authenticate, (_req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m',sale_date) AS month,
           SUM(total_amount) AS revenue,
           SUM(total_amount-cost_total) AS profit,
           COUNT(*) AS transactions
    FROM sales WHERE status='completed'
    GROUP BY month ORDER BY month DESC LIMIT 13
  `).all().reverse();
  res.json(rows);
});

app.get('/api/reports/sales-summary', authenticate, (req, res) => {
  const { from, to } = req.query;
  const params = [];
  let where = "status='completed'";
  if (from) { where += ' AND DATE(sale_date) >= ?'; params.push(from); }
  if (to)   { where += ' AND DATE(sale_date) <= ?'; params.push(to); }

  const summary = db.prepare(`
    SELECT COUNT(*) AS transactions, SUM(total_amount) AS revenue,
           SUM(cost_total) AS cost, SUM(total_amount-cost_total) AS profit,
           AVG(total_amount) AS avg_order, SUM(discount_amount) AS total_discount,
           SUM(tax_amount) AS total_tax
    FROM sales WHERE ${where}`).get(...params);

  const byDay = db.prepare(`
    SELECT DATE(sale_date) AS date, SUM(total_amount) AS revenue, COUNT(*) AS transactions
    FROM sales WHERE ${where} GROUP BY DATE(sale_date) ORDER BY date`).all(...params);

  const byCategory = db.prepare(`
    SELECT c.name AS category, SUM(si.line_total) AS revenue, SUM(si.quantity) AS units
    FROM sale_items si
    JOIN products p ON p.id=si.product_id
    JOIN categories c ON c.id=p.category_id
    JOIN sales s ON s.id=si.sale_id
    WHERE s.${where} GROUP BY c.id ORDER BY revenue DESC`).all(...params);

  const topProds = db.prepare(`
    SELECT p.name, p.sku, SUM(si.quantity) AS units, SUM(si.line_total) AS revenue
    FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id
    WHERE s.${where} GROUP BY p.id ORDER BY revenue DESC LIMIT 20`).all(...params);

  const byCashier = db.prepare(`
    SELECT u.full_name, COUNT(*) AS transactions, SUM(s.total_amount) AS revenue
    FROM sales s JOIN users u ON u.id=s.user_id
    WHERE s.${where} GROUP BY s.user_id ORDER BY revenue DESC`).all(...params);

  const byPayment = db.prepare(`
    SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS total
    FROM sales WHERE ${where} GROUP BY payment_method`).all(...params);

  res.json({ summary, byDay, byCategory, topProds, byCashier, byPayment });
});

// ─────────────────────────── SETTINGS ────────────────────────────────────────

app.get('/api/settings', authenticate, (_req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r=>[r.key,r.value])));
});

app.put('/api/settings', authenticate, requireRole('admin'), (req, res) => {
  const stmt = db.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at");
  Object.entries(req.body).forEach(([k,v]) => stmt.run(k, String(v)));
  const rows = db.prepare('SELECT key,value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r=>[r.key,r.value])));
});

// ─────────────────────────── USERS (admin) ───────────────────────────────────

app.get('/api/users', authenticate, requireRole('admin'), (_req, res) => {
  res.json(db.prepare('SELECT id,username,full_name,role,email,phone,active,created_at,last_login FROM users ORDER BY full_name').all());
});

app.post('/api/users', authenticate, requireRole('admin'), (req, res) => {
  const { username, password, full_name, role='cashier', email='', phone='' } = req.body;
  if (!username || !password || !full_name) return res.status(400).json({ error: 'username, password and full_name required' });
  try {
    db.prepare('INSERT INTO users (username,password_hash,full_name,role,email,phone) VALUES (?,?,?,?,?,?)')
      .run(username, hashPassword(password), full_name, role, email, phone);
    const id = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    res.status(201).json(db.prepare('SELECT id,username,full_name,role,email,phone,active FROM users WHERE id=?').get(id));
  } catch { res.status(409).json({ error: 'Username already exists' }); }
});

app.put('/api/users/:id', authenticate, requireRole('admin'), (req, res) => {
  const { full_name, role, email, phone, active, password } = req.body;
  if (password) {
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), req.params.id);
  }
  db.prepare(`UPDATE users SET
    full_name=COALESCE(?,full_name), role=COALESCE(?,role), email=COALESCE(?,email),
    phone=COALESCE(?,phone), active=COALESCE(?,active) WHERE id=?`).run(full_name,role,email,phone,active,req.params.id);
  res.json(db.prepare('SELECT id,username,full_name,role,email,phone,active FROM users WHERE id=?').get(req.params.id));
});

// ─────────────────────────── STATIC + START ──────────────────────────────────

app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const server = http.createServer(app);
server.listen(config.port, config.host, () => {
  console.log(`HardWare Plus POS running at http://${config.host}:${config.port}`);
});

module.exports = { app, server };
