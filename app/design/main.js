// Design notes: every widget on this page reads the real benchmark, so the
// examples show the patterns with the numbers they'll carry.
import { call } from '../api.js';
import { INTAKE, PLACE, PLACES } from '../office/intake.js';
import { installFilters, roughCircle, roughLine, roughRect, blob, hashStr, SECTION, GLYPH } from './ink.js';
import { Scene, WEATHER, skyAt, nightAt, rgb } from './scene.js';
import { Plant, modelFrom, glyph, head } from './plant.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const pct = (v) => `${Math.round(v * 100)}%`;
const ktok = (v) => `${Math.round(v / 1000)}k`;

const WHO = {
  morenos_oh: 'the Morenos', haines_fl: 'Dolores Haines', raghavan_becker_ca: 'Priya and Tom',
  haddad_co: 'Noor Haddad', vega_nv: 'Marisol and Diego',
};
const FROM = {
  morenos_oh: ['Luis Moreno', 'By phone, March 2026'],
  haines_fl: ['Dolores Haines', 'By phone, March 2026'],
  raghavan_becker_ca: ['Priya Raghavan and Tom Becker', 'By phone, March 2026'],
  haddad_co: ['Noor Haddad', 'By phone, March 2026'],
  vega_nv: ['Marisol Vega', 'By phone, March 2026'],
};
const SKY_SAY = { clear: 'clear', fair: 'fair, with some cloud', overcast: 'overcast', showers: 'light showers', fog: 'fog in the valley', snow: 'snow' };

const S = { agent: 'kestrel', hh: 'morenos_oh', metric: 'share' };
const D = {};
const subs = [];
const update = () => subs.forEach((f) => f());

boot();

async function boot() {
  installFilters();
  numberParts();
  paintWashes();
  paintFooter();
  reveal();
  const [meta, hh, profiles] = await Promise.all([call('meta'), call('households'), call('profiles')]);
  D.meta = meta; D.hh = hh; D.profiles = profiles;
  D.worlds = Object.fromEntries(await Promise.all(hh.map(async (h) => [h.id, await call('world', h.id)])));
  D.lb = await fetch('data/leaderboard.json').then((r) => r.json()).catch(() => call('leaderboard'));
  D.grid = {};
  for (const p of profiles) {
    D.grid[p.id] = {};
    await Promise.all(hh.map(async (h) => { D.grid[p.id][h.id] = await call('rollout', { household: h.id, profile: p.id, seed: 0 }); }));
  }
  hero();
  principles();
  day();
  materials();
  headline();
  strategy();
  table();
  quotes();
  scatter();
  garden();
  update();
}

const R = (pid = S.agent, hid = S.hh) => D.grid[pid][hid];
const agentName = (id) => D.profiles.find((p) => p.id === id)?.name || id;
function split(g) {
  let found = 0, part = 0, wrong = 0;
  for (const c of g.chain) { if (c.mark === 'full') found += c.judged; else if (c.mark === 'partial') part += c.judged; }
  for (const it of g.items) if (it.judged < 0) wrong += -it.judged;
  return { found, part, miss: Math.max(0, g.bks - found - part), wrong, bks: g.bks };
}

