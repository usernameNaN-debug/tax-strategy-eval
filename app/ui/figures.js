import { judgeItem } from '../../src/engine/grader.js';

// Small SVG figures. Each takes plain data and returns an SVG string sized by
// viewBox, so it scales with its column.

export const usd = (v, { sign = false } = {}) => {
  const s = Math.round(Math.abs(v)).toLocaleString('en-US');
  return `${v < 0 ? '−' : sign && v > 0 ? '+' : ''}$${s}`;
};
export const pct = (v) => `${Math.round(v * 100)}%`;
export const ktok = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Four steps of the chain: noticed a clue, went looking, read the source, acted.
export function chainDots(row) {
  const steps = [row.clue, row.looked, row.source, row.acted && row.mark === 'full'];
  const brokeAt = steps.findIndex((s) => !s);
  const dx = 18;
  let out = `<svg viewBox="0 0 ${dx * 3 + 12} 12" width="${dx * 3 + 12}" height="12" aria-hidden="true">`;
  out += `<line x1="6" y1="6" x2="${6 + dx * (brokeAt < 0 ? 3 : brokeAt)}" y2="6" stroke="var(--blue-m)" stroke-width="1.5"/>`;
  steps.forEach((s, i) => {
    const cx = 6 + i * dx;
    if (brokeAt >= 0 && i === brokeAt) out += `<circle cx="${cx}" cy="6" r="4" fill="var(--paper)" stroke="var(--rose)" stroke-width="1.5"/>`;
    else if (brokeAt >= 0 && i > brokeAt) out += `<circle cx="${cx}" cy="6" r="2" fill="var(--line)"/>`;
    else out += `<circle cx="${cx}" cy="6" r="4" fill="var(--blue)"/>`;
  });
  return out + '</svg>';
}

// Share of available dollars captured, by distance from the folder.
export function reachBars(byLayer) {
  const names = ['folder', 'one hop', 'deep', 'ask'];
  const W = 320, H = 170, x0 = 8, bw = 58, gap = 20, base = 132, top = 24;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Capture by distance from the folder">`;
  byLayer.forEach((l, i) => {
    const x = x0 + i * (bw + gap);
    const h = (base - top);
    out += `<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="3" fill="var(--panel)"/>`;
    if (l.share != null) {
      const hh = Math.max(0, Math.min(1, l.share)) * h;
      out += `<rect x="${x}" y="${base - hh}" width="${bw}" height="${hh}" rx="3" fill="var(--blue)"/>`;
      out += `<text x="${x + bw / 2}" y="${base - hh - 6}" text-anchor="middle" class="fig-strong">${pct(l.share)}</text>`;
    } else out += `<text x="${x + bw / 2}" y="${base - 8}" text-anchor="middle" class="fig-label">none</text>`;
    out += `<text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle" class="fig-label">${names[i]}</text>`;
    out += `<text x="${x + bw / 2}" y="${base + 32}" text-anchor="middle" class="fig-label">${l.avail ? usd(l.avail) : ''}</text>`;
  });
  return out + '</svg>';
}

