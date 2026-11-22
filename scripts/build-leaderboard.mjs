// Precompute the leaderboard so the page doesn't run 70 rollouts on load.
// CI runs this before deploying; the page falls back to computing it live.
import { writeFileSync } from 'node:fs';
import { api } from '../src/service.js';

const t0 = Date.now();
const lb = api.leaderboard();
lb.builtAt = new Date().toISOString();
writeFileSync(new URL('../data/leaderboard.json', import.meta.url), JSON.stringify(lb, null, 1));
console.log(`leaderboard: ${lb.rows.length} agents, ${lb.households} households x ${lb.seeds} seeds, ${Date.now() - t0} ms`);
for (const r of lb.rows) console.log(`  ${r.name.padEnd(11)} ${String(Math.round(r.elo)).padStart(5)}  [${Math.round(r.lo)}, ${Math.round(r.hi)}]  ${(100 * r.score).toFixed(0)}%`);
