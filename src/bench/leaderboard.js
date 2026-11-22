// The leaderboard: every agent on every household, a couple of rollouts each.
//
// Ranking is Bradley-Terry on paired outcomes (same household, same seed),
// which holds up even though a $56k RSU basis fix dwarfs everything in
// a $13k household. Mean score is shown alongside, clipped at -100% per
// rollout so one catastrophic decoy doesn't swamp the average (the per-rollout
// report keeps the raw number).
import { makeWorld } from '../world/world.js';
import { runRollout } from '../agent/policy.js';
import { grade } from '../engine/grader.js';
import { ALL_PROFILES, FREE_QUOTA } from '../agent/profiles.js';
import { mulberry32 } from '../world/rng.js';

export const SEEDS = [0, 1];

export function runAll(households, profiles = ALL_PROFILES, seeds = SEEDS) {
  const worlds = households.map(makeWorld);
  const rows = [];
  for (const p of profiles) for (const w of worlds) for (const s of seeds) {
    const r = runRollout(w, p, s);
    const g = grade(w, r);
    rows.push({
      profile: p.id, household: w.id, seed: s, score: g.score, pass1: g.pass1.score,
      tokens: r.tokens, exhausted: r.exhausted, fell: g.decoys.filter((d) => d.fell).length,
      byLayer: g.byLayer.map((l) => l.share), asked: g.asked,
    });
  }
  return rows;
}

// Minorization-maximization for Bradley-Terry strengths.
export function bradleyTerry(ids, games, iters = 200) {
  const s = Object.fromEntries(ids.map((i) => [i, 1]));
  const wins = Object.fromEntries(ids.map((i) => [i, 0]));
  for (const g of games) { wins[g.a] += g.w; wins[g.b] += 1 - g.w; }
  for (let t = 0; t < iters; t++) {
    const next = {};
    for (const i of ids) {
      let den = 0;
      for (const g of games) {
        if (g.a === i || g.b === i) den += 1 / (s[g.a] + s[g.b]);
      }
      next[i] = (wins[i] + 0.5) / (den + 1 / (s[i] + 1));
    }
    const mean = ids.reduce((a, i) => a + Math.log(next[i]), 0) / ids.length;
    for (const i of ids) s[i] = Math.exp(Math.log(next[i]) - mean);
  }
  return s;
}

function gamesFrom(rows, ids) {
  const key = (r) => `${r.household}|${r.seed}`;
  const groups = new Map();
  for (const r of rows) {
    if (!ids.includes(r.profile)) continue;
    if (!groups.has(key(r))) groups.set(key(r), []);
    groups.get(key(r)).push(r);
  }
  const games = [];
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const d = g[i].score - g[j].score;
      games.push({ a: g[i].profile, b: g[j].profile, w: Math.abs(d) < 0.005 ? 0.5 : d > 0 ? 1 : 0 });
    }
  }
  return { games, keys: [...groups.keys()] };
}

const toElo = (s) => 1000 + 400 * Math.log10(s);

export function leaderboard(rows, profiles = ALL_PROFILES, { boot = 120, seed = 7 } = {}) {
  const ids = profiles.map((p) => p.id);
  const { games } = gamesFrom(rows, ids);
  const s = bradleyTerry(ids, games);
  // Bootstrap over (household, seed) cells.
  const cells = [...new Set(rows.map((r) => `${r.household}|${r.seed}`))];
  const rnd = mulberry32(seed);
  const samples = Object.fromEntries(ids.map((i) => [i, []]));
  for (let b = 0; b < boot; b++) {
    const pickRows = [];
    for (let k = 0; k < cells.length; k++) {
      const c = cells[Math.floor(rnd() * cells.length)];
      for (const r of rows) if (`${r.household}|${r.seed}` === c) pickRows.push({ ...r, seed: `${r.seed}#${k}` });
    }
    const bs = bradleyTerry(ids, gamesFrom(pickRows, ids).games, 60);
    for (const i of ids) samples[i].push(toElo(bs[i]));
  }
  const q = (a, p) => { const x = [...a].sort((m, n) => m - n); return x[Math.floor(p * (x.length - 1))]; };

  const out = profiles.map((p) => {
    const mine = rows.filter((r) => r.profile === p.id);
    const mean = (f) => mine.reduce((a, r) => a + f(r), 0) / mine.length;
    const layers = [0, 1, 2, 3].map((L) => {
      const v = mine.map((r) => r.byLayer[L]).filter((x) => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    });
    return {
      id: p.id, name: p.name, note: p.note, human: Boolean(p.human),
      elo: toElo(s[p.id]), lo: q(samples[p.id], 0.05), hi: q(samples[p.id], 0.95),
      score: mean((r) => Math.max(-1, r.score)), pass1: mean((r) => Math.max(-1, r.pass1)),
      tokens: mean((r) => r.tokens), quotaShare: mean((r) => r.tokens) / FREE_QUOTA,
      cutoff: mean((r) => (r.exhausted ? 1 : 0)), decoyRate: mean((r) => r.fell),
      asked: mean((r) => (r.asked ? 1 : 0)), layers, n: mine.length,
    };
  });
  out.sort((a, b) => b.elo - a.elo);
  // Pareto front on cost vs score, agents only.
  const agents = out.filter((r) => !r.human);
  for (const r of agents) r.pareto = !agents.some((o) => o !== r && o.tokens <= r.tokens && o.score >= r.score && (o.tokens < r.tokens || o.score > r.score));
  return { rows: out, freeQuota: FREE_QUOTA, households: [...new Set(rows.map((r) => r.household))].length, seeds: [...new Set(rows.map((r) => r.seed))].length };
}
