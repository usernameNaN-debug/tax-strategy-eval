import { call } from './api.js';
import { Stage } from './pixel/stage.js';
import { ROOM } from './pixel/layout.js';
import { resample } from '../src/world/macro.js';
import { usd, pct, ktok, chainDots, reachBars, anytime, slope, fingerprint, pareto, eloBar } from './ui/figures.js';
import { VERSION } from './version.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = { household: 'morenos_oh', agent: 'kestrel', toured: false, world: null, rollout: null, grade: null, revealed: false };
let stage, pm, meta, households, profiles, macro;

const ROOM_LABEL = { overview: '', office: 'Office', library: 'Library', portals: 'Portals', news: 'News room', archive: 'Basement', lobby: 'Lobby', home: 'Client' };
const FACILITY = { library: 'the IRS shelves', law: 'case law', portal: 'the portals', vault: 'the basement boxes', screen: 'old broadcasts', cabinet: 'the filing cabinet', inbox: 'the inbox' };
const STATUS = { used: 'used in the strategy', forgot: 'read, then dropped', 'never-money': 'never opened, and it held money', seen: 'read, nothing in it', unread: 'never opened' };

// ------------------------------------------------------------------ boot
async function boot() {
  $('#version').textContent = `v${VERSION}`;
  [meta, households, profiles, macro] = await Promise.all([call('meta'), call('households'), call('profiles'), call('macro')]);
  const marketX = resample(macro.index, 480);
  stage = new Stage($('#stage'), { marketX, macro });
  pm = new Stage($('#pm'), { marketX, macro });
  pm.speed = 0;
  renderPickers();
  wireControls();
  wireToc();
  stage.on('event', onEvent);
  stage.on('tick', onTick);
  stage.on('play', (p) => setPlayIcon(p));
  stage.on('end', () => { setPlayIcon(false); reveal(); });
  stage.on('view', () => onEvent(stage.lastEvent));
  pm.on('hover', (h) => { $('#pmcap').innerHTML = h ? `<b>${esc(h.doc.title)}</b> · ${STATUS[h.status] || STATUS.unread}` : ''; });
  pm.on('view', (v) => { $('#pmback').hidden = v === 'overview'; });
  stage.on('hover', (h) => { if (stage.mode !== 'replay' || !stage.playing) $('#caption').innerHTML = h ? `<b>${esc(h.doc.title)}</b>` : ''; });
  loadLeaderboard();
  window.tse = { stage, pm, state };
}

// ---------------------------------------------------------------- pickers
function renderPickers() {
  const box = $('#households');
  box.innerHTML = households.map((h) => `
    <button class="hh" data-id="${h.id}" aria-pressed="${h.id === state.household}">
      <span class="name">${esc(h.name)}</span>
      <span class="brief">${esc(h.brief)}</span>
      <span class="meta">${h.filing_status.toUpperCase()} · ${h.state} · ${h.members.length} ${h.members.length === 1 ? 'person' : 'people'}</span>
    </button>`).join('');
  box.onclick = (e) => {
    const b = e.target.closest('.hh');
    if (!b) return;
    state.household = b.dataset.id;
    box.querySelectorAll('.hh').forEach((x) => x.setAttribute('aria-pressed', x === b));
  };
  const ag = $('#agents');
  ag.innerHTML = profiles.map((p) => `<button class="pill small" data-id="${p.id}" aria-pressed="${p.id === state.agent}" title="${esc(p.note)}">${p.human ? `<em>${esc(p.name)}</em>` : esc(p.name)}</button>`).join('');
  ag.onclick = (e) => {
    const b = e.target.closest('.pill');
    if (!b) return;
    selectAgent(b.dataset.id);
  };
  $('#go').onclick = () => (state.toured ? run() : tour(run));
  $('#tour').onclick = () => tour();
}

function selectAgent(id) {
  state.agent = id;
  $('#agents').querySelectorAll('.pill').forEach((x) => x.setAttribute('aria-pressed', x.dataset.id === id));
  document.querySelectorAll('.board tr[data-id]').forEach((tr) => tr.classList.toggle('mine', tr.dataset.id === id));
}

