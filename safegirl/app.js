'use strict';
/* SafeGirl EduTrack — PWA front-end (vanilla JS, offline-first, CSP-safe). */
const D = window.DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------- navigation ---------- */
const VIEWS = {};
function go(view) {
  if (!VIEWS[view]) view = 'home';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  closeNav();
  window.scrollTo(0, 0);
  VIEWS[view]();
}
function openNav(){ $('#nav').classList.add('open'); $('#scrim').classList.add('show'); }
function closeNav(){ $('#nav').classList.remove('open'); $('#scrim').classList.remove('show'); }
function toggleNav(){ $('#nav').classList.contains('open') ? closeNav() : openNav(); }
function setView(h){ $('#view').innerHTML = h; }

/* ---------- views ---------- */
VIEWS.home = function () {
  setView(`
    <section class="hero">
      <div class="tagline">Keeping Girls in School · Zambia</div>
      <h1>Protecting Girls, Promoting Education, Building Futures</h1>
      <p>A companion app for learners, parents, schools & communities — support that keeps girls in school, pathways to work, and confidential help when it matters most.</p>
    </section>
    <div class="stats">
      ${D.stats.map(s => `<div class="stat"><div class="i">${s.icon}</div><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join('')}
    </div>
    <h2 class="section-title">Explore</h2>
    <div class="grid">
      ${tile('stories','🌟','KGS Success Stories','Real stories of girls kept in school through bursaries, mentorship & early support.')}
      ${tile('internships','🎒','Internships','Paid internship openings at parastatals, ministries & partners.')}
      ${tile('jobs','💼','Parastatal Jobs','A job portal for quasi-government & parastatal companies.')}
      ${tile('gbv','🛡️','GBV Support','Confidential help, hotlines, one-stop centres & safe reporting.')}
    </div>`);
};
function tile(view, icon, title, body){
  return `<a class="card" data-action="nav" data-view="${view}" style="display:block">
    <h3>${icon} ${esc(title)}</h3><p class="muted" style="margin:0">${esc(body)}</p></a>`;
}

VIEWS.stories = function () {
  setView(`
    <h2 class="vh">🌟 KGS Success Stories</h2>
    <p class="sub">How Keeping Girls in School support changes lives. Names are illustrative; shared with consent in real deployments.</p>
    <div class="grid">
      ${D.successStories.map(s => `
        <div class="card">
          <span class="tag">${esc(s.tag)}</span>
          <div class="row-head"><span class="avatar">${esc(s.initials)}</span><h3 style="margin:0">${esc(s.name)}</h3></div>
          <p class="quote">“${esc(s.quote)}”</p>
          <div class="outcome">✅ ${esc(s.outcome)}</div>
        </div>`).join('')}
    </div>`);
};

VIEWS.internships = function () {
  const fields = ['All', ...new Set(D.internships.map(i => i.field))];
  setView(`
    <h2 class="vh">🎒 Internships</h2>
    <p class="sub">Build experience and a stipend — a pathway from school to work.</p>
    <div class="toolbar"><input id="search" placeholder="Search org or role…" /></div>
    <div class="pill-row" id="pills">${fields.map((f,i)=>`<button data-action="filter-field" data-f="${esc(f)}" class="${i===0?'on':''}">${esc(f)}</button>`).join('')}</div>
    <div id="list"></div>`);
  let field='All', q='';
  const render = () => {
    const rows = D.internships.filter(i =>
      (field==='All'||i.field===field) &&
      (i.org.toLowerCase().includes(q)||i.role.toLowerCase().includes(q)));
    $('#list').innerHTML = rows.length ? rows.map(i => `
      <div class="item">
        <div style="flex:1 1 100%"><span class="org">${esc(i.org)}</span> — <span class="role">${esc(i.role)}</span></div>
        <div class="meta"><span>📍 ${esc(i.location)}</span><span>⏳ ${esc(i.duration)}</span><span>💰 ${esc(i.stipend)}</span><span>🗓️ closes ${esc(i.deadline)}</span></div>
        <button class="apply" data-action="apply" data-org="${esc(i.org)}">Apply</button>
      </div>`).join('') : '<p class="muted">No matches.</p>';
  };
  $('#search').addEventListener('input', e => { q = e.target.value.toLowerCase(); render(); });
  $('#pills').addEventListener('click', e => { const b=e.target.closest('[data-f]'); if(!b)return;
    field=b.dataset.f; document.querySelectorAll('#pills button').forEach(x=>x.classList.toggle('on',x===b)); render(); });
  render();
};

VIEWS.jobs = function () {
  const sectors = ['All', ...new Set(D.jobs.map(j => j.sector))];
  setView(`
    <h2 class="vh">💼 Parastatal & Quasi-Government Jobs</h2>
    <p class="sub">Openings across Zambia's state-owned & quasi-government institutions.</p>
    <div class="toolbar">
      <input id="search" placeholder="Search org or role…" />
      <select id="sector">${sectors.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
    </div>
    <div id="list"></div>`);
  let q='', sector='All';
  const render = () => {
    const rows = D.jobs.filter(j =>
      (sector==='All'||j.sector===sector) &&
      (j.org.toLowerCase().includes(q)||j.role.toLowerCase().includes(q)));
    $('#list').innerHTML = `<p class="muted" style="margin:0 0 10px">${rows.length} opening(s)</p>` + (rows.map(j => `
      <div class="item">
        <div style="flex:1 1 100%"><span class="org">${esc(j.org)}</span> — <span class="role">${esc(j.role)}</span> <span class="chip">${esc(j.type)}</span></div>
        <div class="meta"><span>📍 ${esc(j.location)}</span><span>🏷️ ${esc(j.sector)}</span><span>💰 ${esc(j.salary)}</span><span>🗓️ closes ${esc(j.deadline)}</span></div>
        <button class="apply" data-action="apply" data-org="${esc(j.org)}">Apply</button>
      </div>`).join('') || '<p class="muted">No matches.</p>');
  };
  $('#search').addEventListener('input', e => { q=e.target.value.toLowerCase(); render(); });
  $('#sector').addEventListener('change', e => { sector=e.target.value; render(); });
  render();
};

VIEWS.gbv = function () {
  const g = D.gbv;
  setView(`
    <h2 class="vh">🛡️ GBV Support</h2>
    <p class="sub">You are not alone. Help is available — and it can be confidential.</p>
    <div class="alert">⚠️ ${esc(g.note)}</div>

    <h3 class="section-title">Helplines</h3>
    ${g.hotlines.map(h => `
      <div class="hotline"><div><b>${esc(h.name)}</b><div class="muted" style="font-size:.84rem">${esc(h.detail)}</div></div>
      <a class="num" data-action="call" data-num="${esc(h.number)}" href="tel:${esc(h.number.replace(/[^\d]/g,''))}">${esc(h.number)}</a></div>`).join('')}

    <h3 class="section-title">Services & pathways</h3>
    <div class="grid">
      ${g.services.map(s => `<div class="card"><h3>${esc(s.title)}</h3><p class="muted" style="margin:0">${esc(s.body)}</p></div>`).join('')}
    </div>

    <h3 class="section-title">Confidential report</h3>
    <form class="rep" id="repForm">
      <p class="muted" style="font-size:.86rem;margin:0">Share only what you are comfortable with. You may remain anonymous.</p>
      <label>Type of concern</label>
      <select id="rType"><option>Physical abuse</option><option>Sexual abuse / assault</option><option>Early / forced marriage</option><option>Emotional abuse</option><option>Neglect</option><option>Other</option></select>
      <label>Who is affected?</label>
      <select id="rWho"><option>Myself</option><option>A learner / child</option><option>Someone else</option></select>
      <label>District (optional)</label>
      <input id="rDistrict" placeholder="e.g. Chongwe" />
      <label>What happened? (optional)</label>
      <textarea id="rDetails" rows="3" placeholder="Describe when you're ready…"></textarea>
      <label>Contact for follow-up (optional — leave blank to stay anonymous)</label>
      <input id="rContact" placeholder="Phone or name" />
      <button type="submit" class="btn block">Submit confidentially</button>
      <div class="confidential">🔒 This report is stored only on <b>this device</b> in this demo — nothing is sent over the internet. A production deployment routes reports securely to trained Guidance &amp; Counseling and Victim Support staff under strict safeguarding rules.</div>
    </form>
    <div id="myReports"></div>`);
  $('#repForm').addEventListener('submit', e => {
    e.preventDefault();
    const rep = { type:$('#rType').value, who:$('#rWho').value, district:$('#rDistrict').value,
      details:$('#rDetails').value, contact:$('#rContact').value, at:new Date().toISOString() };
    const all = loadReports(); all.unshift(rep); saveReports(all);
    e.target.reset(); toast('Report saved confidentially on this device. Please also call 116 if you need urgent help.');
    renderReports();
  });
  renderReports();
};
function loadReports(){ try{ return JSON.parse(localStorage.getItem('sg_reports')||'[]'); }catch{ return []; } }
function saveReports(a){ try{ localStorage.setItem('sg_reports', JSON.stringify(a)); }catch{} }
function renderReports(){
  const box = $('#myReports'); if(!box) return;
  const all = loadReports();
  box.innerHTML = all.length ? `<h3 class="section-title">Saved on this device (${all.length})</h3>` + all.map((r,i)=>`
    <div class="item"><div style="flex:1 1 100%"><b>${esc(r.type)}</b> · ${esc(r.who)} ${r.district?'· '+esc(r.district):''}</div>
    <div class="meta"><span>${esc(r.at.slice(0,16).replace('T',' '))}</span>${r.details?`<span>${esc(r.details)}</span>`:''}</div>
    <button class="chip" data-action="del-report" data-i="${i}">Delete</button></div>`).join('') : '';
}

VIEWS.awareness = function () {
  setView(`
    <h2 class="vh">📣 Awareness</h2>
    <p class="sub">Messages for communities in Zambian languages.</p>
    <div class="grid">
      ${D.awareness.map(a => `<div class="card"><span class="tag">${esc(a.lang)}</span><h3>${esc(a.title)}</h3><p class="muted" style="margin:0">${esc(a.body)}</p></div>`).join('')}
    </div>`);
};

VIEWS.about = function () {
  setView(`
    <h2 class="vh">ℹ️ About SafeGirl EduTrack</h2>
    <p class="sub">A School Early-Warning & Student Welfare companion aligned to the Government of Zambia's Keeping Girls in School (KGS / GEWEL) programme.</p>
    <div class="card"><h3>What this app offers</h3>
      <ul class="muted" style="margin:0;padding-left:18px;line-height:1.9">
        <li>KGS success stories to inspire and inform</li>
        <li>Internship & parastatal job pathways from school to work</li>
        <li>Confidential GBV support, hotlines & safe reporting</li>
        <li>Multilingual awareness for communities</li>
        <li>Installable &amp; works offline (Progressive Web App)</li>
      </ul></div>
    <div class="card" style="margin-top:12px"><h3>Safeguarding</h3>
      <p class="muted" style="margin:0">This demo stores any report only on your device. A real deployment must comply with the <b>Zambia Data Protection Act No. 3 of 2021</b>, Ministry of Education safeguarding policies, informed consent and strict confidentiality for survivors.</p></div>
    <p class="muted" style="font-size:.8rem;margin-top:14px">Install: open the browser menu and choose <b>“Add to Home screen” / “Install app”</b>.</p>`);
};

/* ---------- interactions ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  if (a === 'nav') { e.preventDefault(); go(el.dataset.view); }
  else if (a === 'toggle-nav') { toggleNav(); }
  else if (a === 'install') { doInstall(); }
  else if (a === 'apply') { toast('In a live deployment this opens the official application for ' + el.dataset.org + '.'); }
  else if (a === 'call') { /* tel: link handles it; toast as hint on desktop */ if (!/Mobi/.test(navigator.userAgent)) toast('Call ' + el.dataset.num); }
  else if (a === 'del-report') { const all=loadReports(); all.splice(Number(el.dataset.i),1); saveReports(all); renderReports(); toast('Deleted.'); }
  else if (a === 'quick-exit') { try{ localStorage.removeItem('sg_lasthash'); }catch{} }
});
window.addEventListener('hashchange', () => go(location.hash.slice(1) || 'home'));

/* ---------- install prompt ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { $('#installBtn').classList.add('hidden'); toast('SafeGirl installed. 🎉'); });
async function doInstall(){
  if (!deferredPrompt) { toast('Use your browser menu → “Add to Home screen”.'); return; }
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').classList.add('hidden');
}

/* ---------- online/offline ---------- */
function netStatus(){
  const el = $('#netStatus'); if(!el) return;
  const on = navigator.onLine;
  el.textContent = on ? '● online' : '● offline — showing saved content';
  el.classList.toggle('off', !on);
}
window.addEventListener('online', netStatus); window.addEventListener('offline', netStatus);

/* ---------- toast ---------- */
let toastT;
function toast(msg){ let el=$('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el);} el.textContent=msg; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),3200); }

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ---------- boot ---------- */
netStatus();
go(location.hash.slice(1) || 'home');