// Dollars judged so far against tokens spent, with the free quota and a tick
// for every tool call underneath.
export function anytime(trace, world, g, freeQuota) {
  const W = 320, H = 170, L = 34, R = 10, T = 14, B = 132;
  const bks = g.bks;
  const maxTok = Math.max(freeQuota * 1.05, trace[trace.length - 1]?.cum || 1);
  const contrib = new Map();
  const sum = () => [...contrib.values()].reduce((a, b) => a + b, 0);
  const pts = [[0, 0]];
  let acc = 0;
  for (const e of trace) {
    if (e.kind === 'pin') contrib.set(e.opp, judgeItem(world, { kind: e.opp === 'bogus' ? 'bogus' : 'opp', id: e.opp, claimed: e.claimed }).judged);
    if (e.kind === 'decoy' && e.fell) contrib.set(`decoy:${e.decoy}`, judgeItem(world, { kind: 'decoy', id: e.decoy, claimed: 0 }).judged);
    acc = sum();
    if (e.kind === 'submit') acc = e.pass === 2 && g.pass2 ? g.pass2.judged : g.pass1.judged;
    pts.push([e.cum, acc]);
  }
  const ymax = Math.max(bks, acc) * 1.02, ymin = Math.min(0, ...pts.map((p) => p[1]));
  const X = (v) => L + (v / maxTok) * (W - L - R);
  const Y = (v) => B - ((v - ymin) / (ymax - ymin || 1)) * (B - T);
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dollars found against tokens spent">`;
  out += `<line x1="${L}" y1="${Y(bks)}" x2="${W - R}" y2="${Y(bks)}" stroke="var(--line)" stroke-dasharray="3 3"/>`;
  out += `<text x="${L}" y="${Y(bks) - 5}" class="fig-label">best known ${usd(bks)}</text>`;
  out += `<line x1="${X(freeQuota)}" y1="${T}" x2="${X(freeQuota)}" y2="${B}" stroke="var(--ochre)" stroke-dasharray="2 3"/>`;
  out += `<text x="${X(freeQuota) + 4}" y="${B - 6}" class="fig-label">free quota</text>`;
  out += `<line x1="${L}" y1="${B}" x2="${W - R}" y2="${B}" class="fig-axis"/>`;
  let d = '';
  pts.forEach(([x, y], i) => { d += `${i ? 'H' : 'M'}${X(x).toFixed(1)}${i ? `V${Y(y).toFixed(1)}` : ` ${Y(y).toFixed(1)}`}`; });
  out += `<path d="${d}" fill="none" stroke="var(--blue)" stroke-width="1.8"/>`;
  const colors = { read: 'var(--soft)', search: 'var(--line)', ask: 'var(--blue)', pin: 'var(--blue)', compute: 'var(--ink)', decoy: 'var(--ochre)', well: 'var(--soft)', grill: 'var(--rose)', submit: 'var(--ink)', quota: 'var(--rose)' };
  for (const e of trace) if (colors[e.kind]) out += `<line x1="${X(e.cum).toFixed(1)}" y1="${B + 8}" x2="${X(e.cum).toFixed(1)}" y2="${B + 16}" stroke="${colors[e.kind]}" stroke-width="1"/>`;
  out += `<text x="${W - R}" y="${B + 30}" text-anchor="end" class="fig-label">${ktok(maxTok)} tokens</text>`;
  out += `<text x="${L}" y="${B + 30}" class="fig-label">0</text>`;
  return out + '</svg>';
}

// Claimed vs judged, before and after the grill pass.
export function slope(g) {
  if (!g.pass2) return '';
  const W = 300, H = 170, xa = 70, xb = 230, T = 22, B = 140;
  const vals = [g.pass1.claimed, g.pass1.judged, g.pass2.claimed, g.pass2.judged, g.bks];
  const lo = Math.min(0, ...vals), hi = Math.max(...vals) * 1.05;
  const Y = (v) => B - ((v - lo) / (hi - lo || 1)) * (B - T);
  const line = (a, b, color, dash, label) => `<line x1="${xa}" y1="${Y(a)}" x2="${xb}" y2="${Y(b)}" stroke="${color}" stroke-width="1.8" ${dash ? 'stroke-dasharray="4 3"' : ''}/>`
    + `<circle cx="${xa}" cy="${Y(a)}" r="3" fill="${color}"/><circle cx="${xb}" cy="${Y(b)}" r="3" fill="${color}"/>`
    + `<text x="${xa - 8}" y="${Y(a) + 4}" text-anchor="end" class="fig-label">${usd(a)}</text>`
    + `<text x="${xb + 8}" y="${Y(b) + 4}" class="fig-label">${usd(b)} ${label}</text>`;
  let out = `<svg viewBox="0 0 ${W + 70} ${H}" role="img" aria-label="Claimed and judged savings before and after the second pass">`;
  out += `<line x1="${xa}" y1="${T - 8}" x2="${xa}" y2="${B + 6}" class="fig-axis"/><line x1="${xb}" y1="${T - 8}" x2="${xb}" y2="${B + 6}" class="fig-axis"/>`;
  out += `<text x="${xa}" y="${B + 24}" text-anchor="middle" class="fig-label">pass 1</text><text x="${xb}" y="${B + 24}" text-anchor="middle" class="fig-label">after grilling</text>`;
  out += line(g.pass1.claimed, g.pass2.claimed, 'var(--soft)', true, 'claimed');
  out += line(g.pass1.judged, g.pass2.judged, 'var(--blue)', false, 'judged');
  return out + '</svg>';
}

