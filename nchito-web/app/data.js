/*
 * The same seed data the iOS and Android apps run on, so the three platforms
 * demo identically. Plain data, no build step: the whole point of this being
 * vanilla is that it loads fast on a Zambian mobile connection.
 *
 * The service catalogue itself is NOT here — it lives in catalog.js, generated
 * from nchito-shared/taxonomy.json so all five surfaces cannot drift.
 */
const KWACHA = n => 'K' + (Math.abs(n) % 1 === 0 ? n.toFixed(0) : n.toFixed(2));

// Commission falls as a poster and worker build history (INNOVATION.md §1.1),
// so going off-platform stops being worth the saving.
const TIERS = [
  { min: 10, rate: 0.05, label: 'Partner rate' },
  { min: 3,  rate: 0.07, label: 'Trusted pair' },
  { min: 0,  rate: 0.10, label: 'Standard' },
];
const tierFor = n => TIERS.find(t => n >= t.min);

/* ---------------------------------------------------------------------------
 * Open gigs. Spread deliberately across all eight service families: the point
 * of widening the taxonomy is lost if the feed still only shows deliveries and
 * design work.
 * ------------------------------------------------------------------------- */
const GIGS = [
  { id: 'g1', title: 'Deliver documents from Cairo Road to Woodlands',
    details: 'Pick up a sealed envelope from an office on Cairo Road and deliver to Woodlands by 15:00. Must have own transport. Airtime allowance included.',
    category: 'delivery', pay: 150, city: 'Lusaka', area: 'Cairo Road → Woodlands',
    poster: 'Chanda M.', rating: 4.9, ago: '30 min', urgent: true, boosted: true, applicants: 3, together: 0 },
  { id: 'g2', title: 'Design 5 social media posters for a salon',
    details: 'New salon in Kabulonga needs 5 Canva/Photoshop posters for Facebook and TikTok. Brand colours provided. Deliver as PNG within 2 days.',
    category: 'digital', pay: 400, city: 'Lusaka', area: 'Remote',
    poster: 'Beauty Haven', rating: 4.7, ago: '2 hours', urgent: false, boosted: true, applicants: 8, together: 4 },
  { id: 'g3', title: 'Grade 9 Maths tutoring, 3 sessions per week',
    details: 'Patient tutor needed for Grade 9 exam prep. Sessions at our home in Riverside, Kitwe. K120 per 90-minute session, paid weekly.',
    category: 'tutoring', pay: 360, city: 'Kitwe', area: 'Riverside',
    poster: 'Mrs. Banda', rating: 5.0, ago: '3 hours', urgent: false, boosted: false, applicants: 5, together: 0 },
  { id: 'g4', title: 'Fix leaking kitchen tap and replace the mixer',
    details: 'Kitchen mixer tap is dripping and the washer has gone. Parts already bought. Northrise, Ndola. Under an hour for someone experienced.',
    category: 'plumbing', pay: 200, city: 'Ndola', area: 'Northrise',
    poster: 'Joseph K.', rating: 4.5, ago: '4 hours', urgent: true, boosted: false, applicants: 2, together: 0 },
  { id: 'g5', title: 'Waiter/waitress for kitchen party (Saturday)',
    details: 'Two smart, experienced servers for a kitchen party in Avondale, 12:00–18:00. Uniform provided. Meal included. Paid same day via MoMo.',
    category: 'restaurant', pay: 250, city: 'Lusaka', area: 'Avondale',
    poster: 'Events by Mutale', rating: 4.8, ago: '6 hours', urgent: false, boosted: false, applicants: 11, together: 12 },
  { id: 'g6', title: 'Weed and prepare 2 vegetable beds',
    details: 'Backyard garden in Chelstone needs weeding and two beds prepared for rape and tomato planting. Tools provided.',
    category: 'farm', pay: 180, city: 'Lusaka', area: 'Chelstone',
    poster: 'Agnes Z.', rating: 4.6, ago: '8 hours', urgent: false, boosted: false, applicants: 4, together: 0 },
  { id: 'g7', title: 'Box braids for 2 clients at home',
    details: 'Mobile hairdresser needed in Parklands, Kitwe for box braids, 2 clients. Extensions already bought. Portfolio photos required.',
    category: 'salon', pay: 450, city: 'Kitwe', area: 'Parklands',
    poster: 'Natasha C.', rating: 4.9, ago: '10 hours', urgent: false, boosted: false, applicants: 6, together: 0 },
  { id: 'g8', title: 'Deep-clean 3-bedroom house before move-in',
    details: 'Full clean of an empty house in Ibex Hill: floors, windows, bathrooms, kitchen. Materials provided. Can be a 2-person team.',
    category: 'cleaning', pay: 500, city: 'Lusaka', area: 'Ibex Hill',
    poster: 'Mwansa T.', rating: 4.4, ago: '12 hours', urgent: false, boosted: false, applicants: 9, together: 0 },

  { id: 'g9', title: 'Build a boundary wall — 3 days of bricklaying',
    details: 'Approximately 18 metres of block wall at a plot in Chalala. Blocks, sand and cement on site. Bring your own trowel and level. Two general workers provided.',
    category: 'bricklaying', pay: 1800, city: 'Lusaka', area: 'Chalala',
    poster: 'Kalunga Properties', rating: 4.6, ago: '1 hour', urgent: false, boosted: true, applicants: 7, together: 2 },
  { id: 'g10', title: 'Rewire two sockets and fit a DB board',
    details: 'Small house in Kabwata needs two sockets rewired and a new distribution board fitted. Certificate required — please state your registration.',
    category: 'electrical', pay: 950, city: 'Lusaka', area: 'Kabwata',
    poster: 'Daniel S.', rating: 4.8, ago: '5 hours', urgent: true, boosted: false, applicants: 3, together: 0 },
  { id: 'g11', title: 'Make 40 chitenge uniforms for a church choir',
    details: 'Sewing 40 matching choir outfits from supplied chitenge. Measurements collected already. Three weeks to deliver, payment in two stages.',
    category: 'tailoring', pay: 3200, city: 'Ndola', area: 'Masala',
    poster: 'UCZ Masala', rating: 5.0, ago: '1 day', urgent: false, boosted: false, applicants: 12, together: 1 },
  { id: 'g12', title: 'Cook for a 60-guest wedding reception',
    details: 'Experienced chef to lead cooking for 60 guests — nshima, chicken, beef stew, rice and vegetables. Kitchen team of four provided. Own transport needed.',
    category: 'chef', pay: 2500, city: 'Lusaka', area: 'Chilanga',
    poster: 'Mulenga Family', rating: 4.9, ago: '7 hours', urgent: false, boosted: true, applicants: 5, together: 0 },
  { id: 'g13', title: 'Live band for a company end-of-year party',
    details: 'Four-piece band or keyboardist plus vocalist for a corporate function in Rhodes Park, 19:00–22:00. PA system available on site.',
    category: 'music', pay: 3500, city: 'Lusaka', area: 'Rhodes Park',
    poster: 'Zamtel Staff Club', rating: 4.7, ago: '9 hours', urgent: false, boosted: false, applicants: 4, together: 0 },
  { id: 'g14', title: 'Build a 6-page website for a hardware shop',
    details: 'Simple WordPress or hand-built site: home, products, about, contact, location, WhatsApp button. Hosting already bought. Content supplied.',
    category: 'web_design', pay: 4500, city: 'Lusaka', area: 'Remote',
    poster: 'Chembe Hardware', rating: 4.5, ago: '11 hours', urgent: false, boosted: true, applicants: 15, together: 0 },
  { id: 'g15', title: 'Two loaders to offload a 10-tonne maize truck',
    details: 'Offloading 50kg bags from a truck into a store in Makeni. Roughly four hours of work. Water and lunch provided. Paid same day.',
    category: 'loading', pay: 320, city: 'Lusaka', area: 'Makeni',
    poster: 'Musa Traders', rating: 4.3, ago: '2 hours', urgent: true, boosted: false, applicants: 6, together: 0 },
  { id: 'g16', title: 'Barber for a weekend at a Kitwe shop',
    details: 'Cover a barbershop in Chimwemwe on Saturday and Sunday. Clippers and chair provided. Paid per head plus a guaranteed minimum.',
    category: 'barbering', pay: 600, city: 'Kitwe', area: 'Chimwemwe',
    poster: 'Fresh Cuts', rating: 4.6, ago: '14 hours', urgent: false, boosted: false, applicants: 8, together: 3 },
  { id: 'g17', title: 'Bridal make-up for a Saturday wedding',
    details: 'Make-up for the bride and four bridesmaids, starting 06:00 in Libala. Bring your own kit. Photos for your portfolio allowed.',
    category: 'cosmetics', pay: 1200, city: 'Lusaka', area: 'Libala',
    poster: 'Chileshe N.', rating: 4.9, ago: '1 day', urgent: false, boosted: false, applicants: 9, together: 0 },
  { id: 'g18', title: 'Sunday guest preacher for a youth service',
    details: 'Guest speaker for a youth service in Matero, 10:00–12:00. Topic: work and integrity. Transport refund included in the amount.',
    category: 'ministry', pay: 500, city: 'Lusaka', area: 'Matero',
    poster: 'Grace Assembly', rating: 5.0, ago: '2 days', urgent: false, boosted: false, applicants: 3, together: 0 },
  { id: 'g19', title: 'Business coaching: 4 sessions for a market trader',
    details: 'Help a second-hand clothes trader price stock, track cash and plan re-orders. Four sessions, weekly, in Soweto Market.',
    category: 'coaching', pay: 1400, city: 'Lusaka', area: 'Soweto Market',
    poster: 'Zambia Traders SACCO', rating: 4.8, ago: '1 day', urgent: false, boosted: false, applicants: 6, together: 0 },
  { id: 'g20', title: 'Grief counselling sessions for a family',
    details: 'Qualified counsellor for six weekly sessions with a family in Olympia. Please state your qualification and professional body.',
    category: 'counselling', pay: 1800, city: 'Lusaka', area: 'Olympia',
    poster: 'Private client', rating: 4.7, ago: '3 days', urgent: false, boosted: false, applicants: 2, together: 0 },
  { id: 'g21', title: 'Part-time bookkeeper for a hardware shop',
    details: 'Two days a week entering sales, reconciling MoMo statements and preparing a simple monthly summary. QuickBooks knowledge helpful.',
    category: 'bookkeeping', pay: 2200, city: 'Kitwe', area: 'Town Centre',
    poster: 'Chembe Hardware', rating: 4.5, ago: '2 days', urgent: false, boosted: false, applicants: 11, together: 0 },
  { id: 'g22', title: 'Office assistant: filing, typing and reception',
    details: 'Two weeks covering an office in Northmead — answering the phone, typing letters, filing and managing a small diary. Immediate start.',
    category: 'office_admin', pay: 1600, city: 'Lusaka', area: 'Northmead',
    poster: 'Lusaka Legal Chambers', rating: 4.6, ago: '16 hours', urgent: true, boosted: false, applicants: 21, together: 0 },
  { id: 'g23', title: 'Translate a health leaflet into Bemba and Nyanja',
    details: 'A 900-word clinic leaflet needs careful translation into Bemba and Nyanja. Plain language for community health workers.',
    category: 'translation', pay: 900, city: 'Lusaka', area: 'Remote',
    poster: 'Lifeline Clinic', rating: 4.9, ago: '1 day', urgent: false, boosted: false, applicants: 7, together: 0 },
  { id: 'g24', title: 'Paint a 4-bedroom house, inside and out',
    details: 'Full repaint in Riverside, Kitwe. Paint and brushes supplied. Surface preparation included. Estimated six days for a team of two.',
    category: 'painting', pay: 4200, city: 'Kitwe', area: 'Riverside',
    poster: 'Bwalya M.', rating: 4.4, ago: '2 days', urgent: false, boosted: false, applicants: 9, together: 0 },
  { id: 'g25', title: 'Weld a steel gate and two window grilles',
    details: 'Fabricate and fit one 3m sliding gate and two grilles at a plot in Ndola. Steel supplied. Bring your own welding machine.',
    category: 'welding', pay: 2800, city: 'Ndola', area: 'Kansenshi',
    poster: 'Mutale Construction', rating: 4.7, ago: '3 days', urgent: false, boosted: false, applicants: 5, together: 6 },
  { id: 'g26', title: 'Fit kitchen cupboards and a wardrobe',
    details: 'Carpenter to fit pre-made kitchen units and build a fitted wardrobe in Chelston. Materials on site. Four days of work.',
    category: 'carpentry', pay: 2600, city: 'Lusaka', area: 'Chelston',
    poster: 'Phiri Builders', rating: 4.8, ago: '4 days', urgent: false, boosted: false, applicants: 4, together: 0 },
  { id: 'g27', title: 'Night guard for a warehouse, two weeks',
    details: 'Cover the night shift, 18:00–06:00, at a warehouse in Light Industrial Area. Reference and NRC required.',
    category: 'security', pay: 1900, city: 'Lusaka', area: 'Light Industrial',
    poster: 'Zamcargo Ltd', rating: 4.2, ago: '1 day', urgent: false, boosted: false, applicants: 14, together: 0 },
  { id: 'g28', title: 'Nanny for two children, weekday mornings',
    details: 'Care for a 2-year-old and a 4-year-old, 07:00–13:00, Monday to Friday, in Roma. Cooking for the children included. References essential.',
    category: 'childcare', pay: 2400, city: 'Lusaka', area: 'Roma',
    poster: 'Tembo Family', rating: 4.9, ago: '2 days', urgent: false, boosted: false, applicants: 18, together: 0 },
  { id: 'g29', title: 'Driver with a valid PSV licence, one month',
    details: 'Drive a company pick-up around Lusaka, 08:00–17:00 weekdays. Clean licence and at least three years of experience required.',
    category: 'driving', pay: 3000, city: 'Lusaka', area: 'Various',
    poster: 'Kafue Agro', rating: 4.5, ago: '5 days', urgent: false, boosted: false, applicants: 25, together: 0 },
  { id: 'g30', title: 'Photograph a graduation, 4 hours',
    details: 'Cover a UNZA graduation and family photos afterwards. 150 edited photos delivered within a week. Own camera and lighting.',
    category: 'photography', pay: 1500, city: 'Lusaka', area: 'Great East Road',
    poster: 'Zulu Family', rating: 4.8, ago: '6 hours', urgent: false, boosted: false, applicants: 10, together: 0 },
  { id: 'g31', title: 'Wash and iron for a household, three days a week',
    details: 'Laundry and ironing for a family of four in Woodlands, Monday, Wednesday and Friday mornings. Machine available.',
    category: 'laundry', pay: 1200, city: 'Lusaka', area: 'Woodlands',
    poster: 'Sakala Family', rating: 4.6, ago: '1 day', urgent: false, boosted: false, applicants: 13, together: 0 },
  { id: 'g32', title: 'Yoga and stretch classes for an office, 6 weeks',
    details: 'Lunchtime wellness sessions twice a week for staff at an office in Longacres. Mats provided. Six-week block.',
    category: 'lifestyle', pay: 2100, city: 'Lusaka', area: 'Longacres',
    poster: 'Copperbelt Insurance', rating: 4.7, ago: '3 days', urgent: false, boosted: false, applicants: 6, together: 0 },
  { id: 'g33', title: 'Deliver 30 invitation cards around Lusaka',
    details: 'Hand-deliver 30 wedding invitations across Lusaka over three days. Addresses and a route list provided. Must confirm each delivery.',
    category: 'messenger', pay: 700, city: 'Lusaka', area: 'Citywide',
    poster: 'Mwale Wedding', rating: 4.8, ago: '8 hours', urgent: false, boosted: false, applicants: 8, together: 0 },
  { id: 'g34', title: 'Catering for a 120-guest funeral gathering',
    details: 'Full catering for 120 people over two days in Kabwe. Food budget separate — this is the service fee. Team of six expected.',
    category: 'catering', pay: 4800, city: 'Kabwe', area: 'Makululu',
    poster: 'Banda Family', rating: 4.6, ago: '12 hours', urgent: true, boosted: false, applicants: 7, together: 0 },
  { id: 'g35', title: 'Relief teacher: Grade 5, half a term',
    details: 'Cover a Grade 5 class at a community school in Chawama for six weeks. Teaching qualification required. Paid fortnightly.',
    category: 'teaching', pay: 4000, city: 'Lusaka', area: 'Chawama',
    poster: 'Chawama Community School', rating: 4.9, ago: '2 days', urgent: false, boosted: false, applicants: 16, together: 0 },
  { id: 'g36', title: 'Service a generator and fix a borehole pump',
    details: 'Generator will not start and the borehole pump trips. Diagnose both at a lodge in Siavonga. Parts reimbursed separately.',
    category: 'repairs', pay: 1100, city: 'Siavonga', area: 'Lakeside',
    poster: 'Lake View Lodge', rating: 4.4, ago: '1 day', urgent: true, boosted: false, applicants: 3, together: 0 },
  { id: 'g37', title: 'Handyman morning: shelves, curtain rails, door handles',
    details: 'A list of small jobs in one morning at a flat in Olympia. Tools provided. Good for someone building up repeat clients.',
    category: 'home_services', pay: 400, city: 'Lusaka', area: 'Olympia',
    poster: 'Mwansa T.', rating: 4.4, ago: '3 hours', urgent: false, boosted: false, applicants: 5, together: 2 },
  { id: 'g39', title: 'Manicure and pedicure for a hen party (6 guests)',
    details: 'Mobile nail technician for six guests at a house in Woodlands, Sunday afternoon. Gel and regular polish. Bring your own kit.',
    category: 'beauty', pay: 850, city: 'Lusaka', area: 'Woodlands',
    poster: 'Lweendo H.', rating: 4.8, ago: '5 hours', urgent: false, boosted: false, applicants: 7, together: 0 },
  { id: 'g38', title: 'DJ and PA hire for a school sports day',
    details: 'Music and announcements from 07:00 to 14:00 at a school in Chilenje. PA system, microphones and a generator needed.',
    category: 'events', pay: 1600, city: 'Lusaka', area: 'Chilenje',
    poster: 'Chilenje Primary', rating: 4.5, ago: '4 days', urgent: false, boosted: false, applicants: 4, together: 0 },
];