// ── Scaffolding ───────────────────────────────────────────────
function numberParts() {
  $$('.part-h .n').forEach((n, i) => n.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 56 56" aria-hidden="true"><path d="${roughCircle(28, 28, 21, 7 + i * 3, 0.06)}" fill="none" stroke="#2e2923" stroke-width="1.4" stroke-linecap="round" filter="url(#pencil)"/></svg>`));
}

function paintWashes() {
  const SPOTS = {
    principles: [[12, 22, 320, 260, '#efc767', .42, 1], [86, 30, 300, 240, '#9fbf96', .38, 2], [56, 82, 360, 220, '#9db7d8', .36, 3], [24, 78, 220, 180, '#e2a49a', .3, 4]],
    day: [[88, 18, 260, 200, '#efc767', .35, 5], [8, 60, 240, 260, '#9db7d8', .3, 6]],
    materials: [[30, 40, 300, 240, '#e2a49a', .3, 7], [80, 70, 300, 240, '#9fbf96', .34, 8]],
    numbers: [[10, 12, 300, 220, '#9fbf96', .34, 9], [90, 34, 300, 260, '#efc767', .34, 10], [20, 60, 280, 240, '#9db7d8', .3, 11], [78, 86, 320, 230, '#e2a49a', .3, 12]],
  };
  $$('.washes').forEach((el) => {
    const spots = SPOTS[el.dataset.w] || [];
    el.innerHTML = `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><g filter="url(#wash)">${spots.map(([x, y, rx, ry, c, o, s]) => `<path d="${blob(x * 16, y * 10, rx, ry, s, 10)}" fill="${c}" opacity="${o}"/>`).join('')}</g></svg>`;
  });
}

function paintFooter() {
  const el = $('.foot .hills');
  if (!el) return;
  const ridge = (base, amp, seed, n = 9) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 1600},${base + Math.sin(i * 1.7 + seed) * amp + Math.cos(i * 0.9 + seed * 2) * amp * 0.6}`);
    return `M0 300 L${pts.join(' L')} L1600 300 Z`;
  };
  el.innerHTML = `<svg viewBox="0 0 1600 300" preserveAspectRatio="none"><g filter="url(#wc)">
    <path d="${ridge(120, 26, 1)}" fill="#c9d4bd" opacity=".75"/>
    <path d="${ridge(170, 22, 4)}" fill="#b5c6a8" opacity=".8"/>
    <path d="${ridge(225, 16, 2)}" fill="#e9e1d0"/></g></svg>`;
}

function reveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rise').forEach((el) => io.observe(el));
}

function roll(el, text) {
  const mask = [...text].map((c) => (/\d/.test(c) ? 'd' : c)).join('');
  if (el.dataset.mask !== mask) {
    el.innerHTML = [...text].map((c) => (/\d/.test(c) ? `<span class="d"><span>${[...'0123456789'].map((d) => `<span>${d}</span>`).join('')}</span></span>` : `<span>${c}</span>`)).join('');
    el.dataset.mask = mask;
    void el.offsetWidth;
  }
  [...text].forEach((c, i) => { if (/\d/.test(c)) el.children[i].firstElementChild.style.transform = `translateY(${-c}em)`; });
}

// ── Hero: dawn, and a plant that grows with the light ─────────
function hero() {
  const canvas = $('#heroSky');
  const pick = () => { const w = [['clear', 3], ['fair', 3], ['overcast', 1], ['showers', 1.4], ['fog', 1.2], ['snow', 1.4]]; let r = Math.random() * w.reduce((a, b) => a + b[1], 0); for (const [k, v] of w) { if ((r -= v) < 0) return k; } return 'fair'; };
  const scene = new Scene(canvas, { scale: 0.6, seed: 3 + Math.random() * 40 });
  const plant = new Plant($('#heroPlant'), { seed: 21 });
  const frost = $('#heroWin .fog');
  let timers = [];
  const dawn = (hid) => {
    timers.forEach(clearTimeout); timers = [];
    const wx = pick();
    scene.set({ day: 0.02, ...WEATHER[wx] }, { instant: true });
    frost.style.setProperty('--frost', wx === 'snow' || wx === 'fog' ? .9 : wx === 'showers' ? .7 : .45);
    timers.push(setTimeout(() => scene.set({ day: 0.34 }, { seconds: 9 }), 300));
    timers.push(setTimeout(() => scene.set({ day: 0.6 }, { seconds: 240 }), 9500));
    const { rollout, grade } = R('kestrel', hid);
    const m = modelFrom(rollout, grade);
    plant.build(m);
    const found = m.items.filter((i) => i.mark === 'full' || i.mark === 'partial');
    const steps = 14;
    for (let s = 0; s <= steps; s++) {
      timers.push(setTimeout(() => {
        const k = s / steps;
        plant.grow({ h: k, leaves: Math.round(k * Math.min(16, m.leaves)), shown: new Set(found.slice(0, Math.floor(k * found.length)).map((i) => i.id)), buds: s === steps, weeds: s === steps ? 3 : 0 });
      }, 1200 + s * 620));
    }
    $('#heroSay').textContent = `Today's sky: ${SKY_SAY[wx]}. Kestrel's plant for ${WHO[hid]}.`;
  };
  const order = ['morenos_oh', 'haddad_co', 'vega_nv', 'haines_fl', 'raghavan_becker_ca'];
  let n = 0;
  dawn(order[0]);
  $('#another').addEventListener('click', () => {
    scene.set({ day: 0.0 }, { seconds: 1.2 });
    setTimeout(() => { scene.seed = 3 + Math.random() * 40; dawn(order[++n % order.length]); }, 1300);
  });
  holdButton($('#heroHold'), scene);
}

function holdButton(btn, scene) {
  const PAUSE = '<svg viewBox="0 0 12 12"><path d="M3.5 2v8M8.5 2v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const PLAY = '<svg viewBox="0 0 12 12"><path d="M3.5 2v8l6-4z" fill="currentColor"/></svg>';
  btn.innerHTML = PAUSE;
  btn.addEventListener('click', () => {
    scene.running = !scene.running;
    btn.innerHTML = scene.running ? PAUSE : PLAY;
    btn.setAttribute('aria-label', scene.running ? 'Pause' : 'Play');
  });
}

// ── Six principles, each with a small working demo ────────────
function principles() {
  // 1. people before percentages
  const ids = D.hh.map((h) => h.id);
  let i = 0;
  const el = $('#dPeople');
  el.innerHTML = `<div><div class="was"><span id="dpPct"></span><svg viewBox="0 0 60 14" preserveAspectRatio="none"><path d="${roughLine(0, 9, 60, 5, 3, 1.5)}" stroke="#a9503a" stroke-width="1.6" fill="none" stroke-linecap="round" filter="url(#pencil)"/></svg></div>
    <div class="big"><span class="roll" id="dpBig"></span></div><div class="who" id="dpWho"></div></div><div class="hint tiny">Click for the next household</div>`;
  const show = () => {
    const g = R('kestrel', ids[i]).grade;
    $('#dpPct').textContent = pct(g.score);
    roll($('#dpBig'), money(g.judged));
    $('#dpWho').textContent = `stays with ${WHO[ids[i]]}`;
  };
  el.addEventListener('click', () => { i = (i + 1) % ids.length; show(); });
  show();

  // 2. daylight, not deadlines
  const dd = $('#dDay');
  dd.innerHTML = `<svg viewBox="0 0 320 200" aria-label="Drag the sun across the day">
    <defs><linearGradient id="ddSky" x1="0" y1="0" x2="0" y2="1"><stop id="ddTop" offset="0"/><stop id="ddHor" offset="1"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#ddSky)"/>
    <g id="ddStars" opacity="0">${Array.from({ length: 22 }, (_, k) => `<circle cx="${(k * 73) % 310 + 5}" cy="${(k * 37) % 90 + 8}" r=".9" fill="#fff"/>`).join('')}</g>
    <path d="M28 150 A132 118 0 0 1 292 150" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.2" stroke-dasharray="3 5"/>
    <circle id="ddSun" class="sun" r="12" fill="#ffe2a0" stroke="#e0a63a" stroke-width="1.2"/>
    <g filter="url(#wc)"><path d="M0 200 L0 150 C 60 128 110 156 170 140 C 230 124 270 148 320 138 L320 200Z" fill="#8fa886"/><path d="M0 200 L0 172 C 80 160 160 182 230 166 C 270 158 300 168 320 164 L320 200Z" fill="#5e7b57"/></g>
    <text id="ddSay" x="160" y="190" text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-weight="600" font-size="12.5" fill="#fbf8f0"></text>
  </svg>`;
  const setDay = (s) => {
    s = Math.max(0, Math.min(1.25, s));
    const day = 0.1 + 0.9 * s, sky = skyAt(day), night = nightAt(day);
    $('#ddTop').setAttribute('stop-color', rgb(sky.top));
    $('#ddHor').setAttribute('stop-color', rgb(sky.hor));
    $('#ddStars').setAttribute('opacity', night.toFixed(2));
    const a = Math.PI * (1 - Math.min(1, s));
    const sun = $('#ddSun');
    sun.setAttribute('cx', (160 + Math.cos(a) * 132).toFixed(1));
    sun.setAttribute('cy', (150 - Math.sin(a) * 118).toFixed(1));
    sun.setAttribute('opacity', s > 1.02 ? 0 : 1);
    const tok = s * D.meta.freeQuota;
    $('#ddSay').textContent = s < 0.06 ? 'Dawn · the folder lands' : s < 0.98 ? `${s < 0.5 ? 'Morning' : 'Afternoon'} · ${ktok(tok)} of ${ktok(D.meta.freeQuota)} tokens` : s < 1.04 ? 'Sunset · free budget spent' : `Night · ${ktok(tok)} tokens, overtime`;
  };
  const svg = dd.querySelector('svg');
  let dragging = false;
  const fromEvent = (e) => { const r = svg.getBoundingClientRect(); setDay(((e.clientX - r.left) / r.width * 320 - 28) / 264 * 1.0 + (e.clientX - r.left > r.width * 0.92 ? 0.2 : 0)); };
  svg.addEventListener('pointerdown', (e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromEvent(e); });
  svg.addEventListener('pointermove', (e) => dragging && fromEvent(e));
  svg.addEventListener('pointerup', () => { dragging = false; });
  setDay(0.32);

  // 3. made by hand, measured exactly
  const dh = $('#dHand');
  const g0 = R('kestrel', 'morenos_oh').grade;
  const w = 300 * g0.score;
  dh.innerHTML = `<div class="row"><span>Clean</span><svg viewBox="0 0 300 26"><rect x="0" y="5" width="${w.toFixed(1)}" height="16" rx="2" fill="#5c7d55"/></svg></div>
    <div class="row"><span>Painted</span><svg viewBox="0 0 300 26"><rect id="dhPaint" x="0" y="5" width="${w.toFixed(1)}" height="16" fill="#5c7d55" filter="url(#bristle)"/></svg></div>
    <div class="row"><span></span><svg viewBox="0 0 300 26"><path d="${roughLine(w, -56, w, 4, 5, .6)}" stroke="#a9503a" stroke-width="1.1" fill="none" filter="url(#pencil)"/><text x="${(w + 6).toFixed(1)}" y="4" font-family="Atkinson Hyperlegible Mono, monospace" font-size="11" fill="#5d544a">${money(g0.judged)}</text></svg></div>
    <div class="sw"><button class="toggle" role="switch" aria-checked="true" id="dhSw" aria-label="Brush texture"></button>Brush on. Both bars still end at the same dollar.</div>`;
  $('#dhSw').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
    e.currentTarget.setAttribute('aria-checked', on);
    $('#dhPaint').setAttribute('filter', on ? 'url(#bristle)' : '');
    e.currentTarget.nextSibling.textContent = on ? 'Brush on. Both bars still end at the same dollar.' : 'Brush off. Same length, colder page.';
  });

  // 4. weather says what happened
  $('#dWx').innerHTML = [['sun', 'Clear', 'finding things'], ['cloud', 'Cloud', 'read something empty'], ['rain', 'Rain', 'fell for a pitch'], ['moon', 'Night', 'past the free budget']]
    .map(([k, a, b]) => `<div><svg viewBox="0 0 40 40">${GLYPH[k]()}</svg><span><b>${a}</b>${b}</span></div>`).join('');

  // 6. one thing at a time
  const ot = D.worlds.morenos_oh && R('kestrel', 'morenos_oh').grade.chain.find((c) => c.id === 'ot_deduction');
  $('#dMore').innerHTML = `<div class="drawer"><div class="hd"><span>Overtime deduction</span><span class="num">${money(ot.value)}</span></div>
    <button aria-expanded="false"><svg viewBox="0 0 10 10"><path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>Show the math</button>
    <div class="bd"><div><p>${esc(ot.value_math)}</p><p class="cite">${esc(ot.cite)}</p></div></div></div>`;
  const dr = $('#dMore .drawer');
  dr.querySelector('button').addEventListener('click', (e) => {
    const open = !dr.hasAttribute('data-open');
    dr.toggleAttribute('data-open', open);
    e.currentTarget.setAttribute('aria-expanded', open);
    e.currentTarget.lastChild.textContent = open ? 'Hide the math' : 'Show the math';
  });
}

// ── A rollout is a day ────────────────────────────────────────
const WEIGHT = { deliver: 2.2, read: 1.4, search: 1.0, ask: 3.6, compute: 1.1, pin: 1.8, decoy: 2.6, well: 2.0, submit: 2.2, grill: 2.6, quota: 2.6, mail: 1.8 };
const FAC = { library: 'the IRS shelves', law: 'case law', portal: 'the portals', vault: 'the archive boxes', screen: 'old broadcasts', cabinet: 'the filing cabinet', inbox: 'the inbox' };

function day() {
  const hhSel = $('#dayHH'), agSel = $('#dayAgent');
  hhSel.innerHTML = D.hh.map((h) => `<option value="${h.id}">${esc(INTAKE[h.id].surname)}</option>`).join('');
  agSel.innerHTML = D.profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  agSel.value = 'kestrel';
  const WX = ['random', 'clear', 'fair', 'overcast', 'showers', 'fog', 'snow'];
  $('#dayWx').innerHTML = WX.map((k) => `<button class="chip" data-wx="${k}" aria-pressed="${k === 'random'}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('');
  const scene = new Scene($('#daySky'), { scale: 0.55, seed: 11.3 });
  const plant = new Plant($('#dayPlant'), { seed: 33 });
  holdButton($('#dayHold'), scene);
  const quota = D.meta.freeQuota;
  const P = { k: 0, playing: false, timer: null, wx: 'random' };

  const room = (e, W) => {
    if (e.kind === 'read' || e.kind === 'search') return PLACE[e.facility] || 'desk';
    if (e.kind === 'ask') return 'client';
    if (e.kind === 'decoy') return PLACE[W.documents.find((d) => d.id === e.doc)?.facility] || 'desk';
    if (e.kind === 'well') return PLACE[W.dry_wells.find((d) => d.id === e.well)?.facility] || 'desk';
    return 'desk';
  };
  const caller = (W) => (W.documents.find((d) => d.facility === 'phone')?.title.match(/Call with ([^(]+)/)?.[1] || 'the client').trim();
  const describe = (e, W) => {
    const doc = (id) => W.documents.find((d) => d.id === id);
    const opp = (id) => W.opportunities.find((o) => o.id === id);
    switch (e.kind) {
      case 'deliver': return `The folder lands on the desk: ${e.docs.length} documents.`;
      case 'read': return `${e.again ? 'Rereads' : 'Reads'} <b>${esc(doc(e.doc)?.title)}</b>.`;
      case 'search': return `Searches ${FAC[e.facility] || e.facility}${e.query ? ` for <b>${esc(e.query)}</b>` : ''}.`;
      case 'ask': return `Calls ${esc(caller(W))}${e.question ? `: <b>${esc(e.question)}</b>` : '.'}`;
      case 'compute': return 'Runs the 2025 return through the engine.';
      case 'pin': return e.opp === 'bogus' ? 'Writes down <b>a home-office deduction</b> with nothing behind it.' : `Writes down <b>${esc(opp(e.opp)?.title.split(' — ')[0])}</b>, ${money(e.claimed)}.`;
      case 'decoy': return e.fell ? 'Takes the bait.' : 'Reads a pitch and passes on it.';
      case 'well': return 'Digs through a stack that turns out to be nothing.';
      case 'submit': return e.pass === 2 ? 'Hands in the revised strategy.' : 'Hands in the strategy.';
      case 'grill': return 'The strategy comes back with questions. A second pass.';
      case 'quota': return 'Out of budget. What it wrote down is the strategy.';
      case 'mail': return `Sends the strategy to ${esc(caller(W))}.`;
      default: return '';
    }
  };
  const quote = (e, W) => {
    if (e.kind === 'ask') return (W.documents.find((d) => d.id === (e.docs || [])[0])?.text || '').replace(/^['‘“]|['’”]$/g, '');
    if (e.kind === 'decoy') return W.decoys.find((x) => x.id === e.decoy)?.lure || '';
    return '';
  };

  let run;
  const load = () => {
    stop();
    const hid = hhSel.value, pid = agSel.value;
    const { rollout, grade } = R(pid, hid);
    const W = D.worlds[hid];
    const tr = rollout.trace;
    const m = modelFrom(rollout, grade);
    plant.build(m);
    const plantIds = new Set(m.items.filter((i) => i.mark === 'full' || i.mark === 'partial').map((i) => i.id));
    const totalReads = Math.max(1, m.leaves), L = Math.min(16, m.leaves);
    let reads = 0, weeds = 0;
    const shown = new Set();
    const states = tr.map((e) => {
      if (e.kind === 'read' || e.kind === 'search') reads++;
      if (e.kind === 'pin' && plantIds.has(e.opp)) shown.add(e.opp);
      if ((e.kind === 'decoy' && e.fell) || (e.kind === 'pin' && e.opp === 'bogus')) weeds++;
      return { day: Math.min(1.22, 0.1 + 0.9 * e.cum / quota), leaves: Math.round(reads / totalReads * L), shown: new Set(shown), weeds: Math.min(3, weeds) };
    });
    const ws = tr.map((e) => WEIGHT[e.kind] || 1), sum = ws.reduce((a, b) => a + b, 0);
    const base = P.wx === 'random' ? Object.keys(WEATHER)[hashStr(hid + pid) % 6] : P.wx;
    run = { hid, pid, W, tr, grade, m, states, base, dur: ws.map((x) => Math.max(450, x / sum * 34000)), max: tr[tr.length - 1].cum };
    $('#dayRead').textContent = `${SKY_SAY[base][0].toUpperCase() + SKY_SAY[base].slice(1)}. ${tr.length} calls, ${ktok(run.max)} tokens.`;
    drawStrip();
    scene.set({ day: 0.11, ...WEATHER[base], glow: 0 }, { seconds: 1.5 });
    plant.grow({ h: 0 });
    $('#dayWhere').textContent = 'Before dawn';
    $('#dayLine').innerHTML = `The folder for ${esc(WHO[hid])} is on its way. Press play to watch ${esc(agentName(pid))} work through the day.`;
    $('#dayQuote').hidden = true;
    P.k = -1;
    playhead(-1);
  };

  const weatherFor = (e) => {
    const b = { ...WEATHER[run.base] }, o = { glow: 0 };
    if (e.kind === 'well') o.cloud = Math.min(1, b.cloud + 0.4);
    if (e.kind === 'decoy' && e.fell) { o.rain = Math.max(b.rain, 0.75); o.cloud = Math.max(b.cloud, 0.75); }
    if (e.kind === 'decoy' && !e.fell) o.cloud = Math.min(1, b.cloud + 0.18);
    if (e.kind === 'grill') { o.wind = 0.8; o.cloud = Math.min(1, b.cloud + 0.25); }
    if (e.kind === 'pin') o.glow = e.opp === 'bogus' ? 0 : 0.6;
    if (e.kind === 'ask') o.glow = 0.25;
    return { ...b, ...o };
  };

  const show = (k, secs = 1.4) => {
    P.k = k;
    const e = run.tr[k], st = run.states[k];
    scene.set({ day: st.day, ...weatherFor(e) }, { seconds: secs });
    const last = k === run.tr.length - 1;
    plant.grow({ h: Math.min(1, 0.08 + 0.92 * (k + 1) / run.tr.length), leaves: st.leaves, shown: st.shown, weeds: st.weeds, buds: last });
    const where = e.kind === 'compute' ? 'The engine' : PLACES.find((p) => p.id === room(e, run.W))?.name || '';
    $('#dayWhere').textContent = `${where} · ${ktok(e.cum)} tokens`;
    const line = $('#dayLine');
    line.classList.add('swap');
    setTimeout(() => { line.innerHTML = describe(e, run.W); line.classList.remove('swap'); }, 160);
    const q = quote(e, run.W);
    $('#dayQuote').hidden = !q;
    $('#dayQuote').textContent = q;
    playhead(k);
    if (last) setTimeout(() => {
      const g = run.grade, n = run.m.items.filter((i) => i.mark === 'full' || i.mark === 'partial').length, miss = run.m.items.filter((i) => i.mark === 'missed').length;
      $('#dayWhere').textContent = run.max > quota ? 'After dark' : 'Dusk';
      $('#dayLine').innerHTML = `${esc(agentName(run.pid))} wrote down ${n} things worth <b>${money(g.judged)}</b> of the ${money(g.bks)} we know is there for ${esc(WHO[run.hid])}.${miss ? ` The ${miss === 1 ? 'closed bud is the one thing' : `${miss} closed buds are what`} it never found.` : ''}`;
      $('#dayQuote').hidden = true;
      scene.set({ day: Math.max(st.day, 1.02), glow: 0, rain: WEATHER[run.base].rain, cloud: WEATHER[run.base].cloud }, { seconds: 4 });
      stop();
    }, 1200);
  };

  const stop = () => { clearTimeout(P.timer); P.playing = false; $('#dayPlay').innerHTML = PLAYI + 'Play'; };
  const PLAYI = '<svg viewBox="0 0 12 12"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>';
  const tick = () => {
    if (!P.playing) return;
    const k = P.k + 1;
    if (k >= run.tr.length) return stop();
    show(k);
    P.timer = setTimeout(tick, run.dur[k]);
  };
  $('#dayPlay').addEventListener('click', () => {
    if (P.playing) return stop();
    if (P.k >= run.tr.length - 1) load();
    P.playing = true;
    $('#dayPlay').innerHTML = '<svg viewBox="0 0 12 12"><path d="M3.5 2v8M8.5 2v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>Pause';
    tick();
  });
  hhSel.addEventListener('change', load);
  agSel.addEventListener('change', load);
  $('#dayWx').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wx]');
    if (!b) return;
    P.wx = b.dataset.wx;
    $$('#dayWx .chip').forEach((c) => c.setAttribute('aria-pressed', c === b));
    load();
  });

  // The day strip: the sky across the agent's day, one mark per call.
  let SW = 1000, X0 = 14, X1 = 986;
  const xOf = (cum) => X0 + (X1 - X0) * cum / run.dom;
  function drawStrip() {
    SW = Math.max(320, Math.round($('#dayStrip').clientWidth || 1000));
    X1 = SW - 14;
    run.dom = Math.max(quota * 1.12, run.max * 1.04);
    let stops = '';
    for (let i = 0; i <= 24; i++) {
      const s = i / 24, dd = 0.1 + 0.9 * (s * run.dom / quota), sk = skyAt(dd);
      stops += `<stop offset="${s}" stop-color="${rgb(sk.top.map((v, j) => v * 0.45 + sk.hor[j] * 0.55))}"/>`;
    }
    let marks = '', icons = '';
    run.tr.forEach((e, k) => {
      const x = xOf(e.cum - (e.tokens || 0) / 2);
      marks += `<rect data-k="${k}" x="${(x - .7).toFixed(1)}" y="40" width="1.4" height="16" fill="#fffdf6" opacity=".5"/>`;
      if (e.kind === 'pin' && e.opp !== 'bogus') {
        const c = run.grade.chain.find((x) => x.id === e.opp);
        icons += `<g transform="translate(${x.toFixed(1)} 24)">${head(c && c.mark !== 'none' ? c.mark : 'partial', c?.section || 'file', 7, e.opp)}</g>`;
      } else if (e.kind === 'pin' || (e.kind === 'decoy' && e.fell)) icons += `<g transform="translate(${x.toFixed(1)} 24)">${head('wrong', 'file', 9, 'w' + k)}</g>`;
      else if (e.kind === 'well') icons += `<g transform="translate(${(x - 10).toFixed(1)} 6) scale(.5)">${GLYPH.cloud()}</g>`;
      else if (e.kind === 'ask') icons += `<circle cx="${x.toFixed(1)}" cy="22" r="3" fill="none" stroke="#5d544a" stroke-width="1.2"/>`;
    });
    const sx = xOf(quota);
    $('#dayStrip').setAttribute('viewBox', `0 0 ${SW} 86`);
    $('#dayStrip').innerHTML = `<defs><linearGradient id="stripG">${stops}</linearGradient></defs>
      <rect x="${X0}" y="38" width="${X1 - X0}" height="20" fill="url(#stripG)" filter="url(#bristle)"/>
      <g id="stripMarks">${marks}</g>
      <g filter="url(#wc)">${icons}</g>
      <path d="${roughLine(sx, 34, sx, 64, 9, .5)}" stroke="#2e2923" stroke-width="1" stroke-dasharray="3 3" fill="none"/>
      <text x="${X0}" y="78" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="12" font-weight="500" fill="#8b8172">${SW < 640 ? 'Dawn' : 'Dawn · the folder lands'}</text>
      <text x="${sx}" y="78" text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="12" font-weight="500" fill="#8b8172">${SW < 640 ? 'Sunset' : `Sunset · ${ktok(quota)} free tokens`}</text>
      ${run.max > quota ? `<text x="${X1}" y="78" text-anchor="end" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="12" font-weight="500" fill="#8b8172">Overtime</text>` : ''}
      <g id="stripHead" style="transition:transform .9s cubic-bezier(.2,.8,.2,1)"><circle r="9" fill="#ffe7ae" stroke="#fffdf6" stroke-width="2.5"/><circle r="9" fill="none" stroke="#e0a63a" stroke-width="1"/></g>`;
  }
  function playhead(k) {
    const e = k >= 0 ? run.tr[k] : null;
    const x = e ? xOf(e.cum) : X0;
    const hd = $('#stripHead');
    hd.style.transform = `translate(${x}px, 48px)`;
    const night = e && e.cum > quota;
    hd.firstElementChild.setAttribute('fill', night ? '#d9d4ea' : '#ffe7ae');
    $$('#stripMarks rect').forEach((r) => r.setAttribute('opacity', +r.dataset.k <= k ? '.95' : '.45'));
  }
  $('#dayStrip').addEventListener('click', (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const cum = ((ev.clientX - r.left) / r.width * SW - X0) / (X1 - X0) * run.dom;
    let k = run.tr.findIndex((e) => e.cum >= cum);
    if (k < 0) k = run.tr.length - 1;
    stop();
    show(k, 0.8);
  });

  let sw0 = 0;
  new ResizeObserver(() => { const w = $('#dayStrip').clientWidth; if (run && Math.abs(w - sw0) > 4) { sw0 = w; drawStrip(); playhead(P.k); } }).observe($('#dayStrip'));
  $('#dayKey').innerHTML = `
    <div><dt><svg viewBox="0 0 40 40">${GLYPH.sun()}</svg></dt><dd><b>The sun</b> crosses as the agent spends tokens. Sunset is the free ${ktok(quota)}. Work after dark is overtime.</dd></div>
    <div><dt><svg viewBox="0 0 40 40">${GLYPH.leaf()}</svg></dt><dd><b>A leaf</b> for every source it reads.</dd></div>
    <div><dt>${glyph('full', 'file', 34)}</dt><dd><b>A flower</b> for each thing it writes down that holds up. Its area is that item's share of what the household could keep.</dd></div>
    <div><dt>${glyph('partial', 'open', 34)}</dt><dd><b>Half open</b>: right idea, wrong amount.</dd></div>
    <div><dt>${glyph('missed', 'file', 34)}</dt><dd><b>A closed bud</b>: there all along, never found. These appear at dusk.</dd></div>
    <div><dt><svg viewBox="0 0 40 40">${GLYPH.cloud()}</svg></dt><dd><b>Cloud</b> when it reads something with nothing in it.</dd></div>
    <div><dt><svg viewBox="0 0 40 40">${GLYPH.rain()}</svg></dt><dd><b>Rain</b> when it takes a bad pitch. <b>Thistles</b> grow at the rim for claims that won't hold.</dd></div>`;
  $('#daySw').innerHTML = Object.values(SECTION).map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  load();
}

