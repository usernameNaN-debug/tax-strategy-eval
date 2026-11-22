// The backend, as plain functions. In the browser it runs inside a Web Worker
// (src/worker.js); in CI it runs under Node to test and to precompute the
// leaderboard. Swapping a simulated agent for a real model means implementing
// the same tool calls in src/world/world.js against an API.
import data from './world/households.data.js';
import { makeWorld } from './world/world.js';
import { runRollout } from './agent/policy.js';
import { grade } from './engine/grader.js';
import { ALL_PROFILES, profileById, FREE_QUOTA } from './agent/profiles.js';
import { macroYear } from './world/macro.js';
import { runAll, leaderboard } from './bench/leaderboard.js';

const worlds = new Map(data.households.map((h) => [h.id, makeWorld(h)]));
const plain = (w) => {
  const { byId, clueDocs, ...rest } = w;
  return rest;
};

export const api = {
  meta() {
    return { taxYear: data.tax_year, now: data.now, freeQuota: FREE_QUOTA };
  },
  households() {
    return data.households.map((h) => ({
      id: h.id, name: h.name, brief: h.brief, filing_status: h.filing_status, state: h.state,
      members: h.members, docs: h.documents.length, bks: worlds.get(h.id).bks,
    }));
  },
  world(id) {
    return plain(worlds.get(id));
  },
  profiles() {
    return ALL_PROFILES.map(({ id, name, note, human, quota }) => ({ id, name, note, human: Boolean(human), quota: Number.isFinite(quota) ? quota : null }));
  },
  macro(seed = 2025) {
    return macroYear(seed);
  },
  rollout({ household, profile, seed = 0, grill = true }) {
    const w = worlds.get(household);
    const p = profileById[profile];
    const r = runRollout(w, p, seed, { grill });
    r.quota = FREE_QUOTA;
    return { rollout: r, grade: grade(w, r) };
  },
  leaderboard() {
    return leaderboard(runAll(data.households));
  },
};