/* ---------------------------------------------------------------------------
 * The hiring side. Nchito has always had two users in one app; until now only
 * the worker had screens. These are gigs the signed-in person posted.
 * ------------------------------------------------------------------------- */
const MY_POSTS = [
  { id: 'p1', title: 'Paint the shop front and fit new signage',
    category: 'painting', pay: 1800, city: 'Lusaka', area: 'Kabwata',
    status: 'open', posted: '2 hours ago', due: 'This Saturday',
    applicants: [
      { name: 'Gilbert M.', rating: 4.8, jobs: 31, onTime: 0.94, quote: 1800, note: 'I have painted three shop fronts on Burma Road. Can start Thursday.', verified: true, together: 0 },
      { name: 'Precious B.', rating: 4.9, jobs: 12, onTime: 1.00, quote: 1950, note: 'Includes surface preparation and two coats. Own scaffolding.', verified: true, together: 2 },
      { name: 'Tobias N.', rating: 4.3, jobs: 48, onTime: 0.87, quote: 1650, note: 'Available immediately, team of two.', verified: false, together: 0 },
    ] },
  { id: 'p2', title: 'Deliver stock from Soweto Market to the shop, weekly',
    category: 'delivery', pay: 260, city: 'Lusaka', area: 'Soweto → Kabwata',
    status: 'assigned', posted: '5 days ago', due: 'Every Monday',
    worker: { name: 'Elias P.', rating: 4.9, jobs: 64, together: 11 },
    applicants: [] },
  { id: 'p3', title: 'Bookkeeping catch-up: 3 months of records',
    category: 'bookkeeping', pay: 1500, city: 'Lusaka', area: 'Remote',
    status: 'awaiting_release', posted: '2 weeks ago', due: 'Delivered yesterday',
    worker: { name: 'Naomi C.', rating: 5.0, jobs: 22, together: 1 },
    proof: { before: true, after: true },
    applicants: [] },
  { id: 'p4', title: 'Shopfront window cleaning, monthly',
    category: 'cleaning', pay: 300, city: 'Lusaka', area: 'Kabwata',
    status: 'settled', posted: 'Last month', due: 'Completed',
    worker: { name: 'Mercy L.', rating: 4.7, jobs: 39, together: 4 },
    applicants: [] },
];