// ── Materials ─────────────────────────────────────────────────
function materials() {
  const COLORS = [
    ['Oat paper', '#f2ede2', 'The page'], ['Ink', '#2e2923', 'Text, never pure black'], ['Leaf', '#5c7d55', 'Found, go, growth'],
    ['Marigold', '#e0a63a', 'This return, highlights'], ['Poppy', '#cf7651', 'Before April 15'], ['Cornflower', '#7d9dc8', 'Next year'],
    ['Sweet pea', '#cd8a96', 'Earlier years'], ['Thistle', '#8c7097', 'Claims that fail'], ['Rain', '#6f8daa', 'Quiet information'], ['Dusk', '#6d6488', 'Evening, overtime'],
  ];
  $('#swatches').innerHTML = COLORS.map(([n, c, r], i) => `<figure><svg viewBox="0 0 100 58" preserveAspectRatio="none"><g filter="url(#wc)"><path d="${blob(50, 29, 44, 23, i + 3, 8)}" fill="${c}" ${c === '#f2ede2' ? 'stroke="#d9cdb6" stroke-width="1.2"' : 'fill-opacity=".92"'}/></g></svg><figcaption>${n}<span>${c} · ${r}</span></figcaption></figure>`).join('');
  $('#texBrush').innerHTML = `<svg viewBox="0 0 300 150" preserveAspectRatio="none"><rect width="300" height="150" fill="#f6efe0"/><path d="M14 52 C 80 38 200 36 286 46 L284 78 C 200 86 90 88 16 82 Z" fill="#5c7d55" filter="url(#bristle)"/><path d="M20 104 C 90 96 190 96 270 102 L268 120 C 190 126 100 126 22 122 Z" fill="#e0a63a" filter="url(#bristle)"/></svg>`;
  $('#texPencil').innerHTML = `<svg viewBox="0 0 300 150"><rect width="300" height="150" fill="#f9f5ec"/><g fill="none" stroke="#2e2923" stroke-width="1.3" stroke-linecap="round" filter="url(#pencil)">
    <path d="${roughCircle(92, 72, 38, 5)}"/><path d="${roughRect(160, 38, 110, 66, 4)}"/><path d="${roughLine(30, 126, 270, 120, 8, 2)}"/></g></svg>`;
}

