'use strict';

/**
 * Girl Child Vulnerability Score — the predictive early-warning engine.
 *
 * Design principle: EXPLAINABILITY. Child-protection decisions must be
 * defensible to teachers, parents, District Education Officers and auditors,
 * so this is a transparent weighted model (every point of the score is traced
 * to a named factor) rather than an opaque ML black box. The weighting can be
 * re-trained from outcome data later, but the contributing factors stay legible.
 *
 * Score is 0–100 (higher = more vulnerable). Factors:
 *   - Attendance rate (last 30 days)
 *   - Consecutive absences
 *   - Monday/Friday absence pattern (a known early-warning signal)
 *   - Academic decline (recent vs earlier average)
 *   - Open counseling / welfare cases
 *   - Registered vulnerability status (orphan, low income, disability, …)
 *   - Gender (girls are the protected cohort of the KGS programme)
 */
const db = require('./db');
const config = require('./config');

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function attendanceStats(studentId) {
  const since = daysAgoISO(30);
  const rows = db.prepare(
    'SELECT date, status FROM attendance WHERE student_id = ? AND date >= ? ORDER BY date'
  ).all(studentId, since);

  if (rows.length === 0) return { rate: 1, total: 0, absences: 0, weekendPattern: 0 };

  const absences = rows.filter(r => r.status === 'absent').length;
  const present = rows.filter(r => r.status === 'present').length;
  const rate = (present + 0.5 * rows.filter(r => r.status === 'late').length) / rows.length;

  // Monday(1)/Friday(5) absence pattern.
  let edgeAbs = 0;
  let edgeTotal = 0;
  for (const r of rows) {
    const dow = new Date(r.date + 'T00:00:00').getDay();
    if (dow === 1 || dow === 5) {
      edgeTotal++;
      if (r.status === 'absent') edgeAbs++;
    }
  }
  const weekendPattern = edgeTotal >= 3 ? edgeAbs / edgeTotal : 0;

  return { rate, total: rows.length, absences, weekendPattern };
}

function consecutiveAbsences(studentId) {
  const rows = db.prepare(
    'SELECT status FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT 14'
  ).all(studentId);
  let streak = 0;
  for (const r of rows) {
    if (r.status === 'absent') streak++;
    else break;
  }
  return streak;
}

function academicDecline(studentId) {
  // Compare the most recent term average against the prior average.
  const rows = db.prepare(`
    SELECT term, AVG(score) AS avg
    FROM performance WHERE student_id = ?
    GROUP BY term ORDER BY term DESC LIMIT 2
  `).all(studentId);
  if (rows.length < 2) return { decline: 0, recent: rows[0]?.avg ?? null };
  const drop = rows[1].avg - rows[0].avg; // positive = scores fell
  return { decline: Math.max(0, drop), recent: rows[0].avg };
}

function openCases(studentId) {
  return db.prepare(
    "SELECT COUNT(*) AS n FROM counseling WHERE student_id = ? AND status IN ('open','in_progress','escalated')"
  ).get(studentId).n;
}

/**
 * Compute the full vulnerability assessment for one student.
 * @returns {{score:number, level:string, factors:Array, recommendations:Array}}
 */
function assess(studentId) {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) throw new Error('Student not found');

  const att = attendanceStats(studentId);
  const streak = consecutiveAbsences(studentId);
  const acad = academicDecline(studentId);
  const cases = openCases(studentId);

  const factors = [];
  const add = (label, points, detail) => {
    if (points > 0) factors.push({ label, points: Math.round(points), detail });
  };

  // 1. Attendance rate — up to 30 points.
  if (att.total > 0) {
    add('Low attendance', (1 - att.rate) * 30,
      `${Math.round(att.rate * 100)}% attendance over last 30 recorded days`);
  }

  // 2. Consecutive absences — up to 20 points.
  if (streak >= config.risk.consecutiveAbsenceFlag) {
    add('Consecutive absences', Math.min(20, streak * 5),
      `${streak} consecutive days absent`);
  }

  // 3. Monday/Friday pattern — up to 12 points.
  add('Monday/Friday absence pattern', att.weekendPattern * 12,
    att.weekendPattern > 0 ? `${Math.round(att.weekendPattern * 100)}% of Mon/Fri days absent` : '');

  // 4. Academic decline — up to 15 points.
  add('Academic decline', Math.min(15, acad.decline * 0.6),
    acad.decline > 0 ? `Average fell by ${Math.round(acad.decline)}%` : '');

  // 5. Open welfare/counseling cases — up to 15 points.
  add('Open welfare cases', Math.min(15, cases * 7.5),
    cases > 0 ? `${cases} open case(s)` : '');

  // 6. Registered vulnerability status — up to 8 points.
  if (student.vulnerability_status && student.vulnerability_status !== 'none') {
    add('Vulnerability status', 8, student.vulnerability_status);
  }

  let score = factors.reduce((s, f) => s + f.points, 0);

  // Girls are the protected cohort; a small weighting keeps the early-warning
  // focus on the KGS target group without ignoring boys entirely.
  if (student.gender === 'F') score = Math.min(100, score * 1.1);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let level = 'low';
  if (score >= config.risk.highScore) level = 'high';
  else if (score >= config.risk.mediumScore) level = 'medium';

  return {
    studentId,
    score,
    level,
    factors,
    recommendations: recommend(level, factors, student),
    metrics: {
      attendanceRate: Math.round(att.rate * 100),
      consecutiveAbsences: streak,
      recentAverage: acad.recent != null ? Math.round(acad.recent) : null,
      openCases: cases
    }
  };
}

/** Map a risk level + factors to concrete, actionable interventions. */
function recommend(level, factors, student) {
  const recs = [];
  const has = label => factors.some(f => f.label === label);

  if (level === 'high') {
    recs.push('Immediate guidance & counseling referral (within 48 hours)');
    recs.push('Schedule a home visit to engage parents/guardians');
  } else if (level === 'medium') {
    recs.push('Book a counseling check-in this week');
  }

  if (has('Consecutive absences') || has('Low attendance')) {
    recs.push('Send attendance follow-up SMS to parent and confirm reason');
  }
  if (has('Monday/Friday absence pattern')) {
    recs.push('Investigate recurring Mon/Fri absence (market days, chores, distance)');
  }
  if (has('Academic decline')) {
    recs.push('Arrange remedial/peer-tutoring support');
  }
  if (student.gender === 'F' && level !== 'low') {
    recs.push('Reinforce Keeping Girls in School (KGS) support — confirm bursary/eligibility');
  }
  if (recs.length === 0) recs.push('No action needed — continue routine monitoring');
  return recs;
}

/** Convenience: assess every active student and return a sorted at-risk list. */
function assessAll({ minLevel = 'medium' } = {}) {
  const order = { low: 0, medium: 1, high: 2 };
  const students = db.prepare('SELECT id FROM students WHERE active = 1').all();
  return students
    .map(s => {
      const a = assess(s.id);
      const student = db.prepare('SELECT full_name, grade, gender, village FROM students WHERE id = ?').get(s.id);
      return { ...a, student };
    })
    .filter(a => order[a.level] >= order[minLevel])
    .sort((a, b) => b.score - a.score);
}

module.exports = { assess, assessAll };
