/*
 * Drives the real app in a real browser at four widths and fails on anything
 * that renders wrongly.
 *
 *   python3 -m http.server 8123 --directory nchito-web &
 *   node nchito-web/verify.mjs
 *
 * This exists because the bugs that mattered here were all invisible to static
 * checks. The file parsed, the DOM had the right nodes, the counts were right —
 * and the page was still wrong:
 *
 *   · Chart columns used class="bar", which collided with the progress-bar
 *     component's `height: 6px`. CSS beats an SVG presentation attribute, so
 *     every column painted 6px tall while its height attribute said 194.
 *   · The hire dashboard's sparkline stayed green for the same reason: the
 *     .c-line rule outranked the stroke attribute meant to make it copper.
 *   · A progress bar inside a column-flex notice collapsed to nothing, because
 *     align-items: flex-start shrinks a child that has no content.
 *   · The generated-text box was 20 characters wide, because that is a
 *     textarea's intrinsic width unless something says otherwise.
 *
 * So the assertions here are mostly about painted geometry and computed style,
 * not about whether an element exists.
 *
 * It runs with prefers-reduced-motion, which both keeps the screenshots honest
 * and checks that the reduced-motion path still shows every element.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const APP = process.env.NCHITO_URL || 'http://127.0.0.1:8123/app/';
const OUT = process.env.NCHITO_SHOTS || '/tmp/nchito-verify';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'phone',   w: 390,  h: 844 },
  { name: 'tablet',  w: 834,  h: 1112 },
  { name: 'laptop',  w: 1280, h: 800 },
  { name: 'desktop', w: 1680, h: 1000 },
];

async function shoot(page, path) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(h + 20, vp.height), 6000) });
  await page.waitForTimeout(700);          // debounced chart redraw + every entry animation
  await page.screenshot({ path });
  await page.setViewportSize(vp);
  await page.waitForTimeout(200);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

const problems = [];
const note = (vp, msg) => { problems.push(`[${vp}] ${msg}`); console.log(`  ✗ [${vp}] ${msg}`); };

for (const vp of VIEWPORTS) {
  // Reduced motion for the visual pass: otherwise every screenshot catches the
  // entry animation half-finished and shows a page that looks broken. It also
  // proves the reduced-motion path renders the same content.
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  await page.goto(APP, { waitUntil: 'networkidle' });
  console.log(`\n=== ${vp.name} ${vp.w}x${vp.h} ===`);

  const shell = await page.evaluate(() => ({
    railVisible: getComputedStyle(document.getElementById('rail')).display !== 'none',
    tabsVisible: getComputedStyle(document.getElementById('tabs')).display !== 'none',
    tabCount: document.querySelectorAll('nav.tabs button').length,
    railCount: document.querySelectorAll('aside.rail .nav button').length,
    mainW: Math.round(document.getElementById('main').getBoundingClientRect().width),
    cards: document.querySelectorAll('#main .card').length,
    gridCols: (() => { const g = document.querySelector('#main .grid');
      return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0; })(),
    hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.querySelector('#bar h1')?.textContent.trim(),
  }));
  console.log('  shell:', JSON.stringify(shell));
  if (shell.hScroll > 1) note(vp.name, `horizontal page scroll of ${shell.hScroll}px`);
  if (vp.w >= 900 && !shell.railVisible) note(vp.name, 'rail should be visible at this width');
  if (vp.w >= 900 && shell.tabsVisible) note(vp.name, 'bottom tabs should be hidden at this width');
  if (vp.w < 900 && shell.railVisible) note(vp.name, 'rail should be hidden at this width');
  if (vp.w < 900 && !shell.tabsVisible) note(vp.name, 'bottom tabs should be visible at this width');
  if (shell.cards === 0) note(vp.name, 'gig feed rendered no cards');

  await shoot(page, `${OUT}/${vp.name}-gigs.png`);

  // Filter down through a service family.
  await page.click('.chips button:nth-child(1)');
  await page.waitForTimeout(150);
  const filtered = await page.evaluate(() => ({
    chipRows: document.querySelectorAll('#main .chips').length,
    count: document.querySelectorAll('#main .grid .card').length,
    label: document.querySelector('#main .row .tiny.muted')?.textContent.trim(),
  }));
  console.log('  after picking a family:', JSON.stringify(filtered));
  if (filtered.chipRows < 2) note(vp.name, 'second chip row did not appear after picking a family');
  if (filtered.count === 0) note(vp.name, 'family filter produced an empty feed');

  // Open a gig.
  await page.click('#main .grid .card');
  await page.waitForTimeout(320);
  const detail = await page.evaluate(() => ({
    split: !!document.querySelector('#main .split'),
    hasApply: !!Array.from(document.querySelectorAll('#main button')).find(b => /Apply/.test(b.textContent)),
    back: !!document.querySelector('#bar .back'),
    hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  const bar = await page.evaluate(() => {
    const b = document.querySelector('#main .notice .bar');
    return b ? { w: Math.round(b.getBoundingClientRect().width),
                 parentW: Math.round(b.parentElement.clientWidth) } : null;
  });
  if (bar && bar.w < bar.parentW * 0.5) note(vp.name, `loyalty progress bar collapsed to ${bar.w}px in a ${bar.parentW}px parent`);
  console.log('  gig detail:', JSON.stringify(detail), 'bar:', JSON.stringify(bar));
  if (!detail.hasApply) note(vp.name, 'gig detail has no Apply button');
  if (vp.w >= 1180 && !detail.split) note(vp.name, 'expected list-beside-detail at this width');
  if (vp.w < 1180 && detail.split) note(vp.name, 'split layout appeared below 1180px');
  if (vp.w < 1180 && !detail.back) note(vp.name, 'no back button on a narrow detail view');
  if (detail.hScroll > 1) note(vp.name, `detail view scrolls horizontally by ${detail.hScroll}px`);
  await shoot(page, `${OUT}/${vp.name}-detail.png`);

  // Dashboard.
  await page.evaluate(() => go('dashboard'));
  await page.waitForTimeout(400);
  const dash = await page.evaluate(() => ({
    kpis: document.querySelectorAll('#main .kpi').length,
    charts: document.querySelectorAll('#main svg.chart').length,
    bars: document.querySelectorAll('#main svg.chart rect.c-bar').length,
    // The bug this catches: a CSS class collision made every column paint
    // 6px tall while its height attribute said otherwise.
    barHeights: Array.from(document.querySelectorAll('#main svg.chart rect.c-bar'))
      .map(r => ({ attr: Math.round(Number(r.getAttribute('height'))),
                   painted: Math.round(r.getBoundingClientRect().height) })),
    mixrows: document.querySelectorAll('#main .mixrow').length,
    linePaths: Array.from(document.querySelectorAll('#main path.c-line')).map(p => ({
      len: Math.round(p.getTotalLength()), dash: p.style.strokeDasharray })),
    chartW: Math.round(document.querySelector('#main svg.chart')?.getBoundingClientRect().width || 0),
    boxW: Math.round(document.querySelector('#main .chartbox')?.clientWidth || 0),
    // Every element that should be on screen actually painted, rather than
    // sitting at opacity 0 behind an animation that never ran.
    invisible: Array.from(document.querySelectorAll('#main .card, #main .kpi'))
      .filter(n => Number(getComputedStyle(n).opacity) < 0.9).length,
    hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log('  dashboard:', JSON.stringify(dash));
  if (dash.kpis < 4) note(vp.name, `dashboard shows ${dash.kpis} KPIs`);
  if (dash.charts < 2) note(vp.name, `dashboard shows ${dash.charts} charts`);
  if (dash.bars === 0) note(vp.name, 'bar chart rendered no bars');
  const squashed = dash.barHeights.filter(b => b.attr > 10 && Math.abs(b.painted - b.attr) > 3);
  if (squashed.length) note(vp.name, `${squashed.length} bar(s) painted at the wrong height, e.g. ` +
    `${squashed[0].painted}px for an attribute of ${squashed[0].attr}px`);
  if (dash.mixrows === 0) note(vp.name, 'category mix rendered no rows');
  if (dash.linePaths.some(p => p.len === 0)) note(vp.name, 'a sparkline path has zero length');
  if (dash.linePaths.some(p => !p.dash)) note(vp.name, 'a sparkline was never given its draw length');
  if (dash.hScroll > 1) note(vp.name, `dashboard scrolls horizontally by ${dash.hScroll}px`);
  if (dash.invisible) note(vp.name, `${dash.invisible} dashboard element(s) rendered invisible`);
  // The whole point of drawing charts in JS: the SVG must fill the box it is in.
  if (Math.abs(dash.chartW - dash.boxW) > 3) note(vp.name, `chart is ${dash.chartW}px inside a ${dash.boxW}px box`);
  await shoot(page, `${OUT}/${vp.name}-dashboard.png`);

  // Office assistant.
  await page.evaluate(() => go('assistant'));
  await page.waitForTimeout(250);
  await page.fill('#af-what', 'Paint the shop front');
  await page.fill('#af-where', 'Kabwata, Lusaka');
  await page.fill('#af-budget', '1800');
  await page.click('#main button.primary');
  await page.waitForTimeout(250);
  const assist = await page.evaluate(() => {
    const t = document.getElementById('assistout');
    const card = t ? t.closest('.card') : null;
    return { has: !!t, len: t ? t.value.length : 0,
             mentionsBudget: t ? t.value.includes('1800') : false,
             // A textarea's intrinsic width is its cols attribute, so "looks
             // fine in the DOM" and "fills the card" are different questions.
             boxW: t ? Math.round(t.getBoundingClientRect().width) : 0,
             cardW: card ? Math.round(card.clientWidth) : 0,
             heading: document.querySelector('#main .card .bold.small')?.textContent };
  });
  console.log('  assistant:', JSON.stringify(assist));
  if (!assist.has) note(vp.name, 'assistant produced no output');
  if (assist.has && !assist.mentionsBudget) note(vp.name, 'assistant output dropped the budget field');
  if (assist.has && assist.cardW - assist.boxW > 34) note(vp.name, `assistant output box is ${assist.boxW}px inside a ${assist.cardW}px card`);
  await shoot(page, `${OUT}/${vp.name}-assistant.png`);

  // Hiring mode.
  await page.evaluate(() => setMode('hire'));
  await page.waitForTimeout(350);
  const hire = await page.evaluate(() => ({
    tab: state.tab,
    tabs: Array.from(document.querySelectorAll('nav.tabs button')).map(b => b.dataset.tab),
    rail: Array.from(document.querySelectorAll('aside.rail .nav button span')).map(s => s.textContent.trim()),
    badge: document.querySelector('#bar .pill')?.textContent.trim(),
    title: document.querySelector('#bar h1')?.textContent.trim(),
  }));
  console.log('  hire mode:', JSON.stringify(hire));
  if (hire.badge !== 'Hiring') note(vp.name, `mode badge reads "${hire.badge}"`);

  await page.evaluate(() => go('myposts'));
  await page.waitForTimeout(250);
  const posts = await page.evaluate(() => ({
    cards: document.querySelectorAll('#main .grid .card').length,
    waiting: !!document.querySelector('#main .notice'),
  }));
  console.log('  my jobs:', JSON.stringify(posts));
  if (posts.cards === 0) note(vp.name, 'hire mode shows no posted jobs');
  await shoot(page, `${OUT}/${vp.name}-hire.png`);

  await page.evaluate(() => go('dashboard'));
  await page.waitForTimeout(350);
  const hd = await page.evaluate(() => ({
    kpis: document.querySelectorAll('#main .kpi').length,
    charts: document.querySelectorAll('#main svg.chart').length,
    // The hire side is copper throughout. A green line on an orange fill means
    // a CSS rule beat the attribute that was supposed to colour it.
    lineStroke: getComputedStyle(document.querySelector('#main path.c-line')).stroke,
    barFill: getComputedStyle(document.querySelector('#main rect.c-bar')).fill,
  }));
  console.log('  hire dashboard:', JSON.stringify(hd));
  if (hd.kpis < 4 || hd.charts < 2) note(vp.name, 'hire dashboard is incomplete');
  const COPPER = 'rgb(240, 138, 29)';
  if (hd.lineStroke !== COPPER) note(vp.name, `hire sparkline stroke is ${hd.lineStroke}, expected copper`);
  if (hd.barFill !== COPPER) note(vp.name, `hire bar fill is ${hd.barFill}, expected copper`);
  await shoot(page, `${OUT}/${vp.name}-hiredash.png`);

  if (errors.length) { errors.forEach(e => note(vp.name, 'console: ' + e)); }
  await ctx.close();
}

await browser.close();

console.log('\n' + '='.repeat(60));
if (problems.length) { console.log(`${problems.length} PROBLEM(S):`); problems.forEach(p => console.log(' - ' + p)); process.exit(1); }
console.log('All checks passed at all four widths.');
