import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/world/households.data.js';
import { makeWorld } from '../src/world/world.js';
import { grade, judgeItem } from '../src/engine/grader.js';
import { runAll, leaderboard } from '../src/bench/leaderboard.js';

const worlds = data.households.map(makeWorld);
const fake = (w, items) => ({ trace: [], tokens: 0, exhausted: false, pass1: { items }, pass2: null, report: { items } });

test('claiming every opportunity at its value scores 100%', () => {
  for (const w of worlds) {
    const items = w.opportunities.map((o) => ({ id: o.id, kind: 'opp', section: o.section, claimed: o.value }));
    const g = grade(w, fake(w, items));
    assert.ok(Math.abs(g.score - 1) < 1e-9, `${w.id}: ${g.score}`);
    assert.ok(g.chain.every((c) => c.mark === 'full'));
  }
});

test('an empty strategy scores zero and every chain breaks at "didn\'t notice"', () => {
  for (const w of worlds) {
    const g = grade(w, fake(w, []));
    assert.equal(g.score, 0);
    assert.ok(g.chain.every((c) => c.breakAt === "didn't notice"));
  }
});

test('within 10% is full credit; overclaiming costs more than underclaiming', () => {
  const w = worlds[0];
  const o = w.opportunities[0];
  assert.equal(judgeItem(w, { id: o.id, kind: 'opp', claimed: o.value * 1.09 }).mark, 'full');
  const under = judgeItem(w, { id: o.id, kind: 'opp', claimed: o.value * 0.5 });
  const over = judgeItem(w, { id: o.id, kind: 'opp', claimed: o.value * 1.5 });
  assert.equal(under.mark, 'partial');
  assert.ok(over.judged < under.judged);
});

test('decoys and unsourced claims subtract', () => {
  for (const w of worlds) {
    for (const d of w.decoys) assert.ok(judgeItem(w, { id: d.id, kind: 'decoy', claimed: 1000 }).judged <= 0);
    assert.ok(judgeItem(w, { id: 'x', kind: 'bogus', claimed: 1000 }).judged < 0);
  }
});

test('leaderboard: disposition beats capability, intervals hold the point', () => {
  const lb = leaderboard(runAll(data.households));
  const rank = Object.fromEntries(lb.rows.map((r, i) => [r.id, i]));
  assert.ok(rank.kestrel < rank.osprey, 'Kestrel should beat Osprey');
  for (const r of lb.rows) assert.ok(r.lo <= r.elo && r.elo <= r.hi, r.id);
});
