/*
 * Generates store-listing screenshots at the exact sizes Apple and Google want.
 *
 * Each one is composed in the browser — a caption band above the real app in a
 * device frame — and captured at full store resolution, so no image editing is
 * involved and rerunning this regenerates the whole set.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const OUT = '/home/user/skills-introduction-to-github/nchito-web/brand/store';
const APP = 'http://127.0.0.1:8098/app/';

// App Store now requires 6.7"; Play wants 9:16 phone shots.
const TARGETS = [
  { name: 'ios-6.7', w: 1290, h: 2796, deviceW: 390, deviceH: 844 },
  { name: 'android', w: 1080, h: 1920, deviceW: 390, deviceH: 844 },
];

// Each caption sells the feature the screen is showing, not the screen itself.
const SCENES = [
  { id: 'gigs',   caption: 'Real work, near you',
    sub: 'Deliveries, tutoring, repairs, design — posted by people in your area.',
    steps: [] },
  { id: 'escrow', caption: 'The money is held before you start',
    sub: 'Escrow protects both sides. Your fee falls the longer you work together.',
    steps: [['click', '.card.tap']] },
  { id: 'early',  caption: 'Get paid before the job ends',
    sub: 'Take up to half your payout as soon as the work is underway.',
    steps: [['click', '.card.tap'], ['click', 'button.primary'],
            ['clickText', 'Before'], ['scroll', 640]] },
  { id: 'cash',   caption: 'Find agents that actually have cash',
    sub: "A balance you can't withdraw isn't money. Reported by other workers.",
    steps: [['tab', 'wallet'], ['click', '.card.tap']] },
  { id: 'record', caption: 'A work record you own',
    sub: 'Every job you finish, signed and verifiable. Export it as a CV.',
    steps: [['tab', 'profile'], ['click', '.card.tap']] },
];

const frame = (shotData, t, s) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${t.w}px;height:${t.h}px;display:flex;flex-direction:column;align-items:center;
       background:linear-gradient(165deg,#0E7A18,#0A5D12);
       font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
  .cap{padding:${t.w*0.085}px ${t.w*0.07}px ${t.w*0.045}px;text-align:center;color:#fff}
  h1{font-size:${t.w*0.062}px;line-height:1.14;letter-spacing:-${t.w*0.0016}px;font-weight:800}
  p{font-size:${t.w*0.030}px;line-height:1.45;margin-top:${t.w*0.022}px;opacity:.92;
    max-width:${t.w*0.80}px;margin-left:auto;margin-right:auto}
  .dev{width:${t.w*0.76}px;border-radius:${t.w*0.058}px;padding:${t.w*0.011}px;
       background:#11141A;box-shadow:0 ${t.w*0.03}px ${t.w*0.07}px rgba(0,0,0,.34);overflow:hidden}
  .dev img{display:block;width:100%;border-radius:${t.w*0.048}px}
</style></head><body>
  <div class="cap"><h1>${s.caption}</h1><p>${s.sub}</p></div>
  <div class="dev"><img src="data:image/png;base64,${shotData}"></div>
</body></html>`;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const made = [];

for (const t of TARGETS) {
  for (const s of SCENES) {
    // 1. Drive the real app to the screen we want and capture it.
    const app = await b.newPage({ viewport: { width: t.deviceW, height: t.deviceH },
                                  deviceScaleFactor: 3 });
    await app.goto(APP, { waitUntil: 'networkidle' });
    for (const [kind, arg] of s.steps) {
      if (kind === 'click') await app.click(arg);
      else if (kind === 'tab') await app.click(`nav.tabs button[data-tab="${arg}"]`);
      else if (kind === 'clickText') await app.click(`text=${arg}`);
      else if (kind === 'scroll') await app.evaluate(y => window.scrollTo(0, y), arg);
      await app.waitForTimeout(140);
    }
    // Toasts live 2.6s and would otherwise be frozen into the shot, sitting
    // over whatever is beneath them.
    await app.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 5000 })
             .catch(() => {});
    const raw = `/tmp/claude-0/-home-user/3e8eca95-1ac9-5008-9524-da42d0040fa8/scratchpad/raw-${t.name}-${s.id}.png`;
    await app.screenshot({ path: raw });
    await app.close();

    // 2. Compose it into the store frame at full resolution.
    const page = await b.newPage({ viewport: { width: t.w, height: t.h } });
    await page.setContent(frame(fs.readFileSync(raw).toString('base64'), t, s),
                          { waitUntil: 'networkidle' });
    // The capture must actually have decoded — a broken img still produces a
    // correctly-sized screenshot, which is how a blank one slips through.
    const loaded = await page.$eval('.dev img', n => n.naturalWidth > 0 && n.naturalHeight > 0);
    if (!loaded) throw new Error(`screenshot did not load into ${t.name}-${s.id}`);
    const out = `${OUT}/${t.name}-${SCENES.indexOf(s) + 1}-${s.id}.png`;
    await page.screenshot({ path: out });
    await page.close();
    made.push([out, t.w, t.h]);
  }
}

// Play Store feature graphic — 1024x500, shown at the top of the listing.
const fg = await b.newPage({ viewport: { width: 1024, height: 500 } });
const icon512 = fs.readFileSync('/home/user/skills-introduction-to-github/nchito-web/brand/icon-512.png').toString('base64');
await fg.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1024px;height:500px;display:flex;align-items:center;gap:46px;padding:0 66px;
       background:linear-gradient(120deg,#0E7A18,#0A5D12);
       font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}
  img{width:118px;height:118px;border-radius:27px;flex:0 0 auto}
  h1{font-size:57px;line-height:1.08;letter-spacing:-1.6px;font-weight:800}
  .a{color:#FFC98A}
  p{font-size:21px;margin-top:16px;opacity:.93;max-width:19em;line-height:1.45}
  .s{margin-top:22px;display:flex;gap:9px;flex-wrap:wrap}
  .s span{font-size:14px;font-weight:700;background:rgba(255,255,255,.16);
          padding:7px 14px;border-radius:999px}
</style></head><body>
  <img src="data:image/png;base64,${icon512}">
  <div>
    <h1>Find work.<br>Get paid <span class="a">instantly</span>.</h1>
    <p>Zambia's gig and quick-task app — paid straight to mobile money.</p>
    <div class="s"><span>MTN MoMo</span><span>Airtel Money</span><span>Zamtel Kwacha</span></div>
  </div>
</body></html>`, { waitUntil: 'networkidle' });
await fg.screenshot({ path: `${OUT}/play-feature-graphic-1024x500.png` });
await fg.close();
made.push([`${OUT}/play-feature-graphic-1024x500.png`, 1024, 500]);

await b.close();

// Verify every file came out at the size the store expects.
let bad = 0;
for (const [f, w, h] of made) {
  const d = fs.readFileSync(f);
  const aw = d.readUInt32BE(16), ah = d.readUInt32BE(20);
  // A near-flat image compresses to almost nothing; real content does not.
  // This is what catches a broken composition that is still the right size.
  const bytesPerPixel = d.length / (aw * ah);
  const sized = aw === w && ah === h;
  const hasContent = bytesPerPixel > 0.02;
  if (!sized || !hasContent) bad++;
  console.log(`  ${sized && hasContent ? 'OK  ' : 'BAD '} ${f.split('/').pop().padEnd(34)} ${aw}x${ah}  ${(d.length/1024).toFixed(0)}KB${hasContent ? '' : '  <- looks blank'}`);
}
console.log('\n' + (bad ? `${bad} wrong size` : `${made.length} assets, all at the required dimensions`));