// ── Showing numbers ───────────────────────────────────────────
function hhTabs(host, onPick) {
  host.innerHTML = D.hh.map((h) => `<button class="tab" role="tab" data-h="${h.id}">${esc(INTAKE[h.id].surname)}</button>`).join('');
  host.addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b) onPick(b.dataset.h); });
  return () => $$('.tab', host).forEach((t) => t.setAttribute('aria-selected', t.dataset.h === S.hh));
}

function headline() {
  const sync = hhTabs($('#hlTabs'), (h) => { S.hh = h; update(); });
  subs.push(() => {
    sync();
    const { grade: g } = R();
    const sp = split(g);
    roll($('#hlBig'), money(g.judged));
    $('#hlTo').textContent = `back to ${WHO[S.hh]}`;
    $('#hlSub').innerHTML = `Of the ${money(g.bks)} we know is there, ${esc(agentName(S.agent))} found ${pct(g.score)}.${sp.wrong ? ` That's after taking back ${money(sp.wrong)} it claimed and shouldn't have.` : ''}`;
    bar4($('#hlBar'), sp);
    const by = Object.keys(SECTION).map((k) => {
      const rows = g.chain.filter((c) => c.section === k);
      return [k, rows.reduce((a, c) => a + Math.max(0, c.judged), 0), rows.reduce((a, c) => a + c.value, 0)];
    }).filter(([, , v]) => v > 0);
    $('#hlWhen').innerHTML = `<h4>When the money arrives</h4>${by.map(([k, j, v]) => `<div><i style="background:${SECTION[k].color}"></i><span>${SECTION[k].name}</span><span class="num">${money(j)} <span>of ${money(v)}</span></span></div>`).join('')}`;
    $('#hlLegend').innerHTML = `<span><i style="background:#5c7d55"></i>Found <b class="num">${money(sp.found)}</b></span><span><i style="background:#a9c29f"></i>Part found <b class="num">${money(sp.part)}</b></span><span><i style="background:transparent;box-shadow:inset 0 0 0 1.2px #8b8172"></i>Not found <b class="num">${money(sp.miss)}</b></span>${sp.wrong ? `<span><i style="background:#a9503a"></i>Claimed wrongly <b class="num">${money(-sp.wrong)}</b></span>` : ''}`;
  });
}