const TASKS = [
  { id: 't1', title: '5-min survey: mobile money habits', kind: 'Survey', reward: 15, minutes: 5, slots: 120 },
  { id: 't2', title: 'Test a new banking app and report 3 issues', kind: 'App Testing', reward: 60, minutes: 20, slots: 25 },
  { id: 't3', title: 'Label 50 photos of Zambian road signs', kind: 'Data Labelling', reward: 40, minutes: 25, slots: 80 },
  { id: 't4', title: 'Share a local business promo to your WhatsApp status', kind: 'Social Boost', reward: 10, minutes: 2, slots: 300 },
  { id: 't5', title: 'Mystery-shop a supermarket till and rate service', kind: 'Mystery Shopper', reward: 70, minutes: 30, slots: 10 },
  { id: 't6', title: 'Record 20 short phrases in Bemba for a speech dataset', kind: 'Voice Data', reward: 55, minutes: 18, slots: 60 },
  { id: 't7', title: 'Photograph 10 shop signs in your area', kind: 'Field Data', reward: 45, minutes: 30, slots: 40 },
];

const TRANSACTIONS = [
  { kind: 'Gig Payout', amount: 405, note: 'Poster design gig — Beauty Haven' },
  { kind: 'Task Reward', amount: 15, note: 'Survey: mobile money habits' },
  { kind: 'Referral Bonus', amount: 20, note: 'Friend joined with code OWEN260' },
  { kind: 'Cash Out', amount: -300, note: 'Cash out to MTN MoMo •••0000' },
  { kind: 'Gig Payout', amount: 225, note: 'Kitchen party serving — Events by Mutale' },
];

