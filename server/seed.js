'use strict';

const db = require('./db');
const { hashPassword } = require('./auth');
const config = require('./config');

function run() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (existing.n > 0) { console.log('Database already seeded. Skipping.'); return; }

  // ── USERS ──────────────────────────────────────────────────────────────────
  const insertUser = db.prepare(
    'INSERT INTO users (username,password_hash,full_name,role,email,phone) VALUES (?,?,?,?,?,?)'
  );
  insertUser.run('admin',    hashPassword('Admin123!'),   'Administrator',  'admin',   'admin@hardwareplus.co.zm',   '+260 211 000 001');
  insertUser.run('manager',  hashPassword('Manager123!'), 'Store Manager',  'manager', 'manager@hardwareplus.co.zm', '+260 211 000 002');
  insertUser.run('cashier1', hashPassword('Cashier123!'), 'Jane Mwansa',    'cashier', 'jane@hardwareplus.co.zm',    '+260 955 100 001');
  insertUser.run('cashier2', hashPassword('Cashier123!'), 'Brian Mutale',   'cashier', 'brian@hardwareplus.co.zm',   '+260 955 100 002');

  // ── CATEGORIES ──────────────────────────────────────────────────────────────
  const insertCat = db.prepare('INSERT INTO categories (name,description,color) VALUES (?,?,?)');
  const catRows = [
    ['Power Tools',         'Electric & battery-powered tools',        '#3B82F6'],
    ['Hand Tools',          'Manual hand tools & sets',                '#10B981'],
    ['Electrical Supplies', 'Wiring, switches, breakers & accessories','#F59E0B'],
    ['Plumbing Supplies',   'Pipes, fittings, valves & taps',          '#06B6D4'],
    ['Paint & Supplies',    'Paints, brushes, rollers & tape',         '#8B5CF6'],
    ['Fasteners',           'Screws, nails, bolts & anchors',          '#EF4444'],
    ['Safety Equipment',    'PPE, helmets, gloves & eyewear',          '#F97316'],
    ['Measuring Tools',     'Levels, squares, calipers & meters',      '#EC4899'],
    ['Garden & Outdoor',    'Garden tools, hoses & outdoor equipment', '#84CC16'],
    ['Building Materials',  'Cement, aggregate, timber & boards',      '#A78BFA'],
  ];
  const catIds = catRows.map(c => {
    insertCat.run(...c);
    return db.prepare('SELECT last_insert_rowid() AS id').get().id;
  });

  // ── SUPPLIERS ──────────────────────────────────────────────────────────────
  const insertSup = db.prepare(
    'INSERT INTO suppliers (name,contact_name,email,phone,address,city) VALUES (?,?,?,?,?,?)'
  );
  insertSup.run('PowerPro Tools Ltd',            'Charles Mbewe', 'sales@powerpro.co.zm',    '+260 211 300 100', 'Industrial Road 14',  'Lusaka');
  insertSup.run('Zambia Electrical Wholesale',   'Ruth Phiri',    'info@zew.co.zm',          '+260 211 300 200', 'Ben Bella Road 7',    'Lusaka');
  insertSup.run('Eastern Hardware Distributors', 'George Banda',  'george@easternhw.co.zm',  '+260 214 200 300', 'Chipata Main Street', 'Chipata');
  insertSup.run('SafeWork Supply Co.',           'Alice Lungu',   'alice@safework.co.zm',    '+260 212 100 400', 'Freedom Way 55',      'Ndola');
  insertSup.run('BuildRight Materials',          'Samuel Tembo',  'samuel@buildright.co.zm', '+260 211 500 500', 'Great East Road 200', 'Lusaka');

  // ── PRODUCTS (54 items) ────────────────────────────────────────────────────
  const insertProd = db.prepare(`
    INSERT INTO products (sku,barcode,name,description,category_id,supplier_id,unit,cost_price,selling_price,tax_rate,reorder_level)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertInv = db.prepare('INSERT INTO inventory (product_id,quantity,location) VALUES (?,?,?)');

  const productDefs = [
    // Power Tools
    ['PT001','6001001000001','18V Cordless Drill Kit',        '2-speed, 2 batteries & case',      catIds[0],1,'each',  620, 850,16, 5],
    ['PT002','6001001000002','7.25" Circular Saw 1800W',      'Laser guide, 5200 RPM',            catIds[0],1,'each',  880,1200,16, 3],
    ['PT003','6001001000003','Random Orbital Sander 300W',    '5" pad, dust bag',                 catIds[0],1,'each',  475, 650,16, 5],
    ['PT004','6001001000004','4.5" Angle Grinder 900W',       'Side handle, wheel guard',         catIds[0],1,'each',  550, 750,16, 5],
    ['PT005','6001001000005','18V Impact Driver Kit',         'Brushless motor, 3 batteries',     catIds[0],1,'each',  840,1150,16, 3],
    ['PT006','6001001000006','Jig Saw 800W Variable Speed',   'T-shank blade system',             catIds[0],1,'each',  650, 890,16, 3],
    ['PT007','6001001000007','Electric Planer 1000W',         '82mm width, 0–3mm depth',          catIds[0],1,'each',  990,1350,16, 3],
    ['PT008','6001001000008','Rotary Hammer Drill 900W SDS',  '3-mode, anti-vibration',           catIds[0],1,'each', 1200,1650,16, 3],
    // Hand Tools
    ['HT001','6001002000001','Claw Hammer 500g',              'Fibreglass handle',                catIds[1],3,'each',   62,  85,16,20],
    ['HT002','6001002000002','Screwdriver Set 6pc Phillips',  'CRV steel, rubber grip',           catIds[1],3,'set',    88, 120,16,15],
    ['HT003','6001002000003','Adjustable Wrench 300mm',       'Chrome vanadium, 34mm jaws',       catIds[1],3,'each',   70,  95,16,15],
    ['HT004','6001002000004','Combination Pliers 8"',         'Dip-coated handles, CRV',          catIds[1],3,'each',   55,  75,16,20],
    ['HT005','6001002000005','Measuring Tape 5m x 25mm',      'Auto-lock, magnetic hook',         catIds[1],3,'each',   48,  65,16,20],
    ['HT006','6001002000006','Spirit Level 600mm',            'Acrylic vials, aluminium frame',   catIds[1],3,'each',  115, 155,16,10],
    ['HT007','6001002000007','Stanley Knife + 5 Blades',      'Retractable blade',                catIds[1],3,'each',   40,  55,16,25],
    ['HT008','6001002000008','Hacksaw Frame 300mm + Blade',   'Adjustable tension',               catIds[1],3,'each',   80, 110,16,15],
    // Electrical
    ['EL001','6001003000001','Copper Wire 1.5mm 100m Roll',   '450/750V PVC insulated',           catIds[2],2,'roll',  255, 350,16,10],
    ['EL002','6001003000002','Copper Wire 2.5mm 100m Roll',   '450/750V PVC insulated',           catIds[2],2,'roll',  400, 550,16,10],
    ['EL003','6001003000003','Switch Socket Outlet Double',   '13A white modular, pair',          catIds[2],2,'pair',   62,  85,16,20],
    ['EL004','6001003000004','Circuit Breaker MCB 20A',       'Single pole, 6kA',                 catIds[2],2,'each',  106, 145,16,15],
    ['EL005','6001003000005','Weatherproof Junction Box IP55','100x100x50mm with terminals',      catIds[2],2,'each',   48,  65,16,20],
    ['EL006','6001003000006','Cable Clips 100 Pack Mixed',    'White nylon nail-in 3/5/7mm',      catIds[2],2,'pack',   26,  35,16,30],
    // Plumbing
    ['PL001','6001004000001','PVC Pressure Pipe 20mm 3m',     'Class C, BS3505',                  catIds[3],5,'length', 33,  45,16,20],
    ['PL002','6001004000002','PVC Elbow 90deg 20mm Pk10',     'Solvent weld fittings',            catIds[3],5,'pack',   28,  38,16,25],
    ['PL003','6001004000003','Brass Gate Valve 3/4"',         'PN16, chrome handle',              catIds[3],5,'each',   92, 125,16,10],
    ['PL004','6001004000004','PTFE Thread Tape 5 Pack',       '12m x 12mm white',                 catIds[3],5,'pack',   18,  25,16,40],
    ['PL005','6001004000005','Tap Washer & Jumper Kit 15pc',  'Assorted sizes',                   catIds[3],5,'kit',    35,  48,16,20],
    ['PL006','6001004000006','Flexible Braided Hose 450mm',   '1/2" BSP, stainless braid',        catIds[3],5,'each',   70,  95,16,15],
    // Paint
    ['PA001','6001005000001','Interior Emulsion Paint 5L',    'Washable, low VOC',                catIds[4],5,'tin',   208, 285,16,10],
    ['PA002','6001005000002','Exterior Masonry Paint 5L',     'Weather resistant, anti-fungal',   catIds[4],5,'tin',   234, 320,16,10],
    ['PA003','6001005000003','Gloss Enamel Paint White 1L',   'Hard gloss, metal & wood',         catIds[4],5,'tin',    88, 120,16,15],
    ['PA004','6001005000004','Paint Roller Kit 9"',           'Frame, tray, 2 sleeves',           catIds[4],3,'kit',   121, 165,16,10],
    ['PA005','6001005000005','Masking Tape 48mm 3 Pack',      'UV-resistant, clean removal',      catIds[4],3,'pack',   70,  95,16,20],
    // Fasteners
    ['FA001','6001006000001','Wood Screws Assorted 200pc',    'Pozi head, zinc plated',           catIds[5],3,'box',    62,  85,16,20],
    ['FA002','6001006000002','Round Wire Nails Assorted 1kg', '38/50/75mm galvanised mix',        catIds[5],3,'pack',   40,  55,16,25],
    ['FA003','6001006000003','Rawl Anchor Bolt M8 Pk20',      'Zinc alloy 8x55mm',               catIds[5],3,'pack',   55,  75,16,20],
    ['FA004','6001006000004','Hex Bolt M10x50 Pk10 + Nuts',   'Grade 8.8 galvanised',            catIds[5],3,'pack',   48,  65,16,20],
    ['FA005','6001006000005','Roofing Screw Hex 12x50 Bx100', 'Type 17, rubber washer',          catIds[5],3,'box',    92, 125,16,15],
    // Safety
    ['SE001','6001007000001','Safety Hard Hat EN397',         'HDPE shell, 6-point suspension',   catIds[6],4,'each',  106, 145,16,15],
    ['SE002','6001007000002','Leather Work Gloves Cut-5',     'Lined palm, elasticated back',     catIds[6],4,'pair',   70,  95,16,20],
    ['SE003','6001007000003','Safety Goggles Anti-Fog',       'Indirect vent, ANSI Z87.1',        catIds[6],4,'each',   55,  75,16,20],
    ['SE004','6001007000004','N95 Respirator Mask 5 Pack',    'FFP2 valve-free foldable',         catIds[6],4,'pack',   62,  85,16,20],
    ['SE005','6001007000005','Hi-Vis Safety Vest EN20471',    'Class 2 yellow, XL',              catIds[6],4,'each',   55,  75,16,20],
    // Measuring
    ['MT001','6001008000001','Digital Vernier Caliper 150mm', '0.01mm resolution, IP54',         catIds[7],3,'each',  216, 295,16, 8],
    ['MT002','6001008000002','Laser Distance Meter 40m',      'Accuracy ±1.5mm',                 catIds[7],3,'each',  621, 850,16, 5],
    ['MT003','6001008000003','Combination Square 300mm',      'Cast iron head, hardened rule',    catIds[7],3,'each',  121, 165,16, 8],
    ['MT004','6001008000004','Torpedo Level 200mm Magnetic',  '3 vials, rare earth magnet',       catIds[7],3,'each',   70,  95,16,10],
    // Garden
    ['GO001','6001009000001','Garden Hose 20m + Fittings',    '13mm kink-resist, 10-pattern nozzle',catIds[8],5,'set',179, 245,16, 8],
    ['GO002','6001009000002','Electric Hedge Trimmer 500W',   '420mm double-action blade',        catIds[8],1,'each',  549, 750,16, 5],
    ['GO003','6001009000003','Garden Spade Long Handle',      'Carbon steel, ash handle',         catIds[8],5,'each',  135, 185,16, 8],
    ['GO004','6001009000004','Aluminium Garden Rake 16-Tine', 'Adjustable head 30–60cm',         catIds[8],5,'each',   92, 125,16,10],
    // Building Materials
    ['BM001','6001010000001','Portland Cement 42.5N 50kg Bag','ZABS certified Lafarge',           catIds[9],5,'bag',    98, 135,16,20],
    ['BM002','6001010000002','River Sand Fine 50kg Bag',      'Washed, plastering grade',         catIds[9],5,'bag',    55,  75,16,20],
    ['BM003','6001010000003','Treated Timber 50x100mm 3m',   'H3 hazard class SABS treated',     catIds[9],5,'length',195, 265,16,10],
    ['BM004','6001010000004','Rhino Board 12.5mm 1200x2400', 'Standard gypsum drywall panel',    catIds[9],5,'sheet', 255, 350,16,10],
  ];

  const prodMeta = productDefs.map(p => {
    insertProd.run(...p);
    const pid = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    const qty = 20 + Math.floor(Math.random() * 80);
    insertInv.run(pid, qty, 'Main Store');
    return { id: pid, cost_price: p[7], selling_price: p[8] };
  });

  // ── CUSTOMERS ──────────────────────────────────────────────────────────────
  const insertCust = db.prepare(`
    INSERT INTO customers (customer_code,full_name,phone,email,address,city,loyalty_points,credit_limit,notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  [
    ['CUST001','John Mwanza',              '+260 977 100 001','john@mwanza.co.zm',        'Plot 12 Kabulonga','Lusaka', 1250, 5000, 'Contractor — bulk orders'],
    ['CUST002','Mary Tembo',               '+260 965 200 002','mary.tembo@gmail.com',     '14 Chainda Place', 'Lusaka',  320,    0, 'DIY homeowner'],
    ['CUST003','Benson Construction Ltd',  '+260 211 300 003','info@bensonconstruct.co.zm','Alick Nkhata Rd 3','Lusaka',3800,50000,'Major contractor — net 30'],
    ['CUST004','Faith Mumba',              '+260 955 400 004','faith.mumba@gmail.com',    '7 Ridgeway North', 'Lusaka',  150,    0, ''],
    ['CUST005','Peter Banda',              '+260 977 500 005','peter@bandaelectric.co.zm','32 Kelvin Ave',    'Lusaka',  980, 3000, 'Licensed electrician'],
    ['CUST006','Zambia Real Estate Ltd',   '+260 211 600 006','procurement@zamre.co.zm',  'Cairo Rd Tower 5', 'Lusaka', 2500,30000, 'Corporate account'],
    ['CUST007','Lucy Phiri',               '+260 966 700 007','lucy.plumber@gmail.com',   '45 Northmead',    'Lusaka',  620, 1500, 'Plumbing contractor'],
    ['CUST008','James Simwanza',           '+260 954 800 008','jsimwanza@gmail.com',      '8 Rhodespark',    'Lusaka',  380,    0, 'Painter'],
    ['CUST009','Moses Nkumbula',           '+260 977 900 009','moses@nkumbuilders.co.zm', 'Matero Main Rd',  'Lusaka', 1100, 5000, 'Building contractor'],
    ['CUST010','Rose Kaunda',              '+260 965 100 010','rose.kaunda@gmail.com',    '3 Sunningdale',   'Lusaka',  210,    0, 'Interior designer'],
    ['CUST011','David Mulenga',            '+260 977 110 011','david.garden@gmail.com',   '22 Roma',         'Lusaka',  180,    0, 'Garden enthusiast'],
    ['CUST012','Chipata Hardware & Sundry','+260 214 120 012','orders@chipatahw.co.zm',   'Market Road 1',  'Chipata', 1650,10000, 'Reseller'],
    ['CUST013','Grace Tembo',              '+260 966 130 013','grace.tembo@gmail.com',    '9 Avondale',      'Lusaka',  280,    0, ''],
    ['CUST014','Felix Mutale',             '+260 977 140 014','felix@carpentry.co.zm',    'Industrial B4',   'Lusaka',  740, 2000, 'Carpenter'],
    ['CUST015','Naomi Lungu',              '+260 965 150 015','naomi@safetyfirst.co.zm',  '1 Longacres',     'Lusaka',  560, 2000, 'Safety officer — bulk PPE'],
  ].forEach(c => insertCust.run(...c));

  // ── HISTORICAL SALES ─────────────────────────────────────────────────────
  const insertSale = db.prepare(`
    INSERT INTO sales
      (receipt_no,customer_id,user_id,sale_date,subtotal,tax_amount,discount_amount,
       total_amount,cost_total,payment_method,amount_paid,change_amount,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO sale_items (sale_id,product_id,quantity,unit_price,cost_price,discount_percent,tax_rate,line_total)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  const deductInv = db.prepare(
    "UPDATE inventory SET quantity = MAX(0, quantity - ?), updated_at = datetime('now') WHERE product_id = ?"
  );

  const payMethods = ['cash','cash','cash','card','card','mobile_money','credit'];
  const userIds    = [1,2,3,4];
  let seq          = 1;

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function ri(mn, mx) { return mn + Math.floor(Math.random() * (mx - mn + 1)); }

  for (let i = 0; i < 280; i++) {
    const daysAgo = ri(0, 119);
    const saleTs  = new Date(Date.now() - daysAgo * 86_400_000);
    saleTs.setHours(ri(8,17), ri(0,59), 0, 0);
    const saleDate = saleTs.toISOString().slice(0,19).replace('T',' ');

    const custId  = Math.random() < 0.72 ? ri(1,15) : null;
    const payM    = pick(payMethods);
    const numItems = ri(1,6);
    const seen    = new Set();
    const items   = [];

    for (let j = 0; j < numItems; j++) {
      let p, tries = 0;
      do { p = pick(prodMeta); tries++; } while (seen.has(p.id) && tries < 15);
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const qty  = ri(1,4);
      const lt   = parseFloat((qty * p.selling_price).toFixed(2));
      items.push({ pid: p.id, qty, unit: p.selling_price, cost: p.cost_price, lt });
    }
    if (!items.length) continue;

    const sub  = parseFloat(items.reduce((s,x) => s + x.lt, 0).toFixed(2));
    const tax  = parseFloat((sub * config.tax.vat / 100).toFixed(2));
    const tot  = parseFloat((sub + tax).toFixed(2));
    const cost = parseFloat(items.reduce((s,x) => s + x.cost * x.qty, 0).toFixed(2));
    const paid = payM === 'cash' ? parseFloat((Math.ceil(tot/50)*50).toFixed(2)) : tot;
    const chg  = parseFloat(Math.max(0, paid - tot).toFixed(2));
    const rno  = `RCP-${String(seq++).padStart(5,'0')}`;

    insertSale.run(rno, custId, pick(userIds), saleDate, sub, tax, 0, tot, cost, payM, paid, chg, 'completed');
    const sid = db.prepare('SELECT last_insert_rowid() AS id').get().id;

    items.forEach(x => {
      insertItem.run(sid, x.pid, x.qty, x.unit, x.cost, 0, config.tax.vat, x.lt);
      deductInv.run(x.qty, x.pid);
    });
    if (custId) db.prepare("UPDATE customers SET last_purchase=? WHERE id=?").run(saleDate, custId);
  }

  // Recalc loyalty points
  db.prepare(`
    SELECT customer_id, SUM(total_amount) AS t FROM sales
    WHERE customer_id IS NOT NULL AND status='completed' GROUP BY customer_id
  `).all().forEach(r =>
    db.prepare('UPDATE customers SET loyalty_points=? WHERE id=?').run(Math.floor(r.t/10), r.customer_id)
  );

  // ── DEFAULT SETTINGS ──────────────────────────────────────────────────────
  const s = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
  [
    ['business_name',   config.business.name],
    ['business_address',config.business.address],
    ['business_phone',  config.business.phone],
    ['business_email',  config.business.email],
    ['business_tin',    config.business.tin],
    ['business_vat_no', config.business.vatNumber],
    ['receipt_footer',  config.business.receiptFooter],
    ['vat_rate',        String(config.tax.vat)],
    ['currency_symbol', config.currency.symbol],
    ['currency_code',   config.currency.code],
    ['low_stock_alert', '10'],
    ['receipt_prefix',  config.pos.receiptPrefix],
  ].forEach(([k,v]) => s.run(k,v));

  console.log('Seeded: 4 users, 10 categories, 5 suppliers, 54 products, 15 customers, ~280 historical sales.');
}

run();
