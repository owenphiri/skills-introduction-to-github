'use strict';

/**
 * Package-tier feature gating — the PrimeAxis commercial model.
 * Tiers and prices (ZMW) come straight from the product pricing sheet.
 */
const db = require('./db');

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

const PRICES = { bronze: 3500, silver: 7500, gold: 15000, platinum: 30000 };

const PACKAGES = {
  bronze:   { price: 3500,  label: 'Bronze',   tagline: 'Small farmers',     users: 1 },
  silver:   { price: 7500,  label: 'Silver',   tagline: 'Growing farms',     users: 3 },
  gold:     { price: 15000, label: 'Gold',     tagline: 'Commercial farms',  users: 10 },
  platinum: { price: 30000, label: 'Platinum', tagline: 'Enterprise / multi-farm', users: Infinity }
};

// Feature → minimum tier (mirrors the pricing sheet).
const FEATURES = {
  bird_records:        'bronze',
  feed_tracking:       'bronze',
  sales:               'bronze',
  basic_reports:       'bronze',
  layer_module:        'silver',     // both modules unlocked at silver
  financial_reports:   'silver',
  expense_tracking:    'silver',
  vaccination:         'silver',
  mortality_monitoring:'silver',
  advanced_analytics:  'gold',
  cash_flow:           'gold',
  profit_forecast:     'gold',
  employees:           'gold',
  executive_dashboard: 'gold',
  multi_farm:          'platinum',
  ai_predictions:      'platinum',
  api_access:          'platinum'
};

const rank = t => Math.max(0, TIERS.indexOf(t));
const tierIncludes = (pkg, feature) => !FEATURES[feature] || rank(pkg) >= rank(FEATURES[feature]);

function farmPackage(farmId) {
  if (!farmId) return 'bronze';
  const row = db.prepare('SELECT package FROM farms WHERE id = ?').get(farmId);
  return row ? row.package : 'bronze';
}

function featuresForUser(user) {
  const pkg = farmPackage(user?.farm_id);
  return Object.keys(FEATURES).filter(f => tierIncludes(pkg, f));
}

function requireFeature(feature) {
  return (req, res, next) => {
    const pkg = farmPackage(req.user?.farm_id);
    if (!tierIncludes(pkg, feature)) {
      return res.status(402).json({
        error: `The "${feature}" feature requires the ${FEATURES[feature]} package. Your farm is on the ${pkg} package.`,
        feature, requiredTier: FEATURES[feature], currentTier: pkg
      });
    }
    next();
  };
}

module.exports = { TIERS, PRICES, PACKAGES, FEATURES, tierIncludes, farmPackage, featuresForUser, requireFeature };