function bar4(svg, sp) {
  const W = Math.max(300, Math.round(svg.clientWidth || 600)), k = (W - 4) / sp.bks;
  const a = sp.found * k, b = sp.part * k, c = sp.miss * k, w = sp.wrong * k;
  svg.setAttribute('viewBox', `0 0 ${W} 70`);
  svg.innerHTML = `
    <path d="${roughRect(2 + a + b, 6, Math.max(0, c - 2), 26, 3)}" fill="none" stroke="#8b8172" stroke-width="1.3" filter="url(#pencil)"/>
    <rect x="2" y="6" width="${a.toFixed(1)}" height="26" fill="#5c7d55" filter="url(#bristle)" style="transition:width .8s"/>
    <rect x="${(2 + a).toFixed(1)}" y="6" width="${b.toFixed(1)}" height="26" fill="#a9c29f" filter="url(#bristle)"/>
    ${w ? `<rect x="2" y="42" width="${w.toFixed(1)}" height="12" fill="#a9503a" filter="url(#bristle)"/>` : ''}
    <text x="2" y="${w ? 68 : 50}" font-family="Atkinson Hyperlegible Mono, monospace" font-size="12" fill="#8b8172">$0</text>
    <text x="${W - 2}" y="50" text-anchor="end" font-family="Atkinson Hyperlegible Mono, monospace" font-size="12" fill="#8b8172">${money(sp.bks)}</text>`;
}