const CHATS = [
  { id: 'c1', name: 'Beauty Haven', rating: 4.7, gig: 'Design 5 social media posters for a salon',
    messages: [
      { mine: false, body: 'Hi! I saw your application — do you have samples of poster work?', time: '09:12' },
      { mine: true,  body: "Hello! Yes, I'll send 3 recent Canva designs I did for a barbershop and a boutique.", time: '09:17' },
      { mine: false, body: 'These look great 👌 If I pick you, can you deliver by Thursday?', time: '09:55' },
    ] },
  { id: 'c2', name: 'Chanda M.', rating: 4.9, gig: 'Deliver documents from Cairo Road to Woodlands',
    messages: [
      { mine: false, body: "Are you available today before 15:00? It's a sealed envelope, Cairo Road pickup.", time: '08:02' },
      { mine: true,  body: 'Yes, I can pick up by 13:30 and deliver to Woodlands within the hour.', time: '08:31' },
    ] },
  { id: 'c3', name: 'Gilbert M.', rating: 4.8, gig: 'Paint the shop front and fit new signage',
    messages: [
      { mine: false, body: 'Good morning. I have seen the photos — is the old paint peeling or just faded?', time: '07:40' },
      { mine: true,  body: 'Mostly faded, but the bottom half is peeling. Does that change the quote?', time: '07:58' },
      { mine: false, body: 'A little scraping is needed but the price stands. I can start Thursday.', time: '08:04' },
    ] },
];

