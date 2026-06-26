'use strict';

/**
 * Package-tier feature gating — the commercial model.
 *
 * Each school has a package (bronze < silver < gold < platinum). A feature is
 * available to a school's staff only if the school's tier is high enough. This
 * maps directly to the revenue model in the README.
 *
 * Platform operators (admin) and government oversight (district officers) are
 * never gated — gating governs what a fee-paying SCHOOL has unlocked, not what
 * the Ministry/operator can see.
 */
const db = require('./db');

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

// Feature → minimum tier that includes it.
const FEATURES = {
  attendance:         'bronze',
  sms_alerts:         'bronze',
  parent_portal:      'bronze',
  academic_reports:   'silver',
  analytics:          'silver',
  ai_risk:            'gold',
  mobile_app:         'gold',
  counseling:         'gold',
  biometric:          'platinum',
  gis:                'platinum',
  district_dashboard: 'platinum'
};

function tierRank(tier) {
  const i = TIERS.indexOf(tier);
  return i === -1 ? 0 : i;
}

function tierIncludes(pkg, feature) {
  const min = FEATURES[feature];
  if (!min) return true; // unknown features are ungated
  return tierRank(pkg) >= tierRank(min);
}

function schoolPackage(schoolId) {
  if (!schoolId) return 'bronze';
  const row = db.prepare('SELECT package FROM schools WHERE id = ?').get(schoolId);
  return row ? row.package : 'bronze';
}

/** All feature keys enabled for a user (everything for admin/district). */
function featuresForUser(user) {
  if (!user) return [];
  if (user.role === 'admin' || user.role === 'district') return Object.keys(FEATURES);
  const pkg = schoolPackage(user.school_id);
  return Object.keys(FEATURES).filter(f => tierIncludes(pkg, f));
}

/**
 * Express middleware: require the caller's school to include `feature`.
 * Responds 402 Payment Required with upgrade details when the tier is too low.
 */
function requireFeature(feature) {
  return (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'district')) return next();
    const pkg = schoolPackage(req.user?.school_id);
    if (!tierIncludes(pkg, feature)) {
      return res.status(402).json({
        error: `The "${feature}" feature requires the ${FEATURES[feature]} package. Your school is on the ${pkg} package.`,
        feature, requiredTier: FEATURES[feature], currentTier: pkg
      });
    }
    next();
  };
}

module.exports = { TIERS, FEATURES, tierIncludes, schoolPackage, featuresForUser, requireFeature };