// ------------------------------------------------------------------ tour
const TOUR = [
  { rooms: [ROOM.office, ROOM.lobby], text: 'The folder lands on the desk. Everything else is a walk away.' },
  { rooms: [ROOM.library], text: 'Upstairs: IRS publications on the left, case law on the right.' },
  { rooms: [ROOM.portals, ROOM.news], text: 'Employer, bank and brokerage portals, and the year on the news.' },
  { rooms: [ROOM.archive], text: 'The basement keeps old returns nobody has opened in years.' },
  { rooms: [ROOM.home], text: 'Some facts only the client knows. You have to call.' },
];
let tourTimer = null;
function tour(then) {
  state.toured = true;
  stage.idle();
  clearTimeout(tourTimer);
  $('#stagefig').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  const cap = $('#tourcap');
  cap.classList.add('on');
  $('#tourdots').innerHTML = TOUR.map(() => '<i></i>').join('');
  let i = 0;
  const done = () => {
    clearTimeout(tourTimer);
    cap.classList.remove('on');
    stage.spotlight(null);
    if (then) then();
  };
  const step = () => {
    if (i >= TOUR.length) return done();
    stage.spotlight(TOUR[i].rooms);
    $('#tourtext').textContent = TOUR[i].text;
    [...$('#tourdots').children].forEach((d, k) => d.classList.toggle('on', k === i));
    i++;
    tourTimer = setTimeout(step, 2400);
  };
  $('#tourskip').onclick = done;
  step();
}

// ------------------------------------------------------------------- run
async function run() {
  const [world, res] = await Promise.all([call('world', state.household), call('rollout', { household: state.household, profile: state.agent, seed: 0 })]);
  state.world = world; state.rollout = res.rollout; state.grade = res.grade; state.revealed = false;
  state.lastSubmit = res.rollout.trace.map((e) => e.kind).lastIndexOf('submit');
  if (state.lastSubmit < 0) state.lastSubmit = res.rollout.trace.length - 1;
  stage.setHousehold(world);
  stage.load(res.rollout, res.grade);
  drawTicks();
  $('#report').innerHTML = '<p class="waiting">The strategy shows up here when the agent submits it.</p>';
  $('#pmwrap').hidden = true; $('#pmwait').hidden = false;
  stage.play();
}

function reveal() {
  if (state.revealed || !state.grade) return;
  state.revealed = true;
  renderReport();
  renderPostmortem();
}

// --------------------------------------------------------------- controls
function wireControls() {
  $('#play').onclick = () => { if (!stage.timeline) return state.toured ? run() : tour(run); stage.toggle(); };
  document.querySelectorAll('[data-speed]').forEach((b) => b.onclick = () => setSpeed(+b.dataset.speed));
  const sc = $('#scrub');
  sc.oninput = () => { if (stage.timeline) { stage.pause(); stage.seek((sc.value / 1000) * stage.timeline.duration); } };
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') && e.target.id !== 'scrub') return;
    if (!stage.timeline) return;
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); stage.toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stage.pause(); stage.seekEvent(Math.min(stage.timeline.marks.length - 1, stage.lastEvent + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stage.pause(); stage.seekEvent(Math.max(0, stage.lastEvent - 1)); }
    else if (['1', '2', '4'].includes(e.key)) setSpeed(+e.key);
  });
  $('#xray').onclick = () => { const v = $('#xray').getAttribute('aria-pressed') !== 'true'; $('#xray').setAttribute('aria-pressed', v); pm.setXray(v); };
  $('#pmback').onclick = () => pm.openRoom('overview');
}

function setSpeed(s) {
  stage.setSpeed(s);
  document.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.speed === s));
}

function setPlayIcon(p) {
  $('#playicon').innerHTML = p ? '<rect x="2.5" y="1.5" width="3.2" height="11"/><rect x="8.3" y="1.5" width="3.2" height="11"/>' : '<path d="M3 1.5v11l9-5.5z"/>';
  $('#play').setAttribute('aria-label', p ? 'Pause' : 'Play');
}

