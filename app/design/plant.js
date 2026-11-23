// A potted plant that grows out of a rollout. Leaves are sources read.
// Flowers are things the agent wrote down: area is the item's share of what
// the household could keep, color is when the money arrives. Buds that never
// open are what it missed. Thistles at the rim are claims that don't hold.
import { rng, hashStr, SECTION } from './ink.js';

const W = 200, H = 272;
const f = (n) => n.toFixed(1);
const darker = (hex, k = 0.72) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c.join(',')})`;
};
export const radius = (share) => Math.max(4.5, Math.min(24, 23 * Math.sqrt(Math.max(0, share))));

// One flower head at the origin, facing up. Used on plants and in lists.
export function head(mark, section, r, id = '') {
  const c = (SECTION[section] || SECTION.file).color, dk = darker(c);
  const h = hashStr(id);
  if (mark === 'missed') {
    const b = Math.max(5, r * 0.62);
    return `<path d="M0 1 C ${f(-b * .55)} ${f(-b * .25)} ${f(-b * .32)} ${f(-b)} 0 ${f(-b * 1.3)} C ${f(b * .32)} ${f(-b)} ${f(b * .55)} ${f(-b * .25)} 0 1Z" fill="#e2dfcb" stroke="#9b977f" stroke-width=".9" stroke-dasharray="2.2 1.6"/>
      <path d="M0 1 C -3 -1 -4 -3 -4.5 -5 M0 1 C 3 -1 4 -3 4.5 -5" stroke="#7f9a76" stroke-width="1.1" fill="none"/>`;
  }
  if (mark === 'wrong') {
    const s = Math.max(5, r * 0.5);
    let spikes = '';
    for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI; spikes += `M${f(Math.cos(a) * s * .7)} ${f(Math.sin(a) * s * .7 - s * .4)} L${f(Math.cos(a) * s * 1.55)} ${f(Math.sin(a) * s * 1.55 - s * .4)} `; }
    return `<path d="${spikes}" stroke="#8c7097" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M${f(-s * .8)} 0 C ${f(-s * .9)} ${f(-s)} ${f(s * .9)} ${f(-s)} ${f(s * .8)} 0 Z" fill="#b49ac0" stroke="#7a5f86" stroke-width=".8"/>
      <path d="M${f(-s * .7)} 1 L${f(s * .7)} 1 L0 ${f(s * .9)} Z" fill="#7f9a76"/>`;
  }
  const k = 5 + (h % 3);
  const rot0 = (h % 40) - 20;
  const partial = mark === 'partial';
  let petals = '';
  if (partial) {
    for (let j = 0; j < k - 1; j++) {
      const a = -160 + (140 / (k - 2)) * j;
      petals += `<ellipse cx="${f(r * .48)}" cy="0" rx="${f(r * .48)}" ry="${f(r * .25)}" transform="rotate(${f(a)})"/>`;
    }
  } else {
    for (let j = 0; j < k; j++) petals += `<ellipse cx="${f(r * .52)}" cy="0" rx="${f(r * .52)}" ry="${f(r * .29)}" transform="rotate(${f(rot0 + (360 / k) * j)})"/>`;
  }
  return `<g fill="${c}" fill-opacity="${partial ? .55 : .82}" stroke="${dk}" stroke-opacity=".55" stroke-width=".8">${petals}</g>
    <circle r="${f(Math.max(1.8, r * .26))}" fill="#b9862c" fill-opacity=".9"/>`;
}

export function glyph(mark, section, size = 30) {
  return `<svg viewBox="-15 -17 30 30" width="${size}" height="${size}" aria-hidden="true"><g filter="url(#wc)">${head(mark, section, 10, section + mark)}</g></svg>`;
}

export class Plant {
  constructor(host, { seed = 1, label = '' } = {}) {
    this.host = host;
    this.seed = seed;
    this.label = label;
  }

  // model: { items: [{id, share, mark, section}], leaves }
  build(model) {
    const R = rng(this.seed);
    const items = model.items.filter((i) => i.mark !== 'wrong');
    const weeds = model.items.filter((i) => i.mark === 'wrong').slice(0, 3);
    const n = items.length;
    const base = [100, 210];
    const tall = 150 + (R() - 0.5) * 12;
    const P = [base, [100 + (R() - .5) * 28, 210 - tall * .36], [100 + (R() - .5) * 34, 210 - tall * .72], [100 + (R() - .5) * 20, 210 - tall]];
    const at = (t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };
    const tan = (t) => { const u = 1 - t; return [0, 1].map((k) => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])); };
    const ang = (t) => { const d = tan(t); return Math.atan2(d[1], d[0]) * 180 / Math.PI; };

    const L = Math.min(16, model.leaves);
    const s0 = R() < 0.5 ? 1 : -1;
    let leaves = '';
    for (let j = 0; j < L; j++) {
      const t = 0.05 + 0.84 * (j + 0.5) / Math.max(L, 1);
      const side = j % 2 ? s0 : -s0;
      const [x, y] = at(t);
      const a = ang(t) + side * (64 + R() * 16);
      const l = (13 + R() * 8) * (1 - t * 0.35);
      leaves += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"><g class="grow" data-t="${f(t)}" data-j="${j}">
        <path d="M0 0 C ${f(l * .25)} ${f(-l * .34)} ${f(l * .7)} ${f(-l * .38)} ${f(l)} 0 C ${f(l * .7)} ${f(l * .3)} ${f(l * .25)} ${f(l * .3)} 0 0Z" fill="${j % 3 ? '#8fae86' : '#7c9d72'}" fill-opacity=".9" stroke="#5c7d55" stroke-width=".8"/>
        <path d="M${f(l * .08)} 0 L${f(l * .8)} 0" stroke="#5c7d55" stroke-width=".6" opacity=".7"/></g></g>`;
    }

    let flowers = '';
    items.forEach((it, i) => {
      const t = 0.27 + 0.7 * (i + 0.5) / Math.max(n, 1);
      const side = i % 2 ? -s0 : s0;
      const [x, y] = at(t);
      const r = radius(it.share);
      const a = side * (26 + R() * 26);
      const ls = 13 + R() * 10 + r * 0.45;
      const stalk = it.mark === 'missed' ? '#a5b59b' : '#5c7d55';
      flowers += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" data-id="${it.id}" data-t="${f(t)}">
        <path class="draw" pathLength="1" d="M0 0 Q ${f(-side * 4)} ${f(-ls / 2)} 0 ${f(-ls)}" stroke="${stalk}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <g transform="translate(0 ${f(-ls)}) rotate(${f(-a * 0.7)})"><g class="grow" style="transition-delay:.35s">${head(it.mark, it.section, r, it.id)}</g></g>
      </g>`;
    });

    let thistles = '';
    weeds.forEach((wd, i) => {
      const x = [74, 127, 86][i], lean = [-14, 12, -4][i];
      thistles += `<g transform="translate(${x} 207) rotate(${lean})" data-w="${i}"><g class="grow">
        <path d="M0 0 C -2 -8 2 -16 0 -24" stroke="#7a8f6c" stroke-width="1.3" fill="none"/>
        <path d="M0 -8 l-6 -3 l3 3 l-5 1 l8 1 M0 -14 l6 -3 l-3 3 l5 1 l-8 1" stroke="#7a8f6c" stroke-width="1" fill="#93a585"/>
        <g transform="translate(0 -24)">${head('wrong', 'file', 11, wd.id)}</g></g></g>`;
    });

    const stake = this.label ? `<g filter="url(#wc)"><path d="M138 214 L146 162" stroke="#b49b74" stroke-width="3" stroke-linecap="round"/>
      <g transform="translate(148 156) rotate(5)"><rect x="-28" y="-11" width="56" height="20" rx="4" fill="#f7f0de" stroke="#a8977a" stroke-width=".9"/></g></g>
      <text x="148" y="160" transform="rotate(5 148 156)" text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-weight="600" font-size="11" fill="#2e2923">${this.label}</text>` : '';

    this.host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <ellipse cx="100" cy="266" rx="44" ry="4.5" fill="rgba(70,45,25,.16)"/>
      <ellipse cx="100" cy="206" rx="36" ry="4" fill="#5d4838"/>
      <g filter="url(#wc)">
        <path class="stem" pathLength="1" d="M${f(P[0][0])} ${f(P[0][1])} C${f(P[1][0])} ${f(P[1][1])} ${f(P[2][0])} ${f(P[2][1])} ${f(P[3][0])} ${f(P[3][1])}" stroke="#5c7d55" stroke-width="2.6" fill="none" stroke-linecap="round" style="stroke-dasharray:1 1;stroke-dashoffset:1;transition:stroke-dashoffset 1.2s cubic-bezier(.3,.7,.2,1)"/>
        ${leaves}
        <g transform="translate(${f(P[3][0])} ${f(P[3][1])}) rotate(${f(ang(1) + 90)})"><g class="grow" data-tip><path d="M0 1 C -3 -2 -2.5 -7 0 -9 C 2.5 -7 3 -2 0 1Z" fill="#8fae86" stroke="#5c7d55" stroke-width=".8"/></g></g>
        ${flowers}
        ${thistles}
      </g>
      ${stake}
      <g filter="url(#wc)">
        <path d="M66 216 L134 216 L127 262 Q100 266 73 262 Z" fill="#c77a55"/>
        <path d="M71 222 L77 258" stroke="#e0a07c" stroke-width="3" stroke-linecap="round" opacity=".7"/>
        <path d="M60 205 Q100 202 140 205 L141 217 Q100 220 59 217 Z" fill="#b8673f"/>
        <path d="M62 207 Q100 204.5 138 207" stroke="#d58d66" stroke-width="1.4" fill="none" opacity=".8"/>
      </g>
    </svg>`;
    this.svg = this.host.firstElementChild;
    this.stem = this.svg.querySelector('.stem');
    this.leafEls = [...this.svg.querySelectorAll('[data-j]')];
    this.flowerEls = [...this.svg.querySelectorAll('[data-id]')];
    this.weedEls = [...this.svg.querySelectorAll('[data-w]')];
    this.tip = this.svg.querySelector('[data-tip]');
    this.items = items;
    return this;
  }

  // state: { h: 0..1, leaves, shown: Set of ids, buds: bool, weeds: n }
  grow({ h = 0, leaves = 0, shown = new Set(), buds = false, weeds = 0 }) {
    let top = h;
    this.flowerEls.forEach((g) => {
      const it = this.items.find((x) => x.id === g.dataset.id);
      const on = it.mark === 'missed' ? buds : shown.has(it.id);
      if (on) top = Math.max(top, +g.dataset.t + 0.05);
      g.querySelector('.draw').classList.toggle('on', on);
      g.querySelector('.grow').classList.toggle('on', on);
    });
    top = Math.min(1, top);
    this.stem.style.strokeDashoffset = String(1 - top);
    this.leafEls.forEach((el) => el.classList.toggle('on', +el.dataset.j < leaves && +el.dataset.t <= top + 0.02));
    this.weedEls.forEach((el) => el.firstElementChild.classList.toggle('on', +el.dataset.w < weeds));
    this.tip.classList.toggle('on', top > 0.97);
  }

  full(model) {
    this.grow({ h: 1, leaves: Math.min(16, model.leaves), shown: new Set(model.items.map((i) => i.id)), buds: true, weeds: 3 });
  }
}