// Agent liquidity (INNOVATION.md §3.1). Statuses are pre-computed here the way
// agent_liquidity() computes them, including "unknown" — the most common state
// in a real market and the easiest to forget to design for.
const AGENTS = [
  { name: 'Kabulonga Quickpay', area: 'Kabulonga', landmark: 'next to Melissa Supermarket',
    km: 0.4, verified: true, status: 'has_cash', reports: 2, fresh: '18 min ago', upTo: 1500 },
  { name: 'Chibwe Phone Shop', area: 'Woodlands', landmark: 'opposite the filling station',
    km: 1.1, verified: false, status: 'has_cash', reports: 1, fresh: '30 min ago', upTo: 300 },
  { name: 'Northmead Agent', area: 'Northmead', landmark: 'next to the pharmacy',
    km: 1.4, verified: false, status: 'unknown', reports: 0, fresh: null, upTo: null },
  { name: 'Chelstone Corner Kiosk', area: 'Chelstone', landmark: 'by the market entrance',
    km: 3.4, verified: false, status: 'unknown', reports: 1, fresh: '9 hours ago', upTo: null },
  { name: 'Cairo Road Money Centre', area: 'Cairo Road', landmark: 'near the post office',
    km: 2.6, verified: true, status: 'mixed', reports: 2, fresh: '36 min ago', upTo: 2000 },
  { name: 'Mulungushi Agent Point', area: 'Rhodes Park', landmark: 'inside the arcade',
    km: 1.8, verified: true, status: 'no_cash', reports: 2, fresh: '24 min ago', upTo: null },
];