const TICK = { read: ['var(--soft)', 8], search: ['var(--line)', 6], ask: ['var(--blue)', 14], pin: ['var(--blue)', 12], compute: ['var(--ink)', 6], decoy: ['var(--ochre)', 14], well: ['var(--soft)', 10], grill: ['var(--rose)', 18], submit: ['var(--ink)', 18], quota: ['var(--rose)', 18], deliver: ['var(--ink)', 10], mail: ['var(--ink)', 10] };
function drawTicks() {
  const tl = stage.timeline;
  const svg = $('#ticks');
  svg.setAttribute('viewBox', '0 0 1000 34');
  let s = '<rect x="0" y="16" width="1000" height="2" fill="var(--line)"/><rect id="prog" x="0" y="16" width="0" height="2" fill="var(--ink)"/>';
  for (const m of tl.marks) {
    const [c, h] = TICK[m.kind] || ['var(--soft)', 6];
    const x = (m.t / tl.duration) * 1000;
    s += `<rect x="${x.toFixed(1)}" y="${17 - h / 2}" width="1.6" height="${h}" fill="${c}"/>`;
  }
  s += '<rect id="head" x="0" y="4" width="2" height="26" fill="var(--ink)"/>';
  svg.innerHTML = s;
}

function onTick(t) {
  const tl = stage.timeline;
  if (!tl) return;
  const x = (t / tl.duration) * 1000;
  $('#scrub').value = Math.round(x);
  const prog = $('#prog'), head = $('#head');
  if (prog) prog.setAttribute('width', x.toFixed(1));
  if (head) head.setAttribute('x', (x - 1).toFixed(1));
  const done = stage.lastEvent + 1, total = tl.marks.length;
  $('#readout').textContent = `${done}/${total} calls · ${ktok(stage.tokensAt(t))} tokens`;
}

function onEvent(k) {
  const r = state.rollout;
  if (!r || !stage.timeline) return;
  const m = stage.timeline.marks[k];
  const e = m ? r.trace[m.i] : null;
  if (m && m.i >= state.lastSubmit) reveal();
  const view = stage.view;
  const room = ROOM_LABEL[view] ? `<span class="room">${ROOM_LABEL[view]}</span>` : '';
  $('#caption').innerHTML = e ? room + describe(e) : '';
}

function describe(e) {
  const W = state.world;
  const doc = (id) => W.documents.find((d) => d.id === id);
  const opp = (id) => W.opportunities.find((o) => o.id === id);
  const first = (W.members[0]?.name || 'the client').split(' ')[0];
  switch (e.kind) {
    case 'deliver': return `The folder arrives: ${e.docs.length} documents.`;
    case 'read': return `${e.again ? 'Rereads' : 'Reads'} <b>${esc(doc(e.doc)?.title)}</b>`;
    case 'search': return `Searches ${FACILITY[e.facility] || e.facility}.`;
    case 'ask': return `Calls ${esc(first)}.`;
    case 'compute': return 'Runs the numbers.';
    case 'pin': {
      if (e.opp === 'bogus') return `Writes down <b>a home-office deduction</b> with no source behind it.`;
      return `Writes down <b>${esc(opp(e.opp)?.title)}</b> · ${usd(e.claimed)}`;
    }
    case 'decoy': {
      const d = W.decoys.find((x) => x.id === e.decoy);
      return e.fell ? `Takes the bait: <b>${esc(d?.lure)}</b>` : `Passes on: ${esc(d?.lure)}`;
    }
    case 'well': return `Digs through <b>${esc(W.dry_wells.find((w) => w.id === e.well)?.title)}</b>. Nothing there.`;
    case 'submit': return e.pass === 2 ? 'Submits the revised strategy.' : 'Submits the strategy.';
    case 'grill': return 'The binder comes back flagged. Second pass.';
    case 'quota': return 'Out of budget. Whatever is on the board is the strategy.';
    case 'mail': return `Mails the strategy to ${esc(first)}.`;
    default: return '';
  }
}

