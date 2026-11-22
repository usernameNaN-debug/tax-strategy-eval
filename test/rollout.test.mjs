import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/world/households.data.js';
import { makeWorld } from '../src/world/world.js';
import { runRollout } from '../src/agent/policy.js';
import { ALL_PROFILES, profileById, FREE_QUOTA } from '../src/agent/profiles.js';

const worlds = data.households.map(makeWorld);

test('a rollout is a pure function of (household, profile, seed)', () => {
  for (const w of worlds) {
    const a = runRollout(w, profileById.heron, 1, { grill: true });
    const b = runRollout(w, profileById.heron, 1, { grill: true });
    assert.deepEqual(a.trace, b.trace);
    assert.deepEqual(a.report, b.report);
  }
});

test('traces are ordered and token counts only go up', () => {
  for (const w of worlds) for (const p of ALL_PROFILES) {
    const r = runRollout(w, p, 0, { grill: true });
    r.trace.forEach((e, i) => {
      assert.equal(e.i, i);
      if (i) assert.ok(e.cum >= r.trace[i - 1].cum);
    });
    assert.equal(r.tokens, r.trace.at(-1).cum);
  }
});

test('the free-quota agent is cut off right after the call that crosses the line', () => {
  for (const w of worlds) {
    const r = runRollout(w, profileById.sparrow, 0, { grill: true });
    const k = r.trace.findIndex((e) => e.cum > FREE_QUOTA);
    if (k < 0) { assert.equal(r.exhausted, false); continue; }
    assert.equal(r.exhausted, true);
    // Nothing billable after the crossing call: the cutoff, then the mail.
    assert.deepEqual(r.trace.slice(k + 1).map((e) => e.kind), ['quota', 'mail']);
    assert.ok(r.trace.slice(k + 1).every((e) => e.cum === r.trace[k].cum));
  }
});

test('every read points at a real source', () => {
  for (const w of worlds) {
    const r = runRollout(w, profileById.magpie, 0, { grill: true });
    for (const e of r.trace.filter((x) => x.kind === 'read')) assert.ok(w.byId[e.doc], e.doc);
  }
});