function strategy() {
  subs.push(() => {
    const { rollout, grade } = R();
    const m = modelFrom(rollout, grade);
    $('#stTitle').textContent = `${agentName(S.agent)} for ${WHO[S.hh]}`;
    const W = D.worlds[S.hh];
    const title = (it) => it.mark === 'wrong' ? (W.decoys.find((d) => `w_${d.id}` === it.id)?.lure?.split(/[—:.]/)[0] || 'A claim with nothing behind it') : it.title.split(' — ')[0];
    $('#stItems').innerHTML = m.items.map((it) => `<li class="${it.mark}">${glyph(it.mark, it.section, 30)}
      <div class="t">${esc(title(it))}<span>${it.mark === 'wrong' ? 'Doesn’t hold up' : it.mark === 'missed' ? `Never found · ${SECTION[it.section].name}` : SECTION[it.section].name}</span></div>
      <div class="a">${it.mark === 'missed' ? money(it.value) : money(it.judged)}${it.mark === 'partial' ? `<span>of ${money(it.value)}</span>` : ''}</div></li>`).join('');
  });
}

function table() {
  const wrap = $('#cmpWrap');
  const tb = $('#cmp');
  const ps = D.profiles;
  const tabs = $('#cmpMetric');
  tabs.innerHTML = '<button class="tab" data-m="share">Share found</button><button class="tab" data-m="dollars">Dollars</button>';
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { S.metric = b.dataset.m; update(); } });
  const draw = () => {
    $$('.tab', tabs).forEach((t) => t.setAttribute('aria-selected', t.dataset.m === S.metric));
    const cell = (g) => S.metric === 'share' ? [pct(g.score), money(g.judged)] : [money(g.judged), pct(g.score)];
    const rows = D.hh.map((h) => {
      const vals = ps.map((p) => R(p.id, h.id).grade);
      const best = Math.max(...vals.map((g) => g.score));
      return `<tr><th scope="row">${esc(INTAKE[h.id].surname)}<span>${esc(INTAKE[h.id].place)}</span></th>${vals.map((g) => { const [v, s] = cell(g); return `<td class="${g.score === best ? 'best' : ''}"><span class="v">${v}</span><span class="s">${s}</span></td>`; }).join('')}</tr>`;
    });
    const tot = ps.map((p) => { let j = 0, b = 0; D.hh.forEach((h) => { const g = R(p.id, h.id).grade; j += g.judged; b += g.bks; }); return { score: j / b, judged: j }; });
    const bestT = Math.max(...tot.map((t) => t.score));
    rows.push(`<tr class="all"><th scope="row">All five<span>Pooled dollars</span></th>${tot.map((t) => { const [v, s] = cell(t); return `<td class="${t.score === bestT ? 'best' : ''}"><span class="v">${v}</span><span class="s">${s}</span></td>`; }).join('')}</tr>`);
    tb.innerHTML = `<thead><tr><th></th>${ps.map((p) => `<th scope="col" data-a="${p.id}" class="${p.id === S.agent ? 'sel' : ''}">${esc(p.name)}<em>${p.human ? 'a person' : 'simulated'}</em></th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
    requestAnimationFrame(place);
  };
  const hl = document.createElement('div');
  hl.className = 'hl';
  hl.innerHTML = '<div class="wash"></div><svg></svg>';
  wrap.prepend(hl);
  const place = () => {
    const th = tb.querySelector(`th[data-a="${S.agent}"]`);
    if (!th) return;
    const x = th.offsetLeft + tb.offsetLeft, w = th.offsetWidth, h = tb.offsetHeight;
    hl.style.width = `${w}px`;
    hl.style.height = `${h}px`;
    hl.style.transform = `translateX(${x}px)`;
    const svg = hl.querySelector('svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = `<path d="${roughRect(2, 3, w - 4, h - 6, hashStr(S.agent) % 50)}" fill="none" stroke="#2e2923" stroke-width="1.2" stroke-linecap="round" filter="url(#pencil)"/>`;
  };
  tb.addEventListener('click', (e) => { const th = e.target.closest('th[data-a]'); if (th) { S.agent = th.dataset.a; update(); } });
  new ResizeObserver(() => place()).observe(tb);
  document.fonts?.ready.then(place);
  subs.push(draw);
}