// ----------------------------------------------------------------- report
const SECTION = {
  file: 'File with the 2025 return',
  open: 'Still open',
  missed: 'Missed in 2025',
  next: 'For 2026',
};
function renderReport() {
  const g = state.grade, W = state.world;
  const days = Math.round((Date.UTC(2026, 3, 15) - Date.UTC(2026, 2, 1)) / 864e5);
  const mark = { full: '●', partial: '◐', none: '○', wrong: '✕' };
  let html = `<div class="headline enter"><span class="big num">${usd(g.judged)}</span><span class="of">of ${usd(g.bks)} best known · ${pct(g.score)}</span></div>`;
  if (state.rollout.exhausted) html += '<p class="note">It ran out of budget before submitting. This is what was on the board.</p>';
  html += '<div class="memo enter"><div class="colhead"><span></span><span></span><span>claimed</span><span>worth</span></div>';
  for (const sec of g.sections) {
    const live = sec.rows.filter((r) => r.mark !== 'none').sort((a, b) => b.value - a.value);
    const ghost = sec.rows.filter((r) => r.mark === 'none').sort((a, b) => b.value - a.value);
    const sub = sec.section === 'open' ? `<span>${days} days to April 15</span>` : '';
    html += `<h3>${SECTION[sec.section]}${sub}</h3>`;
    const claimedOf = (id) => g.items.find((it) => it.id === id)?.claimed;
    for (const r of [...live, ...ghost]) {
      const c = claimedOf(r.id);
      html += `<div class="row ${r.mark === 'none' ? 'ghost' : ''}" tabindex="0">
        <span class="m m-${r.mark}">${mark[r.mark]}</span><span class="t">${esc(r.title)}</span>
        <span class="c">${c != null ? usd(c) : '—'}</span><span class="v">${usd(r.mark === 'none' ? r.value : r.judged)}</span>
        <span class="more">${esc(r.value_math || '')}${r.cite ? `<br>${esc(r.cite)}` : ''}${r.legality === 'gray' ? '<br>Gray area: depends on facts the file only partly shows.' : ''}</span></div>`;
    }
    for (const it of sec.wrong) {
      const d = W.decoys.find((x) => x.id === it.id);
      const title = d ? d.lure : it.title || 'Unsourced claim';
      html += `<div class="row wrong" tabindex="0"><span class="m m-wrong">✕</span><span class="t">${esc(title)}</span>
        <span class="c">${usd(it.claimed)}</span><span class="v">${usd(it.judged)}</span>
        <span class="more">${esc(d ? d.why_wrong : 'No source in the building supports this.')}</span></div>`;
    }
  }
  html += '</div><p class="note">● claimed at the right amount · ◐ right idea, wrong number · ○ never written down · ✕ wrong. Click a line for the math.</p>';
  if (g.pass2) html += `<figure>${slope(g)}<figcaption>The binder came back with flags and the agent took a second pass. Claimed is what it said the strategy saves; judged is what the engine says.</figcaption></figure>`;
  const el = $('#report');
  el.innerHTML = html;
  el.querySelectorAll('.row').forEach((r) => { r.onclick = () => r.classList.toggle('open'); r.onkeydown = (e) => { if (e.key === 'Enter') r.classList.toggle('open'); }; });
}

// -------------------------------------------------------------- postmortem
function renderPostmortem() {
  const g = state.grade;
  $('#pmwrap').hidden = false; $('#pmwait').hidden = true;
  pm.setHousehold(state.world);
  pm.load(state.rollout, g);
  pm.setMode('postmortem');
  pm.setXray($('#xray').getAttribute('aria-pressed') === 'true');
  const harvest = g.harvestMissed ? ' In X-ray the April dip on the news screen turns green: losses were there to harvest.' : '';
  $('#pmlegend').innerHTML = `<b style="color:var(--blue)">Blue flags</b> are sources the strategy used, <b style="color:var(--rose)">rose</b> ones it read and dropped, and dotted outlines ones it never opened that held money. X-ray shows the money. The cat sleeps where the agent spent the most time. Click a room to go in.${harvest}`;
  const rows = [...g.chain].sort((a, b) => (a.breakAt ? 0 : 1) - (b.breakAt ? 0 : 1) || b.value - a.value);
  $('#chain').innerHTML = `<table class="chain"><tbody>${rows.map((r) => `
    <tr class="${r.breakAt ? '' : 'got'}"><td>${esc(r.title)}</td><td>${chainDots(r)}</td>
    <td class="v">${r.breakAt ? `${usd(Math.max(0, r.judged))} / ${usd(r.value)}` : usd(r.value)}</td><td class="why">${r.breakAt || ''}</td></tr>`).join('')}</tbody></table>
    <p class="note">The four dots: saw a clue, went looking, read the source, wrote it down at the right amount.</p>`;
  $('#reach').innerHTML = `${reachBars(g.byLayer)}<figcaption>Dollars found, by how far the source sat from the folder.</figcaption>`;
  $('#anytime').innerHTML = `${anytime(state.rollout.trace, state.world, g, meta.freeQuota)}<figcaption>Dollars found as tokens are spent. Ticks below are tool calls.</figcaption>`;
}

