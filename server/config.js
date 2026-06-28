'use strict';
const path = require('path');

module.exports = {
  port:         parseInt(process.env.PORT || '3000', 10),
  host:         process.env.HOST || '0.0.0.0',
  db:           process.env.POS_DB || path.join(__dirname, '../data/pos.db'),
  env:          process.env.NODE_ENV || 'development',
  sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || String(8 * 60 * 60 * 1000), 10),

  business: {
    name:          process.env.BUSINESS_NAME    || 'HardWare Plus',
    address:       process.env.BUSINESS_ADDRESS || '23 Cairo Road, Lusaka, Zambia',
    phone:         process.env.BUSINESS_PHONE   || '+260 211 234 567',
    email:         process.env.BUSINESS_EMAIL   || 'sales@hardwareplus.co.zm',
    tagline:       process.env.BUSINESS_TAGLINE || 'Your Complete Hardware Solution',
    tin:           process.env.TIN_NUMBER       || 'TIN-0000000000',
    vatNumber:     process.env.VAT_NUMBER       || 'VAT-000000000',
    receiptFooter: process.env.RECEIPT_FOOTER   || 'Thank you for your business!',
  },

  tax: {
    vat:     parseFloat(process.env.VAT_RATE || '16'),
    vatName: process.env.VAT_NAME || 'VAT',
  },

  currency: {
    code:   process.env.CURRENCY        || 'ZMW',
    symbol: process.env.CURRENCY_SYMBOL || 'K',
  },

  pos: {
    receiptPrefix:  process.env.RECEIPT_PREFIX || 'RCP',
    poPrefix:       process.env.PO_PREFIX      || 'PO',
    customerPrefix: process.env.CUST_PREFIX    || 'CUST',
  },
};
