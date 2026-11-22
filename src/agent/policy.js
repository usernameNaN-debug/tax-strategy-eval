// A simulated agent: walks the world through the same tools a real model
// would call, and writes a report. Deterministic in (household, profile, seed).
//
// One rollout = pass 1 (work until it thinks it is done, submit) and an
// optional pass 2 (the binder comes back with flags: grill yourself, refine,
// resubmit). Multi-agent setups plug in at the same tool surface; we do not
// test them here.
import { stream } from '../world/rng.js';
import { makeTools } from '../world/world.js';

const SEARCHABLE = new Set(['library', 'law', 'portal', 'vault', 'screen', 'cabinet', 'inbox']);
const round = (x) => Math.round(x * 100) / 100;

export function runRollout(world, profile, seed = 0, { grill = true } = {}) {
  const rnd = stream('rollout', world.id, profile.id, String(seed));
  const T = makeTools(world, { quota: profile.quota });
  const v = profile.verbosity;
  const notes = new Map();      // oppId -> { claimed, ok, pass }
  const taken = new Map();      // decoyId -> pass
  const rejected = new Set();
  const rolled = new Set();     // docs it already decided about this pass
  const tried = new Set();      // opportunities it already judged this pass
  let pass = 1;
  let asked = false;
  let bogus = null;
  let insightBoost = 0;

  const needs = (o) => o.needs.filter((n) => world.byId[n]);

  function recognize(o) {
    if (notes.has(o.id) || tried.has(o.id) || T.exhausted) return;
    if (!needs(o).every((n) => T.seen.has(n))) return;
    tried.add(o.id);
    const insight = profile.insight + (1 - profile.insight) * insightBoost;
    if (rnd() >= insight) return;
    const ok = rnd() < profile.followThrough;
    const claimed = ok ? o.value : o.value * (rnd() < 0.5 ? 0.45 + rnd() * 0.3 : 1.35 + rnd() * 0.6);
    if (rnd() < 0.75) T.compute(o.section === 'next' ? 2026 : 2025, world.facts?.engine_inputs_2025 || {}, v);
    T.pin(o.id, o.section, round(claimed), v);
    notes.set(o.id, { claimed: round(claimed), ok, pass });
  }

  function read(id) {
    if (T.exhausted || !world.byId[id]) return;
    T.open(id, v);
    if (T.exhausted) return;
    for (const d of world.decoys) {
      if (d.doc !== id || taken.has(d.id) || rejected.has(d.id)) continue;
      const fell = rnd() < profile.credulity;
      T.decoy(d.id, fell, v);
      if (fell) taken.set(d.id, pass); else rejected.add(d.id);
    }
    for (const o of world.opportunities) recognize(o);
  }

  function fetch(id) {
    const d = world.byId[id];
    if (!d || T.seen.has(id) || T.exhausted) return;
    if (SEARCHABLE.has(d.facility)) {
      const words = d.title.replace(/[—'"()]/g, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 3).join(' ');
      T.search(d.facility, words, v);
    }
    read(id);
  }

  // Docs it has a reason to go get: the missing inputs of any opportunity
  // whose clue it has already read.
  function leads() {
    const out = new Set();
    for (const o of world.opportunities) {
      if (notes.has(o.id)) continue;
      const clued = world.clueDocs(o.id).some((c) => T.seen.has(c));
      if (!clued) continue;
      for (const n of needs(o)) if (!T.seen.has(n)) out.add(n);
    }
    return [...out].sort((a, b) => world.byId[a].layer - world.byId[b].layer);
  }

  function callClient() {
    if (asked || T.exhausted) return;
    asked = true;
    const docs = T.ask('Anything else from 2025 we should know about?', v);
    for (const id of docs) read(id);
  }

  function chase(scale = 1) {
    for (let round_ = 0; round_ < 6 && !T.exhausted; round_++) {
      let moved = false;
      for (const id of leads()) {
        if (rolled.has(id)) continue;
        rolled.add(id);
        const d = world.byId[id];
        if (d.facility === 'phone') {
          if (rnd() < profile.askClient * scale) { callClient(); moved = true; }
          continue;
        }
        if (rnd() < profile.reach[Math.min(3, d.layer)] * scale) { fetch(id); moved = true; }
      }
      if (!moved) break;
    }
  }

  // ---------------------------------------------------------------- pass 1
  for (const id of T.deliver()) read(id);
  const lobby = world.documents.filter((d) => d.facility === 'flyers' || d.facility === 'inbox');
  for (const d of lobby) if (rnd() < 0.25 + 0.6 * profile.wander + 0.2 * profile.credulity) read(d.id);
  chase();
  for (const d of world.documents) {
    if (T.exhausted) break;
    if (T.seen.has(d.id) || rolled.has(d.id) || d.facility === 'phone' || d.facility === 'flyers') continue;
    if (rnd() < profile.wander * (1 - 0.22 * d.layer)) fetch(d.id);
  }
  if (!asked && rnd() < profile.askClient) callClient();
  chase();
  for (const w of world.dry_wells) if (!T.exhausted && rnd() < profile.wells) T.visitWell(w.id, v);
  if (!T.exhausted && rnd() < profile.hallucination) {
    bogus = { id: 'bogus', title: 'Home-office deduction for a W-2 employee', claimed: 1500 + Math.round(rnd() * 2000), pass };
    T.pin('bogus', 'file', bogus.claimed, v);
  }
  const pass1 = snapshot();
  T.submit(pass1, v);

  // ---------------------------------------------------------------- pass 2
  let pass2 = null;
  if (grill && !T.exhausted && profile.refine > 0) {
    pass = 2; T.setPass(2);
    rolled.clear(); tried.clear();
    insightBoost = profile.refine * 0.6;
    T.grill();
    for (const [id] of [...taken]) if (rnd() < profile.refine) { taken.delete(id); rejected.add(id); }
    if (bogus && rnd() < profile.refine) bogus = null;
    for (const [id, n] of notes) {
      if (!n.ok && rnd() < profile.refine) {
        const o = world.opportunities.find((x) => x.id === id);
        T.compute(o.section === 'next' ? 2026 : 2025, world.facts?.engine_inputs_2025 || {}, v);
        T.pin(id, o.section, o.value, v);
        notes.set(id, { claimed: o.value, ok: true, pass: 2 });
      }
    }
    for (const o of world.opportunities) recognize(o);
    chase(0.4 + 0.6 * profile.refine);
    if (!asked && rnd() < profile.refine * profile.askClient) { callClient(); chase(profile.refine); }
    pass2 = snapshot();
    T.submit(pass2, v);
  }
  T.mail();

  function snapshot() {
    const items = [];
    for (const [id, n] of notes) {
      const o = world.opportunities.find((x) => x.id === id);
      items.push({ id, kind: 'opp', section: o.section, claimed: n.claimed, pass: n.pass });
    }
    for (const [id, p] of taken) {
      const d = world.decoys.find((x) => x.id === id);
      items.push({ id, kind: 'decoy', section: 'file', claimed: Math.abs(d.value), pass: p });
    }
    if (bogus) items.push({ id: 'bogus', kind: 'bogus', section: 'file', claimed: bogus.claimed, title: bogus.title, pass: bogus.pass });
    return { items };
  }

  return {
    household: world.id, profile: profile.id, seed,
    trace: T.trace, tokens: T.tokens, exhausted: T.exhausted, asked,
    pass1, pass2, report: pass2 || pass1,
  };
}
