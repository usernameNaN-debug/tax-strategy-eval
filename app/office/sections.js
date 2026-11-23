// What comes after the hero: the explore reading and the rollout reading.
// Each returns { eye, title, toc, lede, sections } and wires itself after
// it's in the page.
import { INTAKE, FILING, PLACE, PLACES, HOPS } from './intake.js';
import { usd, pct, ktok, chainDots, reachBars, anytime, slope } from '../ui/figures.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shortRole = (r) => r.split(/[;,(]/)[0].trim();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d) => { const t = new Date(Date.UTC(2025, 0, d)); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`; };

// ---------------------------------------------------------------- explore
export function explore(W, macro) {
  const t = INTAKE[W.id];
  const ref = W.facts.reference_2025_return;
  const docsBy = (place) => W.documents.filter((d) => (PLACE[d.facility] || 'desk') === place);
  const placesUsed = PLACES.filter((p) => docsBy(p.id).length);
  const toc = [
    { id: 'household', label: 'The household', v: `${W.members.length} ${W.members.length === 1 ? 'person' : 'people'}` },
    { id: 'office', label: 'The office', v: `${placesUsed.length} rooms` },
    { id: 'sources', label: 'Sources', v: `${W.documents.length} documents` },
    { id: 'year', label: 'The year', v: '2025' },
  ];
  const lede = `${t.prose} The folder they handed over has ${W.documents.filter((d) => d.facility === 'folder').length} documents in it. The office around it has ${W.documents.length - W.documents.filter((d) => d.facility === 'folder').length} more, and nobody will point the agent at them.`;

  const household = `
    <table class="people">${W.members.map((m) => `<tr><td>${esc(m.name)}</td><td class="a">${m.age}</td><td class="r">${esc(m.role)}</td></tr>`).join('')}</table>
    <h3>The reference return</h3>
    <dl class="ledger">
      <div><dt>Filing status</dt><i></i><dd>${esc(FILING[W.filing_status])}</dd></div>
      <div><dt>Adjusted gross income</dt><i></i><dd>${usd(ref.agi)}</dd></div>
      <div><dt>${ref.itemizing ? 'Itemized' : 'Standard'} deduction</dt><i></i><dd>${usd(ref.deduction)}</dd></div>
      <div><dt>Taxable income</dt><i></i><dd>${usd(ref.taxable_income)}</dd></div>
      <div><dt>Total tax</dt><i></i><dd>${usd(ref.total_tax)}</dd></div>
      <div class="sum"><dt>${ref.refund >= 0 ? 'Refund' : 'Balance due'}</dt><i></i><dd>${usd(Math.abs(ref.refund))}</dd></div>
    </dl>
    <p class="note">${esc(W.facts.reference_note)}</p>`;

  const office = `
    <p>Every household gets the same rooms. What's in them changes. The agent starts at the desk with the folder, and everything else costs a walk: a search, a read, a phone call. Distance from the folder is the point. The further a source sits, the more an agent has to want to find it.</p>
    <div class="places">${PLACES.map((p) => { const n = docsBy(p.id).length; return `<div class="${n ? '' : 'empty'}"><b>${p.name}<span>${n || 'none'}</span></b><p>${p.what}</p></div>`; }).join('')}</div>
    <h3>How far each source sits from the folder</h3>
    <div class="hops">${HOPS.map((h, i) => { const ds = W.documents.filter((d) => d.layer === i); return `<div class="lvl"><span>${h}</span><div class="dots">${ds.map((d) => `<i class="${d.facility === 'flyers' ? 'flyer' : ''}" title="${esc(d.title)}"></i>`).join('') || '<span class="note">none</span>'}</div></div>`; }).join('')}</div>`;

  const sources = `
    <p>Everything an agent could open in this household, room by room. Click one to read it the way the agent would.</p>
    <div class="srcs">${PLACES.filter((p) => docsBy(p.id).length).map((p) => `
      <h3>${p.name}</h3>
      ${docsBy(p.id).map((d) => `<div class="src"><button><span>${esc(d.title)}</span><span>${HOPS[d.layer]?.toLowerCase() || ''}</span></button><div class="txt">${esc(d.text)}</div></div>`).join('')}`).join('')}
    </div>`;

  const year = `
    <p>The market and the news are simulated too, one seeded year, so the timing of a loss or a rule change is the same for every agent. The tax bill lands in July. Anything about overtime, tips, seniors or the SALT cap that an agent learned before then is out of date.</p>
    <figure>${marketChart(macro)}<figcaption>A simulated stock index through 2025, with the year's news marked.</figcaption></figure>
    <ol class="events">${macro.events.map((e, i) => `<li><span>${i + 1}</span><span>${dayLabel(e.day)}</span><span>${esc(e.text)}</span></li>`).join('')}</ol>`;

  return {
    eye: `The office · ${t.place}`,
    title: W.name,
    toc,
    lede,
    sections: [
      { id: 'household', title: 'The household', html: household },
      { id: 'office', title: 'The office', html: office },
      { id: 'sources', title: 'Sources', html: sources },
      { id: 'year', title: 'The year', html: year },
    ],
    wire(root) {
      root.querySelectorAll('.src button').forEach((b) => b.onclick = () => b.parentElement.classList.toggle('open'));
    },
  };
}

