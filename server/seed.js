'use strict';

/**
 * Seed the database with demonstration data: a school, users for every role,
 * a class of students, several weeks of attendance (including risk patterns),
 * exam scores, counseling cases and the multilingual awareness library.
 *
 * Run:  npm run seed
 * Default login for every seeded user is the password "password" (CHANGE in prod).
 */
const db = require('./db');
const auth = require('./auth');
const { DEFAULTS } = require('./templates');

function reset() {
  for (const t of ['sessions', 'messages', 'counseling', 'performance', 'attendance',
    'students', 'awareness', 'message_templates', 'audit_log', 'users', 'schools']) {
    db.exec(`DELETE FROM ${t};`);
  }
}

function iso(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

reset();

// Three schools across two districts so district-scoping is demonstrable:
// the Chongwe District Officer sees schools A & B, never the Lusaka school C.
const schoolsData = [
  ['Chongwe Secondary School', 'Chongwe', 'Lusaka', 'platinum'],
  ['Kanakantapa Day Secondary', 'Chongwe', 'Lusaka', 'gold'],
  ['Lusaka Girls Secondary',    'Lusaka',  'Lusaka', 'silver']
];
const schoolIds = schoolsData.map(([name, district, province, pkg]) =>
  db.prepare('INSERT INTO schools (name, district, province, package) VALUES (?, ?, ?, ?)')
    .run(name, district, province, pkg).lastInsertRowid);
const schoolId = schoolIds[0]; // primary demo school

const pw = auth.hashPassword('password');
// name, username, role, school_id, district
const users = [
  ['System Administrator', 'admin', 'admin', null, null],
  ['Mrs. Banda', 'teacher', 'teacher', schoolIds[0], null],
  ['Ms. Mwale', 'counselor', 'counselor', schoolIds[0], null],
  ['Mr. Phiri (Parent)', 'parent', 'parent', schoolIds[0], null],
  ['District Officer (Chongwe)', 'district', 'district', null, 'Chongwe'],
  ['Community Leader', 'community', 'community', null, null]
];
for (const [name, username, role, sid, district] of users) {
  db.prepare('INSERT INTO users (full_name, username, password_hash, role, school_id, district) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, username, pw, role, sid, district);
}
const teacher = db.prepare("SELECT id FROM users WHERE username = 'teacher'").get().id;
const counselor = db.prepare("SELECT id FROM users WHERE username = 'counselor'").get().id;
const parentUser = db.prepare("SELECT id FROM users WHERE username = 'parent'").get().id;

// name, gender, grade, vulnerability, phone, village, schoolIdx
const students = [
  ['Mary Phiri', 'F', '9A', 'orphan', '0977000001', 'Chongwe', 0],
  ['Grace Banda', 'F', '9A', 'low_income', '0977000002', 'Kanakantapa', 0],
  ['Chanda Mulenga', 'F', '9A', 'none', '0977000003', 'Chongwe', 0],
  ['Natasha Zulu', 'F', '9A', 'none', '0977000004', 'Rufunsa', 0],
  ['Bwalya Tembo', 'M', '9A', 'none', '0977000005', 'Chongwe', 0],
  ['Lungu Daka', 'M', '9A', 'low_income', '0977000006', 'Kanakantapa', 0],
  ['Mutale Sakala', 'F', '9B', 'disability', '0977000007', 'Chongwe', 0],
  ['Esther Ngoma', 'F', '9B', 'none', '0977000008', 'Rufunsa', 0],
  // School B — Kanakantapa Day Secondary (Chongwe district)
  ['Patricia Mwanza', 'F', '8A', 'low_income', '0977000009', 'Kanakantapa', 1],
  ['John Banda', 'M', '8A', 'none', '0977000010', 'Kanakantapa', 1],
  ['Linda Sakala', 'F', '8A', 'none', '0977000011', 'Kanakantapa', 1],
  // School C — Lusaka Girls Secondary (Lusaka district — outside Chongwe DEO scope)
  ['Rose Daka', 'F', '9A', 'none', '0977000012', 'Lusaka', 2],
  ['Mercy Zulu', 'F', '9A', 'low_income', '0977000013', 'Lusaka', 2]
];
const studentIds = students.map(([full_name, gender, grade, vuln, phone, village, schoolIdx]) =>
  db.prepare(`INSERT INTO students
      (full_name, gender, grade, vulnerability_status, parent_name, parent_phone, village, school_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(full_name, gender, grade, vuln, 'Guardian', phone, village, schoolIds[schoolIdx]).lastInsertRowid);

// Link the demo parent/guardian account to two learners (parent portal).
db.prepare('UPDATE students SET guardian_user_id = ? WHERE id IN (?, ?)')
  .run(parentUser, studentIds[0], studentIds[1]); // Mary Phiri + Grace Banda

// Seed message templates with the review workflow. English + Nyanja are marked
// approved (reviewed); Bemba/Tonga/Lozi start as pending_review to populate the
// native-speaker review queue.
const APPROVED = new Set(['en', 'nya']);
const insTpl = db.prepare(
  "INSERT INTO message_templates (key, language, body, status, reviewer_id, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
);
for (const [key, langs] of Object.entries(DEFAULTS)) {
  for (const [lang, body] of Object.entries(langs)) {
    const approved = APPROVED.has(lang);
    insTpl.run(key, lang, body, approved ? 'approved' : 'pending_review', approved ? counselor : null);
  }
}

// Geo-locate learners around Chongwe district (for GIS mapping). Coordinates
// are scattered near each village so the map shows a realistic spread.
const villageGeo = {
  Chongwe: [-15.329, 28.682],
  Kanakantapa: [-15.281, 28.910],
  Rufunsa: [-15.060, 29.640],
  Lusaka: [-15.416, 28.283]
};
studentIds.forEach((sid, i) => {
  const village = students[i][5];
  const [lat, lng] = villageGeo[village] || villageGeo.Chongwe;
  db.prepare('UPDATE students SET gps_lat = ?, gps_lng = ? WHERE id = ?')
    .run(lat + (Math.random() - 0.5) * 0.05, lng + (Math.random() - 0.5) * 0.05, sid);
});

// Attendance over the last 30 weekdays. Mary (idx 0) has a deteriorating
// pattern; Grace (idx 1) has Monday/Friday absences; the rest mostly attend.
const markAtt = db.prepare(`INSERT INTO attendance (student_id, date, status, marked_by)
  VALUES (?, ?, ?, ?) ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status`);

for (let d = 30; d >= 0; d--) {
  const date = iso(d);
  const dow = new Date(date + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) continue; // skip weekends
  studentIds.forEach((sid, idx) => {
    let status = 'present';
    if (idx === 0) {
      // Mary: increasingly absent, fully absent the last 4 weekdays.
      if (d <= 5) status = 'absent';
      else if (d <= 12 && d % 2 === 0) status = 'absent';
    } else if (idx === 1) {
      // Grace: Monday/Friday absences.
      if (dow === 1 || dow === 5) status = Math.random() < 0.7 ? 'absent' : 'present';
    } else if (idx === 6) {
      if (Math.random() < 0.2) status = 'absent';
    } else {
      if (Math.random() < 0.05) status = 'late';
    }
    markAtt.run(sid, date, status, teacher);
  });
}

// Performance: two terms so the engine can detect decline for Mary.
const subjects = ['Mathematics', 'English', 'Science', 'Social Studies'];
const perf = db.prepare('INSERT INTO performance (student_id, term, subject, score, recorded_by) VALUES (?, ?, ?, ?, ?)');
studentIds.forEach((sid, idx) => {
  subjects.forEach(sub => {
    const base = 55 + Math.round(Math.random() * 30);
    perf.run(sid, '2026-T1', sub, base, teacher);
    // Mary's scores drop sharply in T2.
    const t2 = idx === 0 ? Math.max(20, base - 25) : base + Math.round((Math.random() - 0.5) * 8);
    perf.run(sid, '2026-T2', sub, Math.min(100, Math.max(0, t2)), teacher);
  });
});

// Counseling cases.
db.prepare(`INSERT INTO counseling (student_id, type, notes, counselor_id, status, follow_up_date)
  VALUES (?, 'welfare_case', ?, ?, 'open', ?)`)
  .run(studentIds[0], 'Repeated absence + reported illness. Suspected dropout risk.', counselor, iso(-7));
db.prepare(`INSERT INTO counseling (student_id, type, notes, counselor_id, status)
  VALUES (?, 'home_visit', ?, ?, 'in_progress')`)
  .run(studentIds[1], 'Home visit to discuss Monday/Friday absences (market days).', counselor);
db.prepare(`INSERT INTO counseling (student_id, type, notes, counselor_id, status)
  VALUES (?, 'session', ?, ?, 'resolved')`)
  .run(studentIds[6], 'Career guidance session completed.', counselor);

// Awareness library (5 languages).
const awareness = [
  ['en', 'early_marriage', 'Keep Girls in School', 'Educating a girl child increases family income and community development. Keep girls in school.'],
  ['en', 'early_pregnancy', 'Health & Future', 'Delaying pregnancy keeps girls healthy and in school. Talk to a counselor for guidance.'],
  ['bem', 'early_marriage', 'Sungeni Abana Aba Banakashi Pa Sukulu', 'Ukusambilisha umwana umwanakashi kulaleta ubufuko ku lupwa na ku mushi.'],
  ['nya', 'early_marriage', 'Sungani Atsikana Kusukulu', 'Kuphunzitsa mtsikana kumakulitsa chuma cha banja ndi chitukuko cha dera.'],
  ['toi', 'early_marriage', 'Amubambe Basimbi Kucikolo', 'Kuyiisya musimbi kuyumya lubono lwamukwasyi acisi.'],
  ['loz', 'early_marriage', 'Mu Boloke Basizana mwa Sikolo', 'Ku luta musizana ku ekeza sifumu sa lubasi ni zwelopili ya silalanda.']
];
const aw = db.prepare('INSERT INTO awareness (language, category, title, body) VALUES (?, ?, ?, ?)');
for (const a of awareness) aw.run(...a);

if (process.env.NODE_ENV !== 'test') {
  console.log('Seed complete.');
  console.log(`  Schools: ${schoolIds.length} (Chongwe x2, Lusaka x1)`);
  console.log(`  Students: ${studentIds.length}`);
  console.log('  Logins (password = "password"): admin, teacher, counselor, parent, district, community');
}
