// The leaderboard page: the precomputed board, or computed in the browser if
// the JSON isn't there. Clicking an agent opens the office with it picked.
import { call } from './api.js';
import { pct, pareto, eloBar, fingerprint } from './ui/figures.js';
import { VERSION } from './version.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const go = (id) => { location.href = `office.html#agent=${encodeURIComponent(id)}`; };

async function boot() {
  $('#version').textContent = `v${VERSION}`;
  let lb = null;
  try { const r = await fetch('data/leaderboard.json', { cache: 'no-store' }); if (r.ok) lb = await r.json(); } catch { /* fall back */ }
  if (!lb) lb = await call('leaderboard');
  const rows = lb.rows;
  $('#pareto').innerHTML = `${pareto(rows, lb.freeQuota)}<figcaption>Each agent's average over every household. Filled points are on the frontier: nothing else is both cheaper and better.</figcaption>`;
  $('#pareto').querySelectorAll('g[data-id]').forEach((g) => g.onclick = () => go(g.dataset.id));
  const lo = Math.min(...rows.map((r) => r.lo)), hi = Math.max(...rows.map((r) => r.hi));
  $('#board').innerHTML = `<table class="board"><thead><tr><th>#</th><th>Agent</th><th>Elo</th><th class="r">Best known</th><th class="r hide-s">Tokens</th><th class="r hide-s">Decoys</th><th class="hide-s"></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr data-id="${r.id}" class="${r.human ? 'human' : ''}">
      <td class="num">${i + 1}</td>
      <td><span class="who">${esc(r.name)}</span><span class="why">${esc(r.note)}</span></td>
      <td><span class="num">${Math.round(r.elo)}</span><br>${eloBar(r, lo, hi)}</td>
      <td class="r"><span class="num">${pct(r.score)}</span><span class="why">from ${pct(r.pass1)}</span></td>
      <td class="r hide-s">${r.human ? '—' : `${r.quotaShare.toFixed(1)}×`}${r.cutoff > 0 ? `<span class="why">cut off ${pct(r.cutoff)}</span>` : ''}</td>
      <td class="r hide-s">${r.decoyRate.toFixed(2)}</td>
      <td class="hide-s">${fingerprint(r)}</td></tr>`).join('')}</tbody></table>`;
  $('#board').querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => go(tr.dataset.id));
  $('#boardnote').textContent = `Bradley–Terry on paired rollouts (same household, same seed), with 90% bootstrap intervals; ${lb.households} households × ${lb.seeds} seeds. "From" is the score before the second pass. The fingerprint is capture by distance from the folder, a dot for decoys taken, and an arrow for what the second pass added. Every agent here is simulated. Click one to watch it in the office.`;
}

let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY, top = $('#top');
  if (y > lastY + 2 && y > 90) top.classList.add('hide'); else if (y < lastY - 2 || y < 90) top.classList.remove('hide');
  lastY = y;
}, { passive: true });

boot();