// One row's fingerprint: capture by distance as a staircase, a dot for decoys
// taken, an arrow for what the grill pass added.
export function fingerprint(r) {
  const W = 92, H = 22;
  let out = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
  r.layers.forEach((s, i) => {
    const x = 2 + i * 11;
    out += `<rect x="${x}" y="2" width="9" height="18" fill="var(--panel)"/>`;
    if (s != null) out += `<rect x="${x}" y="${2 + 18 * (1 - Math.max(0, Math.min(1, s)))}" width="9" height="${18 * Math.max(0, Math.min(1, s))}" fill="var(--blue)"/>`;
  });
  const dr = Math.min(6, 1.5 + r.decoyRate * 4.5);
  if (r.decoyRate > 0.02) out += `<circle cx="54" cy="11" r="${dr}" fill="var(--ochre)"/>`;
  const gain = Math.max(0, r.score - r.pass1);
  if (gain > 0.01) {
    const len = Math.min(26, 4 + gain * 60);
    out += `<line x1="64" y1="11" x2="${64 + len}" y2="11" stroke="var(--rose)" stroke-width="1.6"/><path d="M${64 + len} 11 l-4 -3 v6z" fill="var(--rose)"/>`;
  }
  return out + '</svg>';
}

// Cost against score. The free band is everything under the free quota.
export function pareto(rows, freeQuota) {
  const agents = rows.filter((r) => !r.human);
  const W = 660, H = 300, L = 46, R = 20, T = 18, B = 250;
  const xmax = Math.max(2.2, ...agents.map((r) => r.quotaShare)) * 1.08;
  const ymin = Math.min(0, ...agents.map((r) => r.score)), ymax = 1;
  const X = (v) => L + (v / xmax) * (W - L - R);
  const Y = (v) => B - ((v - ymin) / (ymax - ymin)) * (B - T);
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tokens spent against share of the best known strategy">`;
  out += `<rect x="${L}" y="${T}" width="${X(1) - L}" height="${B - T}" fill="var(--panel)"/>`;
  out += `<text x="${L + 8}" y="${T + 16}" class="fig-label">fits the free quota</text>`;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    if (v < ymin) continue;
    out += `<line x1="${L}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 1.2 : 0.6}"/>`;
    out += `<text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" class="fig-label">${pct(v)}</text>`;
  }
  for (const v of [0, 0.5, 1, 1.5, 2]) out += `<text x="${X(v)}" y="${B + 18}" text-anchor="middle" class="fig-label">${v}×</text>`;
  out += `<text x="${W - R}" y="${B + 38}" text-anchor="end" class="fig-label">tokens per rollout, as a multiple of the free quota</text>`;
  const front = agents.filter((r) => r.pareto).sort((a, b) => a.quotaShare - b.quotaShare);
  if (front.length > 1) out += `<polyline points="${front.map((r) => `${X(r.quotaShare).toFixed(1)},${Y(r.score).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--blue-l)" stroke-width="2"/>`;
  for (const r of agents) {
    const x = X(r.quotaShare), y = Y(r.score);
    out += `<g data-id="${r.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${r.pareto ? 5.5 : 4.5}" fill="${r.pareto ? 'var(--blue)' : 'var(--paper)'}" stroke="var(--blue)" stroke-width="1.6"/>`;
    out += `<text x="${x + 9}" y="${y + 4}" class="fig-strong">${esc(r.name)}</text></g>`;
  }
  return out + '</svg>';
}

// Elo with its interval.
export function eloBar(r, lo, hi) {
  const W = 120, H = 14;
  const X = (v) => 4 + ((v - lo) / (hi - lo || 1)) * (W - 8);
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><line x1="${X(r.lo)}" y1="7" x2="${X(r.hi)}" y2="7" stroke="var(--blue-l)" stroke-width="3" stroke-linecap="round"/><circle cx="${X(r.elo)}" cy="7" r="3.5" fill="${r.human ? 'var(--paper)' : 'var(--blue)'}" stroke="var(--blue)" stroke-width="1.4"/></svg>`;
}