// ------------------------------------------------------------- leaderboard
async function loadLeaderboard() {
  let lb = null;
  try { const r = await fetch('data/leaderboard.json', { cache: 'no-store' }); if (r.ok) lb = await r.json(); } catch { /* fall back */ }
  if (!lb) lb = await call('leaderboard');
  const rows = lb.rows;
  $('#pareto').innerHTML = `${pareto(rows, lb.freeQuota)}<figcaption>Each agent's average over every household. Filled points are on the frontier: nothing else is both cheaper and better.</figcaption>`;
  $('#pareto').querySelectorAll('g[data-id]').forEach((gEl) => gEl.onclick = () => watch(gEl.dataset.id));
  const lo = Math.min(...rows.map((r) => r.lo)), hi = Math.max(...rows.map((r) => r.hi));
  $('#board').innerHTML = `<table class="board"><thead><tr><th>#</th><th>Agent</th><th>Elo</th><th class="r">Best known</th><th class="r hide-s">Tokens</th><th class="r hide-s">Decoys</th><th class="hide-s"></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr data-id="${r.id}" class="${r.human ? 'human' : ''} ${r.id === state.agent ? 'mine' : ''}">
      <td class="num">${i + 1}</td>
      <td><span class="who">${esc(r.name)}</span><span class="why">${esc(r.note)}</span></td>
      <td><span class="num">${Math.round(r.elo)}</span><br>${eloBar(r, lo, hi)}</td>
      <td class="r"><span class="num">${pct(r.score)}</span><span class="why">from ${pct(r.pass1)}</span></td>
      <td class="r hide-s">${r.human ? '—' : `${r.quotaShare.toFixed(1)}×`}${r.cutoff > 0 ? `<span class="why">cut off ${pct(r.cutoff)}</span>` : ''}</td>
      <td class="r hide-s">${r.decoyRate.toFixed(2)}</td>
      <td class="hide-s">${fingerprint(r)}</td></tr>`).join('')}</tbody></table>`;
  $('#board').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => watch(tr.dataset.id));
  $('#boardnote').textContent = `Bradley–Terry on paired rollouts (same household, same seed), with 90% bootstrap intervals; ${lb.households} households × ${lb.seeds} seeds. "From" is the score before the grill pass. The fingerprint is capture by distance from the folder, a dot for decoys taken, and an arrow for what grilling added. Every agent here is simulated.`;
}

function watch(id) {
  selectAgent(id);
  $('#rollout').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  setTimeout(() => (state.toured ? run() : tour(run)), reduced ? 0 : 450);
}

// --------------------------------------------------------------------- toc
function wireToc() {
  const links = [...document.querySelectorAll('#toc a')];
  const nav = [...document.querySelectorAll('.top nav a')];
  const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
  const update = () => {
    let cur = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.35) cur = i; });
    links.forEach((a, i) => a.toggleAttribute('aria-current', i === cur));
    nav.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === links[cur].getAttribute('href')));
    $('#toc').style.setProperty('--dot', `${links[cur].offsetTop + links[cur].offsetHeight / 2 - 2}px`);
    // Step aside when a wide figure scrolls under the contents.
    const t = $('#toc').getBoundingClientRect();
    const hit = [...document.querySelectorAll('.wide')].some((w) => {
      const b = w.getBoundingClientRect();
      return b.left < t.right + 12 && b.top < t.bottom && b.bottom > t.top && b.height > 0;
    });
    $('.toc').classList.toggle('away', hit);
  };
  addEventListener('scroll', update, { passive: true });
  update();
}

boot();