function quotes() {
  const ids = D.hh.map((h) => h.id);
  const sync = hhTabs($('#qTabs'), (h) => { S.hh = h; update(); });
  $('#qTrack').innerHTML = ids.map((id) => {
    const W = D.worlds[id];
    const call_ = W.documents.find((d) => d.facility === 'phone');
    const txt = (call_?.text || '').replace(/^['‘“]|['’”]$/g, '');
    return `<article class="qcard" data-h="${id}"><div class="cell q"><div class="k">In their words</div><blockquote>“${esc(txt)}”</blockquote></div>
      <div class="cell"><div class="k">From</div><div class="v">${esc(FROM[id][0])}<span>${esc(FROM[id][1])}</span></div></div>
      <div class="cell"><div class="k">Where it was</div><div class="v">Only on the phone<span>Not in the folder they handed over.</span></div></div></article>`;
  }).join('');
  $('#qTrack').addEventListener('click', (e) => { const c = e.target.closest('.qcard'); if (c && c.dataset.h !== S.hh) { S.hh = c.dataset.h; update(); } });
  const place = () => {
    const i = ids.indexOf(S.hh);
    const cards = $$('.qcard');
    cards.forEach((c, k) => c.classList.toggle('on', k === i));
    const step = cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
    $('#qTrack').style.transform = `translateX(${-i * step}px)`;
  };
  addEventListener('resize', place);
  subs.push(() => { sync(); place(); });
}