/* Completed, escrow-settled work. `cat` is a category CODE, resolved through
 * catalog.js — storing the display label here is how the two lists drift. */
const WORK_RECORD = [
  { title: 'Design 5 social media posters for a salon', cat: 'digital', pay: 400, when: 'Sep 2026', rating: 5.0, onTime: true },
  { title: 'Deliver parcel to Chilenje', cat: 'delivery', pay: 120, when: 'Sep 2026', rating: 4.5, onTime: true },
  { title: 'Serve at a kitchen party in Avondale', cat: 'restaurant', pay: 250, when: 'Sep 2026', rating: 5.0, onTime: true },
  { title: 'Menu flyers for a takeaway', cat: 'digital', pay: 300, when: 'Sep 2026', rating: 4.5, onTime: true },
  { title: 'Grade 7 maths tutoring, 4 sessions', cat: 'tutoring', pay: 480, when: 'Sep 2026', rating: 5.0, onTime: true },
  { title: 'Type and format a 40-page report', cat: 'office_admin', pay: 380, when: 'Sep 2026', rating: 4.5, onTime: true },
  { title: 'Collect documents from Manda Hill', cat: 'delivery', pay: 100, when: 'Aug 2026', rating: 4.0, onTime: false },
  { title: 'Logo and business cards for a barber', cat: 'digital', pay: 450, when: 'Aug 2026', rating: 5.0, onTime: true },
  { title: 'Deep clean after a move-out', cat: 'cleaning', pay: 500, when: 'Aug 2026', rating: 4.5, onTime: true },
  { title: 'Landing page for a car-hire business', cat: 'web_design', pay: 1200, when: 'Aug 2026', rating: 5.0, onTime: true },
  { title: 'Translate a school newsletter into Nyanja', cat: 'translation', pay: 260, when: 'Jul 2026', rating: 4.5, onTime: true },
  { title: 'Photograph a christening', cat: 'photography', pay: 800, when: 'Jul 2026', rating: 5.0, onTime: true },
];

/* Twelve weeks of settled earnings, oldest first — the series behind the
 * dashboard sparkline. Deliberately uneven: gig income is not a smooth line,
 * and a chart that pretends otherwise is a chart that lies. */
const EARNINGS_WEEKS = [210, 0, 480, 325, 150, 720, 400, 0, 655, 890, 540, 1010];
const SPEND_WEEKS    = [0, 300, 0, 260, 560, 260, 0, 1800, 260, 300, 1500, 560];

const USER = {
  name: 'Owen Phiri', phone: '+260 97 000 0000', city: 'Lusaka',
  rating: 4.8, gigsDone: 27, verification: 'NRC Verified', referral: 'OWEN260',
  totalEarned: 9420, onTimeRate: 0.93, months: 4,
  skills: ['digital', 'web_design', 'office_admin', 'translation'],
};
