'use strict';

/**
 * Data-scoping rules for the multi-school / district hierarchy.
 *
 * A national deployment holds many schools across many districts. Each user
 * may only see data within their scope — this is both a usability and a
 * safeguarding/data-protection requirement (a teacher in one school must not be
 * able to read another school's learners).
 *
 *   admin      → all schools (null = unrestricted)
 *   district   → every school in their assigned district
 *   teacher    → their own school only
 *   counselor  → their own school only
 *   parent     → handled separately via guardian links (no school scope here)
 *   community  → no learner-level access
 */
const db = require('./db');

/**
 * @returns {number[]|null} allowed school ids, or null for "all schools".
 *   An empty array means the user has no school-scoped learner access.
 */
function allowedSchoolIds(user) {
  if (!user) return [];
  switch (user.role) {
    case 'admin':
      return null;
    case 'district': {
      if (!user.district) return [];
      return db.prepare('SELECT id FROM schools WHERE district = ?')
        .all(user.district).map(r => r.id);
    }
    case 'teacher':
    case 'counselor':
      return user.school_id ? [user.school_id] : [];
    default:
      return [];
  }
}

/**
 * Build a SQL fragment + params restricting `<column>` to the user's scope.
 * Returns { clause, params } where clause is '' (unrestricted) or
 * 'AND col IN (?,?)' / 'AND 1=0' (no access).
 */
function schoolClause(user, column = 'school_id') {
  const ids = allowedSchoolIds(user);
  if (ids === null) return { clause: '', params: [] };
  if (ids.length === 0) return { clause: ' AND 1=0', params: [] };
  return { clause: ` AND ${column} IN (${ids.map(() => '?').join(',')})`, params: ids };
}

module.exports = { allowedSchoolIds, schoolClause };
