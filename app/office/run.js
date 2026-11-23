// The rollout, played back. No character: the agent is an instrument. A
// reticle moves between the rooms it works in, the film takes on each room's
// light, the clock runs, and the strategy fills in on the right as it pins.
import { PLACE, PLACES } from './intake.js';
import { roomMood } from './sky.js';
import { usd, ktok } from '../ui/figures.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WEIGHT = { deliver: 2.2, read: 1.5, search: 1.0, ask: 3.8, compute: 1.2, pin: 1.7, decoy: 2.6, well: 2.0, submit: 2.4, grill: 2.8, quota: 2.8, mail: 1.8 };
const TOTAL = 42;
const SHORT = { desk: 'Desk', portals: 'Portal', library: 'Library', law: 'Law', news: 'News', archive: 'Archive', client: 'Client' };
const FACILITY = { library: 'the IRS shelves', law: 'case law', portal: 'the portals', vault: 'the archive boxes', screen: 'old broadcasts', cabinet: 'the filing cabinet', inbox: 'the inbox' };

export class Run {
  constructor(sky) {
    this.sky = sky;
    this.$ = (s) => document.querySelector(s);
    const rooms = this.$('#rooms');
    rooms.innerHTML = PLACES.map((p) => `<span data-room="${p.id}" data-s="${SHORT[p.id].slice(0, 3)}">${SHORT[p.id]}</span>`).join('') + '<i class="reticle" id="reticle"></i>';
    this.timer = null;
  }

  start(world, rollout, grade, profile, onDone) {
    this.W = world; this.r = rollout; this.g = grade; this.p = profile; this.onDone = onDone;
    this.k = 0;
    this.done = false;
    const tr = rollout.trace;
    const w = tr.map((e) => WEIGHT[e.kind] || 1);
    const sum = w.reduce((a, b) => a + b, 0);
    this.dur = w.map((x) => Math.max(0.6, (x / sum) * TOTAL) * 1000);
    this.$('#runpins').innerHTML = '';
    this.$('#runpins').dataset.head = 'Strategy';
    this.$('#runline').textContent = '';
    this.$('#runquote').textContent = '';
    this.$('#runroom').textContent = '';
    this.$('#rooms').querySelectorAll('span').forEach((s) => s.classList.remove('on', 'seen'));
    this.drawTicks();
    this.sky.clockSpeed = 1 / 7;
    this.step();
  }

  drawTicks() {
    const tr = this.r.trace, max = tr[tr.length - 1].cum || 1;
    let s = '<rect x="0" y="12" width="1000" height="1" fill="rgba(250,249,245,.22)"/><rect id="tprog" x="0" y="12" width="0" height="1" fill="#faf9f5"/>';
    tr.forEach((e, i) => {
      const x = ((e.cum - (e.tokens || 0) / 2) / max) * 1000;
      const h = ['pin', 'ask', 'submit', 'grill'].includes(e.kind) ? 12 : e.kind === 'decoy' ? 12 : 6;
      const c = e.kind === 'decoy' && e.fell ? '#f2a88e' : e.kind === 'grill' ? '#f2a88e' : 'rgba(250,249,245,.5)';
      s += `<rect class="tk" data-i="${i}" x="${x.toFixed(1)}" y="${12.5 - h / 2}" width="1.3" height="${h}" fill="${c}" opacity=".35"/>`;
    });
    const svg = this.$('#ticks');
    svg.setAttribute('viewBox', '0 0 1000 25');
    svg.innerHTML = s;
  }

  step() {
    const tr = this.r.trace;
    if (this.k >= tr.length) return this.finish();
    const e = tr[this.k];
    this.show(e);
    this.timer = setTimeout(() => { this.k++; this.step(); }, this.dur[this.k]);
  }

  room(e) {
    const W = this.W;
    if (e.kind === 'read' || e.kind === 'search') return PLACE[e.facility] || 'desk';
    if (e.kind === 'ask') return 'client';
    if (e.kind === 'decoy') return PLACE[W.documents.find((d) => d.id === e.doc)?.facility] || 'desk';
    if (e.kind === 'well') return PLACE[W.dry_wells.find((d) => d.id === e.well)?.facility] || 'desk';
    return 'desk';
  }