function scatter() {
  const rows = D.lb.rows;
  const L = 44, Rr = 16, T = 18, B = 44;
  const xmax = Math.max(2, Math.max(...rows.map((r) => r.quotaShare)) * 1.08);
  let W = 520, H = 360;
  const x = (v) => L + (W - L - Rr) * v / xmax, y = (v) => T + (H - T - B) * (1 - v);
  let stops = '';
  for (let i = 0; i <= 20; i++) { const s = i / 20, sk = skyAt(0.1 + 0.9 * s * xmax); stops += `<stop offset="${s}" stop-color="${rgb(sk.top.map((v, j) => v * .4 + sk.hor[j] * .6))}"/>`; }
  const draw = () => {
    W = Math.max(300, Math.round($('#scatter').clientWidth || 520));
    H = Math.round(Math.min(380, Math.max(300, W * 0.7)));
    // Labels sit beside their dots; any two whose boxes would touch get pushed apart.
    const lab = rows.map((r) => {
      const right = r.quotaShare > xmax * 0.75, cx = x(r.quotaShare), w = r.name.length * 7.2 + 4;
      return { id: r.id, x0: right ? cx - 12 - w : cx + 12, x1: right ? cx - 12 : cx + 12 + w, y: y(r.score) + 4 };
    });
    lab.sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) for (let j = 0; j < i; j++) {
      const a = lab[j], b = lab[i];
      if (a.x0 < b.x1 && b.x0 < a.x1 && b.y - a.y < 14) b.y = a.y + 14;
    }
    const LY = Object.fromEntries(lab.map((l) => [l.id, l.y]));
    const pts = rows.map((r, i) => {
      const cx = x(r.quotaShare), cy = y(r.score), sel = r.id === S.agent;
      const lx = cx + (r.quotaShare > xmax * 0.75 ? -12 : 12), anchor = r.quotaShare > xmax * 0.75 ? 'end' : 'start';
      return `<g class="pt" data-a="${r.id}"><title>${esc(r.name)}: ${pct(r.score)} found, ${ktok(r.tokens)} tokens per household</title>
        ${sel ? `<path d="${roughCircle(cx, cy, 15, i + 4)}" fill="none" stroke="#2e2923" stroke-width="1.2" filter="url(#pencil)"/>` : ''}
        <g filter="url(#wc)"><path d="${r.human ? `M${cx - 6} ${cy - 6} h12 v12 h-12 Z` : blob(cx, cy, 7, 7, i + 2, 7)}" fill="${r.human ? '#e0a63a' : '#5c7d55'}" fill-opacity=".9"/></g>
        <text x="${lx}" y="${LY[r.id]}" text-anchor="${anchor}">${esc(r.name)}</text></g>`;
    }).join('');
    $('#scatter').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share found against tokens used">
      <defs><linearGradient id="scG">${stops}</linearGradient></defs>
      <rect x="${L}" y="${T}" width="${W - L - Rr}" height="${H - T - B}" rx="6" fill="url(#scG)" opacity=".55"/>
      <g class="ax">${[0, .25, .5, .75, 1].map((v) => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${pct(v)}</text><path d="M${L} ${y(v)} H${W - Rr}" stroke="rgba(46,41,35,.08)"/>`).join('')}
        ${[0, 0.5, 1, 1.5, 2].filter((v) => v <= xmax).map((v) => `<text x="${x(v)}" y="${H - B + 18}" text-anchor="middle">${ktok(v * D.meta.freeQuota)}</text>`).join('')}
        <text x="${L}" y="${H - 6}">Tokens per household →</text>
        <path d="${roughLine(x(1), T, x(1), H - B, 5, 1)}" stroke="#2e2923" stroke-dasharray="3 4" fill="none"/>
        <text x="${x(1) + 6}" y="${H - B - 8}" fill="#fbf8f0">Sunset · free budget</text></g>
      ${pts}</svg>`;
  };
  new ResizeObserver(() => draw()).observe($('#scatter'));
  $('#scatter').addEventListener('click', (e) => { const p = e.target.closest('[data-a]'); if (p && D.grid[p.dataset.a]) { S.agent = p.dataset.a; update(); } });
  subs.push(draw);
}

function garden() {
  const chips = $('#gChips');
  chips.innerHTML = D.profiles.map((p) => `<button class="chip" data-a="${p.id}">${esc(p.name)}</button>`).join('');
  chips.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) { S.agent = b.dataset.a; update(); } });
  const bed = $('#bed');
  bed.innerHTML = D.hh.map((h) => `<button class="pot" data-h="${h.id}"><div class="pl"></div><span class="cap">${esc(INTAKE[h.id].surname)}<span></span></span></button>`).join('');
  const plants = D.hh.map((h, i) => new Plant($(`.pot[data-h="${h.id}"] .pl`, bed), { seed: 40 + i * 7, label: INTAKE[h.id].surname }));
  bed.addEventListener('click', (e) => { const b = e.target.closest('.pot'); if (b) { S.hh = b.dataset.h; update(); } });
  let shownFor = null;
  subs.push(() => {
    $$('.chip', chips).forEach((c) => c.setAttribute('aria-pressed', c.dataset.a === S.agent));
    $$('.pot', bed).forEach((p) => p.setAttribute('aria-pressed', p.dataset.h === S.hh));
    if (shownFor === S.agent) return;
    shownFor = S.agent;
    D.hh.forEach((h, i) => {
      const { rollout, grade } = R(S.agent, h.id);
      const m = modelFrom(rollout, grade);
      plants[i].build(m);
      $(`.pot[data-h="${h.id}"] .cap span`, bed).innerHTML = `${money(grade.judged)}<em> of ${money(grade.bks)}</em>`;
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => plants[i].full(m), i * 140)));
    });
  });
}
