// Grades a rollout against the household's best known strategy (BKS).
//
// BKS is the sum of every planted legal opportunity, each valued by the tax
// engine as the change in net federal burden. Values interact a little (an
// HSA lowers AGI, which nudges a credit); the household file says where.
//
// Beyond the score, the grader answers the postmortem question: for every
// opportunity missed, where did the chain break? And for every source in the
// building: was it used, read and forgotten, or never opened while it held
// money?

const TOL = 0.1;

export function judgeItem(world, it) {
  if (it.kind === 'opp') {
    const o = world.opportunities.find((x) => x.id === it.id);
    const exact = Math.abs(it.claimed - o.value) <= TOL * Math.max(1, Math.abs(o.value));
    if (exact) return { judged: o.value, mark: 'full' };
    // Wrong amount: the idea is right, the number is not. Overclaims also
    // carry the accuracy-penalty risk.
    const over = Math.max(0, it.claimed - o.value);
    return { judged: Math.max(0, 0.5 * o.value - 0.2 * over), mark: 'partial' };
  }
  if (it.kind === 'decoy') {
    const d = world.decoys.find((x) => x.id === it.id);
    return { judged: d.value, mark: 'wrong' };
  }
  return { judged: -0.2 * it.claimed, mark: 'wrong' };
}

function totals(world, report) {
  if (!report) return null;
  let claimed = 0, judged = 0;
  const items = report.items.map((it) => {
    const j = judgeItem(world, it);
    claimed += it.claimed; judged += j.judged;
    return { ...it, ...j };
  });
  return { items, claimed, judged, score: world.bks ? judged / world.bks : 0 };
}

export function grade(world, rollout) {
  const final = totals(world, rollout.report);
  const first = totals(world, rollout.pass1);
  const seen = new Set();
  const searched = new Set();
  let asked = false;
  for (const e of rollout.trace) {
    if (e.kind === 'read') seen.add(e.doc);
    if (e.kind === 'search') searched.add(e.facility);
    if (e.kind === 'ask') asked = true;
  }
  const byId = Object.fromEntries(final.items.map((it) => [it.id, it]));

  // The chain for every opportunity: clue -> query -> source -> action -> $.
  const chain = world.opportunities.map((o) => {
    const clues = world.clueDocs(o.id);
    const needs = o.needs.filter((n) => world.byId[n]);
    const clue = clues.some((c) => seen.has(c));
    const looked = needs.some((n) => seen.has(n)) || needs.some((n) => searched.has(world.byId[n].facility));
    const source = needs.every((n) => seen.has(n));
    const it = byId[o.id];
    const acted = Boolean(it);
    let breakAt = null;
    if (!it || it.mark !== 'full') {
      if (acted) breakAt = 'acted wrong';
      else if (source) breakAt = "read but didn't act";
      else if (clue) breakAt = "didn't look";
      else breakAt = "didn't notice";
    }
    return {
      id: o.id, title: o.title, section: o.section, layer: o.layer, value: o.value,
      clue, looked, source, acted, judged: it ? it.judged : 0, mark: it ? it.mark : 'none', breakAt,
      needs, cite: o.cite, legality: o.legality, value_math: o.value_math,
    };
  });

  // What each source turned out to be.
  const docStatus = {};
  for (const d of world.documents) {
    const opps = world.opportunities.filter((o) => o.needs.includes(d.id) || d.clue_for.includes(o.id));
    const money = opps.length > 0;
    const captured = opps.some((o) => byId[o.id]?.mark === 'full');
    const missed = opps.some((o) => byId[o.id]?.mark !== 'full');
    let s;
    if (seen.has(d.id)) s = !money ? 'seen' : captured && !missed ? 'used' : captured ? 'used' : 'forgot';
    else s = money && missed ? 'never-money' : 'unread';
    docStatus[d.id] = s;
  }
  const decoys = world.decoys.map((d) => ({
    id: d.id, lure: d.lure, doc: d.doc, why_wrong: d.why_wrong, value: d.value,
    seen: seen.has(d.doc), fell: Boolean(byId[d.id]),
  }));
  const wells = world.dry_wells.map((w) => ({
    id: w.id, title: w.title, visited: rollout.trace.some((e) => e.kind === 'well' && e.well === w.id),
  }));

  // Capture by distance from the folder.
  const byLayer = [0, 1, 2, 3].map((L) => {
    const os = chain.filter((c) => c.layer === L);
    const avail = os.reduce((s, c) => s + c.value, 0);
    const got = os.reduce((s, c) => s + Math.max(0, c.judged), 0);
    return { layer: L, n: os.length, avail, got, share: avail ? got / avail : null };
  });

  // What the BKS report looks like, section by section, with the agent's marks.
  const sections = ['file', 'open', 'missed', 'next'].map((sec) => ({
    section: sec,
    rows: chain.filter((c) => c.section === sec),
    wrong: final.items.filter((it) => it.mark === 'wrong' && it.section === sec),
  }));

  const harvestMissed = chain.some((c) => /tlh|harvest/.test(c.id) && c.mark !== 'full');
  const cost = rollout.tokens;
  return {
    household: world.id, profile: rollout.profile, seed: rollout.seed,
    bks: world.bks, score: final.score, judged: final.judged, claimed: final.claimed,
    pass1: first && { claimed: first.claimed, judged: first.judged, score: first.score },
    pass2: rollout.pass2 ? { claimed: final.claimed, judged: final.judged, score: final.score } : null,
    items: final.items, chain, docStatus, decoys, wells, byLayer, sections,
    harvestMissed, asked, tokens: cost, exhausted: rollout.exhausted,
    reads: seen.size, docs: world.documents.length,
  };
}
