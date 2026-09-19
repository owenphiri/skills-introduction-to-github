/*
 * The same seed data the iOS and Android apps run on, so the three platforms
 * demo identically. Kept as plain data with no build step: the whole point of
 * this being vanilla is that it loads fast on a Zambian mobile connection.
 */
const KWACHA = n => 'K' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));

const CATEGORIES = [
  { id: 'delivery', label: 'Delivery & Errands' },
  { id: 'home_services', label: 'Home Services' },
  { id: 'tutoring', label: 'Tutoring & Lessons' },
  { id: 'digital', label: 'Digital & Design' },
  { id: 'events', label: 'Events & Catering' },
  { id: 'farm', label: 'Farm & Garden' },
  { id: 'beauty', label: 'Beauty & Care' },
  { id: 'repairs', label: 'Repairs & Technical' },
];

// Commission falls as a poster and worker build history (INNOVATION.md §1.1),
// so going off-platform stops being worth the saving.
const TIERS = [
  { min: 10, rate: 0.05, label: 'Partner rate' },
  { min: 3,  rate: 0.07, label: 'Trusted pair' },
  { min: 0,  rate: 0.10, label: 'Standard' },
];
const tierFor = n => TIERS.find(t => n >= t.min);

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
  { id: 'g4', title: 'Fix leaking kitchen tap + replace 2 bulbs',
    details: 'Simple plumbing and electrical job in Northrise, Ndola. Parts already bought. Under an hour for someone experienced.',
    category: 'repairs', pay: 200, city: 'Ndola', area: 'Northrise',
    poster: 'Joseph K.', rating: 4.5, ago: '4 hours', urgent: true, boosted: false, applicants: 2, together: 0 },
  { id: 'g5', title: 'Waiter/waitress for kitchen party (Saturday)',
    details: 'Two smart, experienced servers for a kitchen party in Avondale, 12:00–18:00. Uniform provided. Meal included. Paid same day via MoMo.',
    category: 'events', pay: 250, city: 'Lusaka', area: 'Avondale',
    poster: 'Events by Mutale', rating: 4.8, ago: '6 hours', urgent: false, boosted: false, applicants: 11, together: 12 },
  { id: 'g6', title: 'Weed and prepare 2 vegetable beds',
    details: 'Backyard garden in Chelstone needs weeding and two beds prepared for rape and tomato planting. Tools provided.',
    category: 'farm', pay: 180, city: 'Lusaka', area: 'Chelstone',
    poster: 'Agnes Z.', rating: 4.6, ago: '8 hours', urgent: false, boosted: false, applicants: 4, together: 0 },
  { id: 'g7', title: 'Braids for 2 clients at home',
    details: 'Mobile hairdresser needed in Parklands, Kitwe for box braids, 2 clients. Extensions already bought. Portfolio photos required.',
    category: 'beauty', pay: 450, city: 'Kitwe', area: 'Parklands',
    poster: 'Natasha C.', rating: 4.9, ago: '10 hours', urgent: false, boosted: false, applicants: 6, together: 0 },
  { id: 'g8', title: 'Deep-clean 3-bedroom house before move-in',
    details: 'Full clean of an empty house in Ibex Hill: floors, windows, bathrooms, kitchen. Materials provided. Can be a 2-person team.',
    category: 'home_services', pay: 500, city: 'Lusaka', area: 'Ibex Hill',
    poster: 'Mwansa T.', rating: 4.4, ago: '12 hours', urgent: false, boosted: false, applicants: 9, together: 0 },
];

const TASKS = [
  { id: 't1', title: '5-min survey: mobile money habits', kind: 'Survey', reward: 15, minutes: 5, slots: 120 },
  { id: 't2', title: 'Test a new banking app and report 3 issues', kind: 'App Testing', reward: 60, minutes: 20, slots: 25 },
  { id: 't3', title: 'Label 50 photos of Zambian road signs', kind: 'Data Labelling', reward: 40, minutes: 25, slots: 80 },
  { id: 't4', title: 'Share a local business promo to your WhatsApp status', kind: 'Social Boost', reward: 10, minutes: 2, slots: 300 },
  { id: 't5', title: 'Mystery-shop a supermarket till and rate service', kind: 'Mystery Shopper', reward: 70, minutes: 30, slots: 10 },
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

const WORK_RECORD = [
  { title: 'Design 5 social media posters for a salon', cat: 'Digital & Design', pay: 400, when: 'Sep 2026', rating: 5.0, onTime: true },
  { title: 'Deliver parcel to Chilenje', cat: 'Delivery & Errands', pay: 120, when: 'Sep 2026', rating: 4.5, onTime: true },
  { title: 'Serve at a kitchen party in Avondale', cat: 'Events & Catering', pay: 250, when: 'Sep 2026', rating: 5.0, onTime: true },
  { title: 'Menu flyers for a takeaway', cat: 'Digital & Design', pay: 300, when: 'Sep 2026', rating: 4.5, onTime: true },
  { title: 'Grade 7 maths tutoring, 4 sessions', cat: 'Tutoring & Lessons', pay: 480, when: 'Sep 2026', rating: 5.0, onTime: true },
  { title: 'Collect documents from Manda Hill', cat: 'Delivery & Errands', pay: 100, when: 'Aug 2026', rating: 4.0, onTime: false },
  { title: 'Logo and business cards for a barber', cat: 'Digital & Design', pay: 450, when: 'Aug 2026', rating: 5.0, onTime: true },
  { title: 'Deep clean after a move-out', cat: 'Home Services', pay: 500, when: 'Aug 2026', rating: 4.5, onTime: true },
];

const USER = {
  name: 'Owen Phiri', phone: '+260 97 000 0000', city: 'Lusaka',
  rating: 4.8, gigsDone: 27, verification: 'NRC Verified', referral: 'OWEN260',
  totalEarned: 9420, onTimeRate: 0.93, months: 4,
};