// Turn a graded rollout into a plant model.
export function modelFrom(rollout, grade) {
  const bks = grade.bks || 1;
  const found = new Map();
  const order = [];
  for (const e of rollout.trace) {
    if (e.kind === 'pin' && e.opp !== 'bogus' && !found.has(e.opp)) { found.set(e.opp, true); order.push(e.opp); }
  }
  const chain = new Map(grade.chain.map((c) => [c.id, c]));
  const items = [];
  for (const id of order) {
    const c = chain.get(id);
    if (!c || c.mark === 'none') continue;
    items.push({ id, share: c.value / bks, mark: c.mark, section: c.section, title: c.title, value: c.value, judged: c.judged });
  }
  for (const c of grade.chain) if (c.mark !== 'none' && !found.has(c.id)) items.push({ id: c.id, share: c.value / bks, mark: c.mark, section: c.section, title: c.title, value: c.value, judged: c.judged });
  for (const c of grade.chain) if (c.mark === 'none') items.push({ id: c.id, share: c.value / bks, mark: 'missed', section: c.section, title: c.title, value: c.value, judged: 0 });
  for (const it of grade.items) if (it.mark === 'wrong') items.push({ id: `w_${it.id}`, share: Math.abs(it.judged) / bks, mark: 'wrong', section: it.section, title: it.id, value: it.claimed, judged: it.judged });
  const reads = rollout.trace.filter((e) => e.kind === 'read' || e.kind === 'search').length;
  return { items, leaves: reads };
}
