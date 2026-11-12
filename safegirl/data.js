/* SafeGirl EduTrack — seeded demonstration content (Zambia).
 * Content is illustrative. Phone numbers / helplines should be confirmed
 * against current official sources before real-world use. */
window.DATA = {
  stats: [
    { label: 'Girls supported (KGS)', value: '12,480', icon: '👩🏾‍🎓' },
    { label: 'Bursaries disbursed', value: 'ZMW 8.6M', icon: '🎒' },
    { label: 'Returned to school', value: '1,930', icon: '↩️' },
    { label: 'Districts covered', value: '42', icon: '📍' }
  ],

  /* 1) Keeping Girls in School — success stories */
  successStories: [
    {
      name: 'Mwansa, 17 — Kasama',
      initials: 'MW', tag: 'Bursary + mentorship',
      quote: 'The KGS bursary paid my fees after my father passed. I am now in Grade 12 and want to be a nurse.',
      outcome: 'Grade 9 dropout risk → back in school, top 10 of her class.'
    },
    {
      name: 'Natasha, 16 — Chongwe',
      initials: 'NA', tag: 'Return-to-school',
      quote: 'After I became a young mother, the school re-entry programme and a childminding grant let me finish Grade 10.',
      outcome: 'Re-enrolled under the Re-Entry Policy; 88% attendance this term.'
    },
    {
      name: 'Grace, 18 — Mongu',
      initials: 'GR', tag: 'Internship pathway',
      quote: 'SafeGirl connected me to a ZESCO internship. I earned a stipend and discovered I love electrical engineering.',
      outcome: 'Completed secondary, now a first-year bursary student at CBU.'
    },
    {
      name: 'Chanda, 15 — Solwezi',
      initials: 'CH', tag: 'Early-warning intervention',
      quote: 'A counselor noticed my absences early and visited my home. The support stopped me from being married off.',
      outcome: 'Flagged high-risk → counseling + community dialogue; still in school.'
    },
    {
      name: 'Esther, 17 — Livingstone',
      initials: 'ES', tag: 'GBV survivor support',
      quote: 'The one-stop centre and the school kept my case confidential and helped me stay in class.',
      outcome: 'Referred to VSU + One-Stop Centre; continued education with counseling.'
    },
    {
      name: 'Bupe, 16 — Ndola',
      initials: 'BU', tag: 'Sanitary & transport grant',
      quote: 'Monthly sanitary kits and a bicycle grant meant I stopped missing a week every month.',
      outcome: 'Attendance rose from 71% to 95%.'
    }
  ],

  /* 2) Internships */
  internships: [
    { org: 'ZESCO Limited', role: 'Engineering Intern (Electrical)', location: 'Lusaka', duration: '6 months', stipend: 'ZMW 3,500/mo', field: 'Engineering', deadline: '2026-01-15' },
    { org: 'Zambia Revenue Authority (ZRA)', role: 'Finance & Tax Intern', location: 'Lusaka', duration: '3 months', stipend: 'ZMW 2,800/mo', field: 'Finance', deadline: '2025-12-20' },
    { org: 'Zamtel', role: 'ICT / Software Intern', location: 'Ndola', duration: '6 months', stipend: 'ZMW 3,000/mo', field: 'ICT', deadline: '2026-02-01' },
    { org: 'NAPSA', role: 'HR & Administration Intern', location: 'Lusaka', duration: '4 months', stipend: 'ZMW 2,500/mo', field: 'Administration', deadline: '2026-01-31' },
    { org: 'Ministry of Health', role: 'Public Health Intern', location: 'Kitwe', duration: '6 months', stipend: 'Allowance', field: 'Health', deadline: '2026-01-10' },
    { org: 'Zambia National Building Society', role: 'Accounting Intern', location: 'Lusaka', duration: '3 months', stipend: 'ZMW 2,600/mo', field: 'Finance', deadline: '2025-12-31' },
    { org: 'ZAMPOST', role: 'Logistics & Operations Intern', location: 'Kabwe', duration: '4 months', stipend: 'ZMW 2,200/mo', field: 'Logistics', deadline: '2026-02-15' },
    { org: 'Lusaka Water Supply & Sanitation', role: 'Environmental Science Intern', location: 'Lusaka', duration: '6 months', stipend: 'ZMW 2,400/mo', field: 'Environment', deadline: '2026-01-25' }
  ],

  /* 3) Parastatal / Quasi-Government job portal */
  jobs: [
    { org: 'ZESCO Limited', role: 'Graduate Trainee — Power Systems', type: 'Graduate', location: 'Lusaka', salary: 'ZMW 12,000–16,000', sector: 'Energy', deadline: '2026-01-18' },
    { org: 'Zambia Revenue Authority (ZRA)', role: 'Revenue Officer', type: 'Full-time', location: 'Nationwide', salary: 'ZMW 10,000–14,000', sector: 'Finance', deadline: '2026-01-05' },
    { org: 'NAPSA', role: 'Benefits Administration Officer', type: 'Full-time', location: 'Lusaka', salary: 'ZMW 11,000–15,000', sector: 'Social Security', deadline: '2025-12-28' },
    { org: 'Zamtel', role: 'Network Engineer', type: 'Full-time', location: 'Ndola', salary: 'ZMW 13,000–18,000', sector: 'Telecoms', deadline: '2026-02-10' },
    { org: 'ZCCM Investments Holdings', role: 'Investment Analyst', type: 'Full-time', location: 'Lusaka', salary: 'ZMW 15,000–22,000', sector: 'Mining/Finance', deadline: '2026-01-22' },
    { org: 'Zambia Railways', role: 'Mechanical Technician', type: 'Full-time', location: 'Kabwe', salary: 'ZMW 8,000–11,000', sector: 'Transport', deadline: '2026-01-30' },
    { org: 'ZSIC Life', role: 'Actuarial Assistant', type: 'Full-time', location: 'Lusaka', salary: 'ZMW 10,000–14,000', sector: 'Insurance', deadline: '2026-02-05' },
    { org: 'Indeni Petroleum', role: 'Process Engineer', type: 'Full-time', location: 'Ndola', salary: 'ZMW 14,000–20,000', sector: 'Energy', deadline: '2026-01-12' },
    { org: 'TAZARA', role: 'Operations Supervisor', type: 'Full-time', location: 'Mpika', salary: 'ZMW 9,000–12,000', sector: 'Transport', deadline: '2026-02-01' },
    { org: 'National Pension Scheme Authority', role: 'ICT Systems Administrator', type: 'Full-time', location: 'Lusaka', salary: 'ZMW 12,000–16,000', sector: 'ICT', deadline: '2026-01-20' },
    { org: 'Water Resources Management Authority', role: 'Hydrologist', type: 'Full-time', location: 'Lusaka', salary: 'ZMW 11,000–15,000', sector: 'Environment', deadline: '2026-02-12' },
    { org: 'Zambia Postal Services (ZAMPOST)', role: 'Branch Manager', type: 'Full-time', location: 'Chipata', salary: 'ZMW 9,500–13,000', sector: 'Logistics', deadline: '2026-01-27' }
  ],

  /* 4) GBV support — hotlines, services, safety */
  gbv: {
    note: 'If you are in immediate danger, call the Police on 991 / 999 or go to the nearest Police station or health facility. Numbers below are commonly used Zambian support lines — please confirm the current number locally.',
    hotlines: [
      { name: 'GBV & Child Helpline', number: '116', detail: 'Toll-free national helpline (24/7) — report abuse & get help.' },
      { name: 'Police Emergency', number: '991 / 999', detail: 'Immediate danger or crime in progress.' },
      { name: 'Police Victim Support Unit (VSU)', number: 'Nearest police station', detail: 'Specialised unit for GBV survivors — confidential.' },
      { name: 'Lifeline / Childline Zambia', number: '933', detail: 'Counseling & child protection support.' },
      { name: 'YWCA Zambia', number: 'District YWCA office', detail: 'Shelter, counseling & legal aid for women & girls.' }
    ],
    services: [
      { title: 'One-Stop Centres', body: 'Hospital-based centres (e.g. UTH, Ndola, Livingstone, Kitwe) offer medical care, counseling, forensic evidence & police reporting in one place.' },
      { title: 'School re-entry & protection', body: 'Guidance & Counseling teachers can confidentially support survivors to stay in or return to school under the Re-Entry Policy.' },
      { title: 'Legal aid', body: 'Legal Aid Board and NGOs (e.g. WLSA, Young Women\'s Christian Association) assist with protection orders and prosecution.' },
      { title: 'Safe shelter', body: 'Temporary safe houses are available in several provinces through NGOs and faith-based organisations.' }
    ]
  },

  awareness: [
    { lang: 'English', title: 'Keep girls in school', body: 'Educating a girl increases family income and strengthens the whole community.' },
    { lang: 'Bemba', title: 'Sungeni abana aba banakashi pa sukulu', body: 'Ukusambilisha umwana umwanakashi kulaleta ubufuko ku lupwa.' },
    { lang: 'Nyanja', title: 'Sungani atsikana kusukulu', body: 'Kuphunzitsa mtsikana kumakulitsa chuma cha banja ndi dera.' },
    { lang: 'Tonga', title: 'Amubambe basimbi kucikolo', body: 'Kuyiisya musimbi kuyumya lubono lwamukwasyi acisi.' }
  ]
};
