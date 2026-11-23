// The office page. Four states, in order:
//   landing  — the intro and the reel; scroll freely, nothing is unlocked
//   world    — fixed over the page: pick a folder, then explore or start a rollout
//   run      — the rollout plays inside the world
//   after    — a hero you scroll out of, then the reading, with contents
import { call } from '../api.js';
import { Sky } from './sky.js';
import { Files } from './folders.js';
import { Run } from './run.js';
import { explore, result } from './sections.js';
import { VERSION } from '../version.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v'];

const S = { step: 'landing', hh: null, agent: 'kestrel', kind: null };
let sky, files, run, meta, profiles, macro, worlds;

async function boot() {
  $('#version').textContent = `v${VERSION}`;
  sky = new Sky($('#sky'));
  wireScroll();
  [meta, profiles, macro] = await Promise.all([call('meta'), call('profiles'), call('macro')]);
  const list = await call('households');
  worlds = await Promise.all(list.map((h) => call('world', h.id)));
  const want = new URLSearchParams(location.hash.slice(1)).get('agent');
  if (want && profiles.some((p) => p.id === want)) S.agent = want;
  $('#agent').innerHTML = profiles.map((p) => `<option value="${p.id}"${p.id === S.agent ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  $('#agent').onchange = (e) => { S.agent = e.target.value; };
  files = new Files($('#files'), worlds, { onOpen: opened });
  run = new Run(sky);
  $('#enter').onclick = enter;
  $('#hold').onclick = () => {
    sky.running = !sky.running;
    $('#hold').setAttribute('aria-label', sky.running ? 'Pause the background' : 'Play the background');
    $('#hold').innerHTML = sky.running
      ? '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx=".6" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9.4" y="3" width="2.6" height="10" rx=".6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
      : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.6 8z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  };
  $('#back').onclick = back;
  $('#leave').onclick = leave;
  $('#go').onclick = startRollout;
  $('#explore').onclick = () => toExplore();
  $('#skip').onclick = () => run.skip();
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#world').hidden) (S.step === 'dossier' ? back() : leave());
  });
  window.office = { S, sky, files, run };
}

// ------------------------------------------------------------- scrolling
let lastY = 0;
function wireScroll() {
  const top = $('#top');
  const onScroll = () => {
    const y = scrollY;
    const down = y > lastY + 2, up = y < lastY - 2;
    if (!document.documentElement.classList.contains('locked')) {
      if (down && y > 90) top.classList.add('hide');
      else if (up || y < 90) top.classList.remove('hide');
    }
    lastY = y;
    if (S.step === 'landing') reel();
    if (S.step === 'after') {
      const h = $('#hero').offsetHeight;
      top.classList.toggle('dark', y < h - 40);
      sidebar();
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { if (S.step === 'landing') reel(); });
  reel();
}

// The reel grows from a card to the whole window as it reaches the top.
function reel() {
  const r = $('#reel').getBoundingClientRect();
  const vh = innerHeight;
  const p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (vh * 0.8)));
  const e = p * p * (3 - 2 * p);
  const ix = (1 - e) * Math.max(16, innerWidth * 0.04);
  const f = $('#frame');
  f.style.setProperty('--ix', `${ix.toFixed(1)}px`);
  f.style.setProperty('--ir', `${((1 - e) * 10).toFixed(1)}px`);
  S.reelInset = ix;
}

// ------------------------------------------------------------- the world
function lock(on) {
  document.documentElement.classList.toggle('locked', on);
  $('#top').classList.toggle('hide', on);
}

function film(where) {
  const c = $('#sky');
  if (c.parentElement !== where) where.appendChild(c);
}

function show(el, on) { el.classList.toggle('shown', on); }

async function enter() {
  if (!files) return;
  $('#enter').classList.add('gone');
  const f = $('#frame').getBoundingClientRect();
  const ix = S.reelInset || 0, vw = innerWidth, vh = innerHeight;
  const top = Math.max(0, f.top), bottom = Math.max(0, vh - f.bottom), side = ix;
  const w = $('#world');
  w.hidden = false;
  w.style.transition = 'none';
  w.style.opacity = '1';
  w.style.clipPath = `inset(${top}px ${side}px ${bottom}px ${side}px round ${Math.max(0, (ix / Math.max(16, vw * 0.04)) * 10)}px)`;
  film($('#film'));
  lock(true);
  w.offsetWidth;
  w.style.transition = 'clip-path 1s cubic-bezier(.65,0,.2,1)';
  w.style.clipPath = 'inset(0px 0px 0px 0px round 0px)';
  sky.set('files', { seconds: 2.6 });
  [$('#filesay'), $('#choose'), $('#run')].forEach((el) => el.classList.add('fade'));
  $('#back').classList.add('off');
  await wait(650);
  toFiles();
}

function toFiles() {
  S.step = 'files'; S.hh = null;
  $('#wtitle').textContent = '';
  $('#back').classList.add('off');
  show($('#choose'), false);
  show($('#run'), false);
  show($('#filesay'), true);
  files.show();
}

function opened(id) {
  S.step = 'dossier'; S.hh = id;
  show($('#filesay'), false);
  $('#back').classList.remove('off');
  $('#wtitle').textContent = worlds.find((w) => w.id === id).name;
  setTimeout(() => { if (S.step === 'dossier') show($('#choose'), true); }, 1500);
}

function back() {
  if (S.step !== 'dossier') return;
  show($('#choose'), false);
  $('#back').classList.add('off');
  $('#wtitle').textContent = '';
  S.step = 'files';
  files.close(() => show($('#filesay'), true));
}

async function leave() {
  run.stop();
  const w = $('#world');
  w.style.transition = 'opacity .6s';
  w.style.opacity = '0';
  await wait(600);
  w.hidden = true;
  w.style.opacity = '1';
  $('#after').hidden = true;
  $('#landing').hidden = false;
  film($('#frame'));
  sky.set('reel', { seconds: 1.2 });
  S.step = 'landing';
  lock(false);
  $('#enter').classList.remove('gone');
  const r = $('#reel');
  scrollTo({ top: r.offsetTop, behavior: 'instant' });
  reel();
}

// --------------------------------------------------------------- rollout
async function startRollout() {
  const id = S.hh;
  show($('#choose'), false);
  $('#back').classList.add('off');
  files.dismiss();
  const W = worlds.find((w) => w.id === id);
  const p = profiles.find((x) => x.id === S.agent);
  $('#wtitle').textContent = `${p.name} · ${W.name}`;
  S.step = 'run';
  const res = await call('rollout', { household: id, profile: S.agent, seed: 0 });
  S.res = res;
  await wait(500);
  show($('#run'), true);
  run.start(W, res.rollout, res.grade, p, () => toAfter('result'));
}

async function toExplore() {
  show($('#choose'), false);
  $('#back').classList.add('off');
  files.dismiss();
  S.step = 'leaving';
  await wait(700);
  toAfter('explore');
}

// ----------------------------------------------------------------- after
async function toAfter(kind) {
  const W = worlds.find((w) => w.id === S.hh);
  const p = profiles.find((x) => x.id === S.agent);
  const doc = kind === 'explore' ? explore(W, macro) : result(W, S.res.rollout, S.res.grade, p, meta, (e) => run.describe(e));
  S.kind = kind;
  sky.set(kind, { seconds: 2.4 });
  show($('#run'), false);
  build(doc, kind);
  const w = $('#world');
  const fromWorld = !w.hidden;
  $('#landing').hidden = true;
  $('#after').hidden = false;
  scrollTo({ top: 0, behavior: 'instant' });
  if (fromWorld) {
    await wait(900);
    film($('#herofilm'));
    w.style.transition = 'opacity .7s';
    w.style.opacity = '0';
    await wait(700);
    w.hidden = true;
    w.style.opacity = '1';
  } else film($('#herofilm'));
  S.step = 'after';
  lock(false);
  $('#top').classList.add('dark');
  rise();
}

function build(doc, kind) {
  const W = worlds.find((w) => w.id === S.hh);
  $('#heroeye').textContent = doc.eye;
  $('#herotitle').textContent = doc.title;
  $('#herotoc').innerHTML = doc.toc.map((t, i) => `<li><a href="#${t.id}"><span class="n">${ROMAN[i]}</span><span class="t">${esc(t.label)}</span><span class="lead"></span><span class="v">${esc(t.v)}</span></a></li>`).join('');
  [$('#heroeye'), $('#herotitle'), ...$('#herotoc').children].forEach((el) => { el.classList.remove('rise'); el.style.opacity = '0'; });
  const other = kind === 'explore'
    ? `<button class="pill dark" id="again-run">Start a rollout on ${esc(W.name)}</button>`
    : `<button class="pill dark" id="again-explore">Explore ${esc(W.name)}</button>`;
  $('#article').innerHTML = `<p class="lede">${doc.lede}</p>${doc.sections.map((s) => `<section id="${s.id}"><h2>${esc(s.title)}</h2>${s.html}</section>`).join('')}
    <div class="ends">${other}<button class="pill line" id="again-pick">Pick another household</button></div>`;
  doc.wire($('#article'));
  $('#sidelinks').innerHTML = doc.toc.map((t) => `<a href="#${t.id}">${esc(t.label)}</a>`).join('');
  $('#herotoc').querySelectorAll('a').forEach((a) => a.onclick = (e) => { e.preventDefault(); $(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }); });
  $('#sidelinks').querySelectorAll('a').forEach((a) => a.onclick = (e) => { e.preventDefault(); $(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }); });
  $('#again-pick').onclick = () => reenter(() => toFiles());
  if ($('#again-run')) $('#again-run').onclick = () => reenter(() => { S.step = 'dossier'; files.openId = null; startRollout(); });
  if ($('#again-explore')) $('#again-explore').onclick = async () => {
    await fadeAfter();
    toAfter('explore');
  };
}

function rise() {
  const els = [$('#heroeye'), $('#herotitle'), ...$('#herotoc').children];
  els.forEach((el, i) => { el.style.opacity = ''; el.style.animationDelay = `${0.15 + i * 0.12}s`; el.classList.add('rise'); });
}

async function fadeAfter() {
  const els = [$('#heroeye'), $('#herotitle'), ...$('#herotoc').children];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await wait(500);
  els.forEach((el) => { el.classList.remove('rise'); el.style.transition = 'opacity .5s'; el.style.opacity = '0'; });
  await wait(500);
  els.forEach((el) => { el.style.transition = ''; });
}

// Back into the world from the reading.
async function reenter(then) {
  const w = $('#world');
  scrollTo({ top: 0, behavior: 'smooth' });
  await wait(450);
  lock(true);
  w.hidden = false;
  w.style.clipPath = 'none';
  w.style.transition = 'none';
  w.style.opacity = '0';
  [$('#filesay'), $('#choose'), $('#run')].forEach((el) => { el.classList.add('fade'); el.classList.remove('shown'); });
  files.els.forEach((el) => el.classList.add('hidden'));
  w.offsetWidth;
  w.style.transition = 'opacity .7s';
  w.style.opacity = '1';
  sky.set('files', { seconds: 2 });
  await wait(700);
  film($('#film'));
  $('#after').hidden = true;
  S.step = 'files';
  then();
}

// ------------------------------------------------------------- contents
function sidebar() {
  const side = $('#side');
  const art = $('#article');
  const links = [...$('#sidelinks').querySelectorAll('a')];
  if (!links.length) return;
  const a = art.getBoundingClientRect();
  side.classList.toggle('on', a.top < innerHeight * 0.5 && a.bottom > innerHeight * 0.3);
  const secs = links.map((l) => document.querySelector(l.getAttribute('href')));
  let cur = 0;
  secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
  links.forEach((l, i) => l.toggleAttribute('aria-current', i === cur));
  $('#sidelinks').style.setProperty('--dot', `${links[cur].offsetTop + links[cur].offsetHeight / 2 - 2}px`);
}

boot();
