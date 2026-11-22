// A world is one household plus the tools an agent uses to work on it.
// Every tool call is appended to the trace; the trace is the rollout.
//
// Facilities and layers:
//   layer 0  the folder the client handed over, the flyer rack in the lobby
//   layer 1  one hop away: employer portals, IRS publications, the news
//   layer 2  deep: the card catalog, case law, boxes in the basement
//   layer 3  only the client knows; you have to call and ask
import { compute } from '../engine/tax.js';

// Token costs are rough per-call sizes for a tool-using model, read plus think.
const SCALE = 8;

export const FACILITIES = ['folder', 'inbox', 'flyers', 'cabinet', 'portal', 'library', 'law', 'screen', 'vault', 'phone'];

export function makeWorld(h) {
  const documents = h.documents.map((d) => ({ layer: 0, clue_for: [], ...d }));
  const byId = Object.fromEntries(documents.map((d) => [d.id, d]));
  const wells = (h.dry_wells || []).map((w) => ({ ...w }));
  const decoys = (h.decoys || []).map((d) => ({ ...d }));
  const opportunities = h.opportunities.map((o) => ({ needs: [], ...o }));
  const bks = opportunities.reduce((s, o) => s + Math.max(0, o.value), 0);
  return {
    id: h.id, name: h.name, brief: h.brief, filing_status: h.filing_status, state: h.state,
    members: h.members, facts: h.facts, constants: h.constants,
    documents, byId, opportunities, decoys, dry_wells: wells, bks,
    clueDocs(oppId) { return documents.filter((d) => d.clue_for.includes(oppId)).map((d) => d.id); },
  };
}

// The tool surface. A real model gets the same calls through function
// calling; the simulated agents in src/agent call them directly.
export function makeTools(world, { quota = Infinity } = {}) {
  const trace = [];
  const seen = new Set();
  let tokens = 0;
  let pass = 1;
  let exhausted = false;

  const push = (ev, cost) => {
    if (exhausted) return null;
    const c = Math.round(cost * SCALE);
    tokens += c;
    const e = { i: trace.length, pass, tokens: c, cum: tokens, ...ev };
    trace.push(e);
    if (tokens > quota) {
      exhausted = true;
      trace.push({ i: trace.length, pass, kind: 'quota', tokens: 0, cum: tokens });
    }
    return e;
  };
  const docCost = (d) => 180 + 4 * ((d.text || '').length + d.title.length);

  return {
    trace,
    seen,
    get tokens() { return tokens; },
    get exhausted() { return exhausted; },
    setPass(p) { pass = p; },

    deliver() {
      const docs = world.documents.filter((d) => d.facility === 'folder').map((d) => d.id);
      push({ kind: 'deliver', docs, text: 'files' }, 60);
      return docs;
    },
    open(id, verbosity = 1) {
      const d = world.byId[id];
      if (!d) return null;
      const ev = push({ kind: 'read', doc: id, facility: d.facility, layer: d.layer, again: seen.has(id) }, docCost(d) * verbosity);
      if (!ev) return null;
      seen.add(id);
      return d;
    },
    search(facility, query, verbosity = 1) {
      const q = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const hits = world.documents.filter((d) => d.facility === facility
        && q.some((w) => `${d.title} ${d.text || ''}`.toLowerCase().includes(w))).map((d) => d.id);
      const ev = push({ kind: 'search', facility, query, hits, hit: hits.length > 0 }, 260 * verbosity);
      return ev ? hits : [];
    },
    ask(question, verbosity = 1) {
      const docs = world.documents.filter((d) => d.facility === 'phone').map((d) => d.id);
      const ev = push({ kind: 'ask', question, docs }, 400 * verbosity);
      return ev ? docs : [];
    },
    visitWell(id, verbosity = 1) {
      const w = world.dry_wells.find((x) => x.id === id);
      push({ kind: 'well', well: id, facility: w?.facility || 'cabinet', text: w?.title }, 320 * verbosity);
    },
    decoy(id, fell, verbosity = 1) {
      const d = world.decoys.find((x) => x.id === id);
      push({ kind: 'decoy', decoy: id, doc: d?.doc, fell }, 220 * verbosity);
    },
    compute(year, inputs, verbosity = 1) {
      const r = compute(year, world.filing_status, inputs);
      push({ kind: 'compute', year }, 340 * verbosity);
      return r;
    },
    pin(oppId, section, claimed, verbosity = 1) {
      push({ kind: 'pin', opp: oppId, section, claimed }, 160 * verbosity);
    },
    grill() { push({ kind: 'grill' }, 900); },
  
    submit(report, verbosity = 1) {
      push({ kind: 'submit', items: report.items.length }, 1400 * verbosity);
    },
    mail() { trace.push({ i: trace.length, pass, kind: 'mail', tokens: 0, cum: tokens }); },
  };
}
