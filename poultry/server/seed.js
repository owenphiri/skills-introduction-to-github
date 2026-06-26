'use strict';

/**
 * Demonstration data for the PrimeAxis Smart Poultry Management System:
 * a Platinum demo farm with a broiler batch and a layer flock, daily records,
 * feed, vaccinations, sales and expenses. Default password is "password".
 */
const db = require('./db');
const auth = require('./auth');

for (const t of ['sessions', 'daily_logs', 'vaccinations', 'sales', 'expenses', 'feed_inventory', 'employees', 'flocks', 'users', 'farms']) {
  db.exec(`DELETE FROM ${t};`);
}
const iso = d => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

const farmId = db.prepare("INSERT INTO farms (name, location, owner_name, package) VALUES (?, ?, ?, 'platinum')")
  .run('PrimeAxis Demo Farm', 'Kasama, Northern Province', 'PrimeAxis ICT', ).lastInsertRowid;

const pw = auth.hashPassword('password');
for (const [name, username, role] of [
  ['Farm Owner', 'owner', 'owner'], ['Farm Manager', 'manager', 'manager'],
  ['Farm Worker', 'worker', 'worker'], ['Farm Accountant', 'accountant', 'accountant']
]) {
  db.prepare('INSERT INTO users (full_name, username, password_hash, role, farm_id) VALUES (?, ?, ?, ?, ?)')
    .run(name, username, pw, role, farmId);
}
const manager = db.prepare("SELECT id FROM users WHERE username='manager'").get().id;

/* ---- Broiler batch (Ross 308), 35 days old, 1000 placed ---- */
const broilerAge = 35, broilerStart = 1000;
const broilerId = db.prepare(`INSERT INTO flocks (farm_id, name, type, breed, house, start_date, initial_count, current_count)
  VALUES (?, 'Broiler Batch A', 'broiler', 'Ross 308', 'House A', ?, ?, ?)`).run(farmId, iso(broilerAge), broilerStart, broilerStart).lastInsertRowid;

let broilerDeaths = 0;
for (let age = 0; age <= broilerAge; age++) {
  const date = iso(broilerAge - age);
  const weight = Math.round(42 + age * 56 + age * age * 0.4);     // ~2.2kg by day 35
  const perBird = Math.min(0.165, 0.012 + age * 0.0046);          // kg feed/bird/day
  const alive = broilerStart - broilerDeaths;
  let mort = age < 7 ? Math.round(Math.random() * 3 + 1) : Math.round(Math.random() * 2);
  if (broilerAge - age === 2) mort = 26;                          // mortality spike → AI alert
  broilerDeaths += mort;
  db.prepare(`INSERT INTO daily_logs (flock_id, date, mortality, feed_kg, avg_weight_g, water_l, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(broilerId, date, mort, Math.round(perBird * alive * 10) / 10, weight, Math.round(perBird * alive * 2), manager);
}

/* ---- Layer flock (Lohmann Brown), in lay, 800 placed ---- */
const layerStart = 800;
const layerId = db.prepare(`INSERT INTO flocks (farm_id, name, type, breed, house, start_date, initial_count, current_count)
  VALUES (?, 'Layer Flock B', 'layer', 'Lohmann Brown', 'House B', ?, ?, ?)`).run(farmId, iso(210), layerStart, layerStart).lastInsertRowid;

let layerDeaths = 0;
for (let d = 30; d >= 0; d--) {
  layerDeaths += Math.random() < 0.4 ? 1 : 0;
  const alive = layerStart - layerDeaths;
  const hdep = 0.84 + (Math.random() - 0.5) * 0.05;              // ~84% HDEP
  const eggs = Math.round(alive * hdep);
  const broken = Math.round(eggs * 0.02);
  db.prepare(`INSERT INTO daily_logs (flock_id, date, mortality, feed_kg, eggs_collected, eggs_broken, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(layerId, iso(d), Math.random() < 0.4 ? 1 : 0, Math.round(alive * 0.115 * 10) / 10, eggs, broken, manager);
}

db.prepare('UPDATE flocks SET current_count = ? WHERE id = ?').run(broilerStart - broilerDeaths, broilerId);
db.prepare('UPDATE flocks SET current_count = ? WHERE id = ?').run(layerStart - layerDeaths, layerId);

/* ---- Feed purchases ---- */
const feed = db.prepare('INSERT INTO feed_inventory (farm_id, feed_type, quantity_kg, unit_cost, purchased_at) VALUES (?, ?, ?, ?, ?)');
feed.run(farmId, 'Broiler Starter', 1000, 9.5, iso(35));
feed.run(farmId, 'Broiler Grower', 2000, 8.8, iso(20));
feed.run(farmId, 'Broiler Finisher', 1500, 8.5, iso(8));
feed.run(farmId, 'Layer Mash', 3000, 7.9, iso(15));

/* ---- Vaccinations ---- */
const vax = db.prepare('INSERT INTO vaccinations (flock_id, vaccine, scheduled_date, administered_date, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
vax.run(broilerId, 'Newcastle (ND) — day 7', iso(28), iso(28), 'done', 'Drinking water');
vax.run(broilerId, 'Gumboro (IBD) — day 14', iso(21), iso(21), 'done', 'Drinking water');
vax.run(broilerId, 'Newcastle booster', iso(-2), null, 'scheduled', 'Due in 2 days');
vax.run(layerId, 'Fowl Pox', iso(-5), null, 'scheduled', null);

/* ---- Sales (eggs daily, plus bird sales) ---- */
const sale = db.prepare('INSERT INTO sales (farm_id, flock_id, category, quantity, unit, unit_price, amount, customer, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
for (let d = 30; d >= 0; d--) {
  const trays = Math.round(540 / 30);                            // ~18 trays/day
  sale.run(farmId, layerId, 'eggs', trays, 'trays', 75, trays * 75, 'Kasama Market', iso(d));
}
sale.run(farmId, broilerId, 'birds', 200, 'birds', 95, 200 * 95, 'Restaurant order', iso(6));
sale.run(farmId, broilerId, 'birds', 150, 'birds', 95, 150 * 95, 'Wholesale', iso(2));

/* ---- Expenses ---- */
const exp = db.prepare('INSERT INTO expenses (farm_id, category, amount, note, date) VALUES (?, ?, ?, ?, ?)');
exp.run(farmId, 'medication', 1800, 'Vaccines + vitamins', iso(20));
exp.run(farmId, 'labour', 6000, 'Monthly wages', iso(15));
exp.run(farmId, 'utilities', 1500, 'Electricity + water', iso(10));
exp.run(farmId, 'transport', 900, 'Feed delivery', iso(8));
exp.run(farmId, 'equipment', 2500, 'Feeders + drinkers', iso(25));

/* ---- Employees ---- */
const emp = db.prepare('INSERT INTO employees (farm_id, full_name, role, phone, salary) VALUES (?, ?, ?, ?, ?)');
emp.run(farmId, 'Joseph Mwila', 'Supervisor', '0972000001', 3500);
emp.run(farmId, 'Mary Chanda', 'Layer attendant', '0972000002', 2200);
emp.run(farmId, 'Peter Banda', 'Broiler attendant', '0972000003', 2200);

if (process.env.NODE_ENV !== 'test') {
  console.log('Seed complete — PrimeAxis Demo Farm (Platinum).');
  console.log('  Flocks: Broiler Batch A (1000), Layer Flock B (800)');
  console.log('  Logins (password = "password"): owner, manager, worker, accountant');
}
