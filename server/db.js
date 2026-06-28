'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.db), { recursive: true });

const db = new DatabaseSync(config.db);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      full_name     TEXT    NOT NULL,
      role          TEXT    NOT NULL CHECK(role IN ('admin','manager','cashier')),
      email         TEXT,
      phone         TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT    PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      color       TEXT    NOT NULL DEFAULT '#3B82F6',
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      contact_name TEXT,
      email        TEXT,
      phone        TEXT,
      address      TEXT,
      city         TEXT,
      active       INTEGER NOT NULL DEFAULT 1,
      notes        TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sku           TEXT    NOT NULL UNIQUE,
      barcode       TEXT    UNIQUE,
      name          TEXT    NOT NULL,
      description   TEXT,
      category_id   INTEGER REFERENCES categories(id),
      supplier_id   INTEGER REFERENCES suppliers(id),
      unit          TEXT    NOT NULL DEFAULT 'each',
      cost_price    REAL    NOT NULL DEFAULT 0,
      selling_price REAL    NOT NULL DEFAULT 0,
      tax_rate      REAL    NOT NULL DEFAULT 16,
      reorder_level INTEGER NOT NULL DEFAULT 10,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_barcode  ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_name     ON products(name);

    CREATE TABLE IF NOT EXISTS inventory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE REFERENCES products(id),
      quantity   INTEGER NOT NULL DEFAULT 0,
      location   TEXT,
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL REFERENCES products(id),
      movement_type   TEXT    NOT NULL
                        CHECK(movement_type IN ('sale','purchase','adjustment','return','damage','initial')),
      quantity_change INTEGER NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_after  INTEGER NOT NULL,
      reference_id    INTEGER,
      reference_type  TEXT,
      notes           TEXT,
      user_id         INTEGER REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_date    ON stock_movements(created_at);

    CREATE TABLE IF NOT EXISTS customers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code  TEXT    NOT NULL UNIQUE,
      full_name      TEXT    NOT NULL,
      phone          TEXT,
      email          TEXT,
      address        TEXT,
      city           TEXT,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      credit_limit   REAL    NOT NULL DEFAULT 0,
      notes          TEXT,
      active         INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      last_purchase  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);

    CREATE TABLE IF NOT EXISTS sales (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no      TEXT    NOT NULL UNIQUE,
      customer_id     INTEGER REFERENCES customers(id),
      user_id         INTEGER NOT NULL REFERENCES users(id),
      sale_date       TEXT    NOT NULL DEFAULT (datetime('now')),
      subtotal        REAL    NOT NULL DEFAULT 0,
      tax_amount      REAL    NOT NULL DEFAULT 0,
      discount_amount REAL    NOT NULL DEFAULT 0,
      total_amount    REAL    NOT NULL DEFAULT 0,
      cost_total      REAL    NOT NULL DEFAULT 0,
      payment_method  TEXT    NOT NULL
                        CHECK(payment_method IN ('cash','card','mobile_money','credit')),
      amount_paid     REAL    NOT NULL DEFAULT 0,
      change_amount   REAL    NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'completed'
                        CHECK(status IN ('completed','voided','refunded')),
      notes           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_user     ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_status   ON sales(status);

    CREATE TABLE IF NOT EXISTS sale_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id          INTEGER NOT NULL REFERENCES sales(id),
      product_id       INTEGER NOT NULL REFERENCES products(id),
      quantity         INTEGER NOT NULL,
      unit_price       REAL    NOT NULL,
      cost_price       REAL    NOT NULL,
      discount_percent REAL    NOT NULL DEFAULT 0,
      tax_rate         REAL    NOT NULL DEFAULT 0,
      line_total       REAL    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number     TEXT    NOT NULL UNIQUE,
      supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
      user_id       INTEGER NOT NULL REFERENCES users(id),
      status        TEXT    NOT NULL DEFAULT 'draft'
                      CHECK(status IN ('draft','sent','received','cancelled')),
      order_date    TEXT    NOT NULL DEFAULT (datetime('now')),
      expected_date TEXT,
      received_date TEXT,
      total_amount  REAL    NOT NULL DEFAULT 0,
      notes         TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS po_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id             INTEGER NOT NULL REFERENCES purchase_orders(id),
      product_id        INTEGER NOT NULL REFERENCES products(id),
      quantity_ordered  INTEGER NOT NULL,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      unit_cost         REAL    NOT NULL,
      line_total        REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

migrate();

module.exports = db;