  show(e) {
    const room = this.room(e);
    const tr = this.r.trace;
    this.sky.set(roomMood(e.kind === 'compute' ? 'engine' : room), { seconds: 1.5 });
    this.sky.clockSpeed = e.kind === 'compute' ? 1.2 : 1 / 7;
    const label = e.kind === 'compute' ? 'Engine' : (PLACES.find((p) => p.id === room)?.name || '').replace(/^The /, '');
    this.$('#runroom').textContent = label;
    const line = this.$('#runline');
    line.classList.add('swap');
    setTimeout(() => { line.innerHTML = this.describe(e); line.classList.remove("swap"); }, 120);
    this.$('#runquote').textContent = this.quote(e);
    // the reticle and the rooms
    const spans = [...this.$('#rooms').querySelectorAll('span')];
    const idx = PLACES.findIndex((p) => p.id === room);
    spans.forEach((s, i) => { if (s.classList.contains('on')) s.classList.add('seen'); s.classList.toggle('on', i === idx); });
    const sp = spans[idx];
    this.$('#reticle').style.left = `${sp.offsetLeft + sp.offsetWidth / 2}px`;
    // the clock along the bottom
    const max = tr[tr.length - 1].cum || 1;
    this.$('#tprog').setAttribute('width', ((e.cum / max) * 1000).toFixed(1));
    const tk = this.$('#ticks').querySelector(`.tk[data-i="${this.k}"]`);
    if (tk) tk.setAttribute('opacity', '1');
    this.$('#runcalls').textContent = `${this.k + 1} / ${tr.length} calls`;
    this.$('#runtok').textContent = `${ktok(e.cum)} tokens`;
    // the strategy as it's written
    const pins = this.$('#runpins');
    if (e.kind === 'pin') {
      const o = this.W.opportunities.find((x) => x.id === e.opp);
      pins.insertAdjacentHTML('beforeend', `<li><span>${esc(o ? o.title.split(' — ')[0] : 'Home-office deduction, no source')}</span><span>${usd(e.claimed)}</span></li>`);
    } else if (e.kind === 'decoy' && e.fell) {
      const d = this.W.decoys.find((x) => x.id === e.decoy);
      pins.insertAdjacentHTML('beforeend', `<li class="lure"><span>${esc(shorten(d?.lure || 'A decoy'))}</span><span>?</span></li>`);
    } else if (e.kind === 'grill') {
      pins.dataset.head = 'Strategy · second pass';
    }
    while (pins.children.length > 9) pins.firstElementChild.remove();
  }

  describe(e) {
    const W = this.W;
    const doc = (id) => W.documents.find((d) => d.id === id);
    const opp = (id) => W.opportunities.find((o) => o.id === id);
    const first = (W.members[0]?.name || 'the client').split(' ')[0];
    switch (e.kind) {
      case 'deliver': return `The folder lands on the desk. ${e.docs.length} documents.`;
      case 'read': return `${e.again ? 'Rereads' : 'Reads'} <b>${esc(doc(e.doc)?.title)}</b>`;
      case 'search': return `Searches ${FACILITY[e.facility] || e.facility}${e.query ? ` for <b>${esc(e.query)}</b>` : ''}.`;
      case 'ask': return `Calls ${esc(first)}. <b>${esc(e.question || '')}</b>`;
      case 'compute': return 'Runs the 2025 return through the engine.';
      case 'pin': return e.opp === 'bogus' ? 'Writes down <b>a home-office deduction</b> with nothing behind it.' : `Writes down <b>${esc(opp(e.opp)?.title)}</b>, ${usd(e.claimed)}.`;
      case 'decoy': return e.fell ? 'Takes the bait.' : 'Reads it and passes.';
      case 'well': return 'Digs through a stack that turns out to be nothing.';
      case 'submit': return e.pass === 2 ? 'Submits the revised strategy.' : 'Submits the strategy.';
      case 'grill': return 'The strategy comes back with flags. Second pass.';
      case 'quota': return 'Out of budget. Whatever is pinned is the strategy.';
      case 'mail': return `Sends the strategy to ${esc(first)}.`;
      default: return '';
    }
  }

  quote(e) {
    const W = this.W;
    if (e.kind === 'ask') {
      const t = W.documents.find((d) => d.id === (e.docs || [])[0])?.text;
      return t ? `“${t.replace(/^['‘“]|['’”]$/g, '')}”` : '';
    }
    if (e.kind === 'decoy') return `“${W.decoys.find((x) => x.id === e.decoy)?.lure || ''}”`;
    if (e.kind === 'well') return W.dry_wells.find((x) => x.id === e.well)?.title || '';
    return '';
  }

  skip() {
    clearTimeout(this.timer);
    this.finish();
  }

  stop() {
    clearTimeout(this.timer);
    this.done = true;
    this.sky.clockSpeed = 1 / 240;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    clearTimeout(this.timer);
    this.sky.clockSpeed = 1 / 240;
    setTimeout(() => this.onDone?.(), 900);
  }
}

function shorten(s) {
  const t = s.split(/[—:]/)[0].trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}