function marketChart(m) {
  const W = 700, H = 230, L = 34, R = 10, T = 18, B = 196;
  const xs = m.index;
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const X = (d) => L + (d / (xs.length - 1)) * (W - L - R);
  const Y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
  let s = `<svg class="market" viewBox="0 0 ${W} ${H}" role="img" aria-label="Simulated index through 2025">`;
  for (const v of [lo, (lo + hi) / 2, hi]) s += `<line class="fig-axis" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="fig-label" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  MONTHS.forEach((mo, i) => { const d = Math.round((i * 365) / 12); s += `<text class="fig-label" x="${X(d)}" y="${H - 8}">${mo}</text>`; });
  s += `<path d="${xs.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}" fill="none" stroke="var(--ink)" stroke-width="1.4"/>`;
  m.events.forEach((e, i) => {
    const d = Math.min(xs.length - 1, e.day - 1);
    s += `<line x1="${X(d)}" x2="${X(d)}" y1="${T}" y2="${B}" stroke="var(--line)" stroke-dasharray="2 3"/><circle cx="${X(d)}" cy="${Y(xs[d])}" r="9" fill="var(--paper)" stroke="var(--ink)"/><text x="${X(d)}" y="${Y(xs[d]) + 3.8}" text-anchor="middle" class="fig-strong" style="font-size:10.5px">${i + 1}</text>`;
  });
  return s + '</svg>';
}

// ---------------------------------------------------------------- results
const SECTION = { file: 'File with the 2025 return', open: 'Still open', missed: 'Missed in 2025', next: 'For 2026' };
const KIND = { deliver: 'folder', read: 'read', search: 'search', ask: 'ask', compute: 'engine', pin: 'pin', decoy: 'decoy', well: 'dig', submit: 'submit', grill: 'grill', quota: 'quota', mail: 'mail' };

export function result(W, r, g, p, meta, describe) {
  const t = INTAKE[W.id];
  const missed = g.chain.filter((c) => c.breakAt);
  const missedUsd = missed.reduce((a, c) => a + Math.max(0, c.value - Math.max(0, c.judged)), 0);
  const calls = r.trace.filter((e) => e.kind !== 'mail' && e.kind !== 'quota').length;
  const toc = [
    { id: 'result', label: 'The result', v: pct(g.score) },
    { id: 'strategy', label: 'The strategy', v: `${g.items.length} items` },
    { id: 'missed', label: 'What it missed', v: usd(missedUsd) },
    { id: 'trace', label: 'The trace', v: `${calls} calls` },
  ];
  const opened = Object.values(g.docStatus).filter((s) => s !== 'unread' && s !== 'never-money').length;
  const neverMoney = Object.values(g.docStatus).filter((s) => s === 'never-money').length;
  const lede = `${p.name} found ${usd(g.judged)} of the ${usd(g.bks)} we know is there for ${t.surname === 'Haines' || t.surname === 'Haddad' || t.surname === 'Vega' ? t.given : `the ${t.surname}s`}. It opened ${opened} of ${W.documents.length} sources${r.asked ? ' and called the client once' : ' and never called the client'}${neverMoney ? `. ${neverMoney} source${neverMoney === 1 ? '' : 's'} it never opened had money in ${neverMoney === 1 ? 'it' : 'them'}` : ''}.`;

  const head = `
    <p><span class="big num">${usd(g.judged)}</span><span class="of">of ${usd(g.bks)} best known</span></p>
    <div class="stats">
      <div><b class="num">${pct(g.score)}</b><span>${g.pass2 ? `from ${pct(g.pass1.score)} before the second pass` : 'one pass'}</span></div>
      <div><b class="num">${ktok(r.tokens)}</b><span>tokens, ${(r.tokens / meta.freeQuota).toFixed(1)}× a free-tier quota</span></div>
      <div><b class="num">${calls}</b><span>tool calls${r.exhausted ? ', cut off before it finished' : ''}</span></div>
    </div>
    <div class="pair">
      <figure>${reachBars(g.byLayer)}<figcaption>Dollars found, by how far the source sat from the folder.</figcaption></figure>
      <figure>${anytime(r.trace, W, g, meta.freeQuota)}<figcaption>Dollars found as tokens are spent. Ticks below are tool calls.</figcaption></figure>
    </div>`;

  const mark = { full: '●', partial: '◐', none: '○', wrong: '✕' };
  let memo = '<div class="memo"><div class="colhead"><span></span><span></span><span>claimed</span><span>worth</span></div>';
  for (const sec of g.sections) {
    const live = sec.rows.filter((x) => x.mark !== 'none').sort((a, b) => b.value - a.value);
    const ghost = sec.rows.filter((x) => x.mark === 'none').sort((a, b) => b.value - a.value);
    const sub = sec.section === 'open' ? '<span>45 days to April 15</span>' : '';
    memo += `<h3>${SECTION[sec.section]}${sub}</h3>`;
    const claimedOf = (id) => g.items.find((it) => it.id === id)?.claimed;
    for (const x of [...live, ...ghost]) {
      const c = claimedOf(x.id);
      memo += `<div class="row ${x.mark === 'none' ? 'ghost' : ''}" tabindex="0"><span class="m m-${x.mark}">${mark[x.mark]}</span><span class="t">${esc(x.title)}</span><span class="c">${c != null ? usd(c) : '—'}</span><span class="v">${usd(x.mark === 'none' ? x.value : x.judged)}</span><span class="more">${esc(x.value_math || '')}${x.cite ? `<br>${esc(x.cite)}` : ''}${x.legality === 'gray' ? '<br>Gray area: depends on facts the file only partly shows.' : ''}</span></div>`;
    }
    for (const it of sec.wrong) {
      const d = W.decoys.find((x) => x.id === it.id);
      memo += `<div class="row wrong" tabindex="0"><span class="m m-wrong">✕</span><span class="t">${esc(d ? d.lure : it.title || 'Unsourced claim')}</span><span class="c">${usd(it.claimed)}</span><span class="v">${usd(it.judged)}</span><span class="more">${esc(d ? d.why_wrong : 'No source in the office supports this.')}</span></div>`;
    }
  }
  memo += '</div><p class="note">● claimed at the right amount · ◐ right idea, wrong number · ○ never written down · ✕ wrong. Click a line for the math.</p>';
  if (g.pass2) memo += `<figure>${slope(g)}<figcaption>Claimed is what the agent said the strategy saves; judged is what the engine says. The second pass is after the strategy came back with flags.</figcaption></figure>`;

  const rows = [...g.chain].sort((a, b) => (a.breakAt ? 0 : 1) - (b.breakAt ? 0 : 1) || b.value - a.value);
  const miss = `
    <p>${missed.length ? `For every opportunity it didn't fully get, the chain shows where it broke: it never saw a clue, saw one and didn't go looking, read the source and didn't write anything down, or wrote it down at the wrong amount. Every source was in the office. A miss is the agent's.` : 'It got every opportunity in this household at the right amount.'}</p>
    <table class="chain"><tbody>${rows.map((x) => `<tr class="${x.breakAt ? '' : 'got'}"><td>${esc(x.title)}</td><td>${chainDots(x)}</td><td class="v">${x.breakAt ? `${usd(Math.max(0, x.judged))} / ${usd(x.value)}` : usd(x.value)}</td><td class="why">${x.breakAt || ''}</td></tr>`).join('')}</tbody></table>
    <p class="note">The four dots: saw a clue, went looking, read the source, wrote it down at the right amount.</p>`;

  const trace = `
    <p>Every call, in order, with what it cost.</p>
    <ol class="trace">${r.trace.map((e, i) => `<li class="${e.pass === 2 ? 'p2' : ''}"><span class="i">${i + 1}</span><span class="k">${KIND[e.kind] || e.kind}</span><span>${describe(e)}</span><span class="tk">${e.tokens ? ktok(e.tokens) : ''}</span></li>`).join('')}</ol>`;

  return {
    eye: `On ${W.name} · tax year 2025`,
    title: p.name,
    toc,
    lede,
    sections: [
      { id: 'result', title: 'The result', html: head },
      { id: 'strategy', title: 'The strategy', html: memo },
      { id: 'missed', title: 'What it missed', html: miss },
      { id: 'trace', title: 'The trace', html: trace },
    ],
    wire(root) {
      root.querySelectorAll('.row').forEach((x) => { x.onclick = () => x.classList.toggle('open'); x.onkeydown = (e) => { if (e.key === 'Enter') x.classList.toggle('open'); }; });
    },
  };
}
