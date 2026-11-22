// The JavaScript engine grades in the browser; the Python engine built the
// households. They have to agree on every reference return.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/world/households.data.js';
import { compute } from '../src/engine/tax.js';

const KEYS = ['agi', 'ss_taxable', 'deduction', 'taxable_income', 'regular_tax', 'amt', 'cdcc', 'ctc_nonref', 'actc', 'eitc', 'se_tax', 'niit', 'total_tax', 'qbi'];

for (const h of data.households) {
  test(`engine matches the Python reference return: ${h.id}`, () => {
    const ref = h.facts.reference_2025_return;
    const got = compute(2025, h.filing_status, h.facts.engine_inputs_2025);
    for (const k of KEYS) {
      if (!(k in ref)) continue;
      assert.ok(Math.abs(got[k] - ref[k]) <= 1, `${k}: js ${got[k]} vs py ${ref[k]}`);
    }
    assert.equal(got.itemizing, ref.itemizing);
  });
}

test('2025 brackets: a $100k single filer', () => {
  const r = compute(2025, 'single', { wages: 115750 });
  assert.equal(r.taxable_income, 100000);
  // 1192.50 + 4386.00 + 0.22 * (100000 - 48475)
  assert.ok(Math.abs(r.regular_tax - 16914) < 1, String(r.regular_tax));
});
