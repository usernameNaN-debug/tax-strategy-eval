// US federal individual income tax for TY2025 and TY2026 (plus TY2022, for
// amended returns). Covers what the benchmark households need: brackets,
// standard deduction, OBBBA Schedule 1-A (senior, tips, overtime, car loan),
// QDCG worksheet, Social Security taxation, SE tax, QBI below threshold,
// SALT cap with phase-down, NIIT, a simple AMT check, CDCC, Saver's credit,
// CTC/ODC/ACTC and EITC by formula.
//
// Ported line for line from the Python engine that produced the household
// reference values; test/engine.test.mjs checks the two agree.

const INF = Infinity;

const Y2025 = {
  brackets: {
    single: [[11925, .10], [48475, .12], [103350, .22], [197300, .24], [250525, .32], [626350, .35], [INF, .37]],
    mfj: [[23850, .10], [96950, .12], [206700, .22], [394600, .24], [501050, .32], [751600, .35], [INF, .37]],
    hoh: [[17000, .10], [64850, .12], [103350, .22], [197300, .24], [250500, .32], [626350, .35], [INF, .37]],
  },
  std: { single: 15750, mfj: 31500, hoh: 23625 },
  addl65: { single: 2000, hoh: 2000, mfj: 1600 },
  ltcg0: { single: 48350, mfj: 96700, hoh: 64750 },
  ltcg15: { single: 533400, mfj: 600050, hoh: 566700 },
  senior: 6000, senior_thr: { single: 75000, hoh: 75000, mfj: 150000 }, senior_rate: 0.06,
  tips_cap: 25000, ot_cap: { single: 12500, hoh: 12500, mfj: 25000 }, tipsot_thr: { single: 150000, hoh: 150000, mfj: 300000 },
  car_cap: 10000, car_thr: { single: 100000, hoh: 100000, mfj: 200000 },
  salt_cap: 40000, salt_thr: 500000, salt_floor: 10000, salt_rate: 0.30,
  charity_floor: 0.0,
  ctc: 2200, actc: 1700, odc: 500, ctc_thr: { single: 200000, hoh: 200000, mfj: 400000 },
  eitc: {
    0: [8490, 649, .0765, .0765, 10620, 17730],
    1: [12730, 4328, .34, .1598, 23350, 30470],
    2: [17880, 7152, .40, .2106, 23350, 30470],
    3: [17880, 8046, .45, .2106, 23350, 30470],
  },
  eitc_inv_limit: 11950,
  savers: { mfj: [47500, 51000, 79000], hoh: [35625, 38250, 59250], single: [23750, 25500, 39500] },
  ss_wage_base: 176100,
  amt_exempt: { mfj: 137000, single: 88100, hoh: 88100 }, amt_po: { mfj: 1252700, single: 626350, hoh: 626350 }, amt_28: 239100,
  cdcc_rule: '2025',
  sch1a: true,
};

const Y2026 = {
  ...Y2025,
  brackets: {
    single: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [INF, .37]],
    mfj: [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [INF, .37]],
    hoh: [[17700, .10], [67450, .12], [105700, .22], [201750, .24], [256200, .32], [640600, .35], [INF, .37]],
  },
  std: { single: 16100, mfj: 32200, hoh: 24150 },
  addl65: { single: 2050, hoh: 2050, mfj: 1650 },
  ltcg0: { single: 49450, mfj: 98900, hoh: 66200 },
  ltcg15: { single: 545500, mfj: 613700, hoh: 579600 },
  salt_cap: 40400, salt_thr: 505000,
  charity_floor: 0.005,
  eitc: {
    0: [8680, 664, .0765, .0765, 10860, 18140],
    1: [13020, 4427, .34, .1598, 23890, 31160],
    2: [18290, 7316, .40, .2106, 23890, 31160],
    3: [18290, 8231, .45, .2106, 23890, 31160],
  },
  cdcc_rule: '2026',
};

const Y2022 = {
  brackets: {
    single: [[10275, .10], [41775, .12], [89075, .22], [170050, .24], [215950, .32], [539900, .35], [INF, .37]],
    mfj: [[20550, .10], [83550, .12], [178150, .22], [340100, .24], [431900, .32], [647850, .35], [INF, .37]],
    hoh: [[14650, .10], [55900, .12], [89050, .22], [170050, .24], [215950, .32], [539900, .35], [INF, .37]],
  },
  std: { single: 12950, mfj: 25900, hoh: 19400 },
  addl65: { single: 1750, hoh: 1750, mfj: 1400 },
  ltcg0: { single: 41675, mfj: 83350, hoh: 55800 },
  ltcg15: { single: 459750, mfj: 517200, hoh: 488500 },
  salt_cap: 10000, salt_thr: INF, salt_floor: 10000, salt_rate: 0.0,
  charity_floor: 0.0,
  ctc: 2000, actc: 1500, odc: 500, ctc_thr: { single: 200000, hoh: 200000, mfj: 400000 },
  eitc: {
    0: [7320, 560, .0765, .0765, 9160, 15290],
    1: [10980, 3733, .34, .1598, 20130, 26260],
    2: [15410, 6164, .40, .2106, 20130, 26260],
    3: [15410, 6935, .45, .2106, 20130, 26260],
  },
  eitc_inv_limit: 10300,
  savers: { mfj: [41000, 44000, 68000], hoh: [30750, 33000, 51000], single: [20500, 22000, 34000] },
  ss_wage_base: 147000,
  amt_exempt: { mfj: 118100, single: 75900, hoh: 75900 }, amt_po: { mfj: 1079800, single: 539900, hoh: 539900 }, amt_28: 206100,
  cdcc_rule: '2025',
  sch1a: false,
};

export const PARAMS = { 2022: Y2022, 2025: Y2025, 2026: Y2026 };

const { max, min, floor, ceil } = Math;

export function bracketTax(ti, status, yr) {
  let tax = 0, lo = 0;
  for (const [hi, r] of PARAMS[yr].brackets[status]) {
    if (ti > lo) tax += (min(ti, hi) - lo) * r;
    lo = hi;
  }
  return tax;
}

// Qualified Dividends and Capital Gain Tax Worksheet.
export function qdcgTax(ti, pref, status, yr) {
  const p = PARAMS[yr];
  pref = max(0, min(pref, ti));
  const ordinary = ti - pref;
  const z = p.ltcg0[status], f = p.ltcg15[status];
  const at0 = max(0, min(ti, z) - ordinary);
  const rem = pref - at0;
  const at15 = max(0, min(rem, f - max(ordinary, z)));
  const at20 = rem - at15;
  const t = bracketTax(ordinary, status, yr) + 0.15 * at15 + 0.20 * at20;
  return min(t, bracketTax(ti, status, yr));
}

export function ssTaxable(ss, other, status) {
  if (ss <= 0) return 0;
  const [base, adj] = status === 'mfj' ? [32000, 44000] : [25000, 34000];
  const pi = 0.5 * ss + other;
  if (pi <= base) return 0;
  if (pi <= adj) return min(0.5 * ss, 0.5 * (pi - base));
  return min(0.85 * ss, 0.85 * (pi - adj) + min(0.5 * ss, 0.5 * (adj - base)));
}

export function compute(yr, status, x) {
  const p = PARAMS[yr];
  const g = (k, d = 0) => (x[k] ?? d);
  const out = {};
  // Self-employment.
  const netC = g('sched_c_net');
  let seTax = 0;
  if (netC > 0) {
    const nese = 0.9235 * netC;
    if (nese >= 400) seTax = 0.124 * min(nese, max(0, p.ss_wage_base - g('ss_wages'))) + 0.029 * nese;
  }
  const halfSe = seTax / 2;
  const sep = g('sep');
  const sehi = netC > 0 ? min(g('sehi_premiums'), max(0, netC - halfSe - sep - g('solo401k_deferral'))) : 0;
  Object.assign(out, { se_tax: seTax, half_se: halfSe, sehi });
  // Capital gains.
  const st = g('st_gain'), lt = g('lt_gain');
  const netCg = st + lt;
  const cgInIncome = max(-3000, netCg);
  const netLtcgPref = max(0, min(lt, netCg));
  const pref = g('qual_div') + netLtcgPref;
  // Income.
  const other = g('wages') + g('interest') + g('ord_div') + cgInIncome + g('ira_taxable') + g('pension_taxable') + netC + g('other_income');
  const adjustments = halfSe + sep + sehi + g('hsa_ded') + g('ira_ded') + g('other_adj') + g('solo401k_deferral');
  const ssTax = ssTaxable(g('ss_benefits'), other - adjustments + g('tax_exempt_int'), status);
  const agi = other + ssTax - adjustments;
  Object.assign(out, { other_income_total: other, ss_taxable: ssTax, adjustments, agi });
  // Deductions.
  const n65 = g('n65', 0);
  const std = p.std[status] + n65 * p.addl65[status];
  let saltCap = max(p.salt_floor, p.salt_cap - p.salt_rate * max(0, agi - p.salt_thr));
  if (yr === 2022) saltCap = 10000;
  const salt = min(g('salt_paid'), saltCap);
  const medical = max(0, g('medical') - 0.075 * agi);
  const charity = g('charity');
  const charityItem = max(0, charity - p.charity_floor * agi);
  const itemized = salt + g('mortgage_int') + charityItem + medical;
  const itemizing = Boolean(x.force_itemize) || itemized > std;
  const ded = itemizing ? itemized : std;
  Object.assign(out, { std, itemized, salt_cap: saltCap, salt_allowed: salt, itemizing, deduction: ded });
  // 2026+: non-itemizer charitable deduction.
  let nonitemChar = 0;
  if (yr >= 2026 && !itemizing) nonitemChar = min(g('charity_cash_public', charity), status === 'mfj' ? 2000 : 1000);
  // Schedule 1-A (2025-2028).
  let sch1a = 0;
  const det = {};
  if (p.sch1a) {
    const magi = agi;
    const per = max(0, p.senior - p.senior_rate * max(0, magi - p.senior_thr[status]));
    det.senior = g('n_senior', 0) * per;
    const tips = min(g('tips'), p.tips_cap);
    const red = 100 * floor(max(0, magi - p.tipsot_thr[status]) / 1000);
    det.tips = max(0, tips - red);
    const ot = min(g('ot_premium'), p.ot_cap[status]);
    det.ot = max(0, ot - red);
    const cl = min(g('car_loan_int'), p.car_cap);
    const redC = 200 * ceil(max(0, magi - p.car_thr[status]) / 1000);
    det.car = max(0, cl - redC);
    sch1a = det.senior + det.tips + det.ot + det.car;
  }
  out.sch1a = det;
  // QBI (taxable income below threshold).
  const tiBeforeQbi = max(0, agi - ded - sch1a - nonitemChar);
  let qbi = 0;
  if (netC > 0 && !x.no_qbi) {
    const qbiBase = netC - halfSe - sehi - sep - g('solo401k_deferral');
    qbi = max(0, min(0.2 * qbiBase, 0.2 * max(0, tiBeforeQbi - pref)));
  }
  out.qbi = qbi;
  const ti = max(0, tiBeforeQbi - qbi);
  out.taxable_income = ti;
  const tax = qdcgTax(ti, pref, status, yr);
  // AMT (simple: add back SALT if itemizing).
  const amti = ti + (itemizing ? salt : 0);
  const ex = max(0, p.amt_exempt[status] - 0.25 * max(0, amti - p.amt_po[status]));
  const baseAmt = max(0, amti - ex);
  const prefAmt = min(pref, baseAmt);
  const ordAmt = baseAmt - prefAmt;
  const tmtOrd = 0.26 * min(ordAmt, p.amt_28) + 0.28 * max(0, ordAmt - p.amt_28);
  const tmt = tmtOrd + (qdcgTax(ti, pref, status, yr) - bracketTax(ti - min(pref, ti), status, yr));
  const amt = itemizing ? max(0, tmt - tax) : 0;
  Object.assign(out, { regular_tax: tax, amt });
  const before = tax + amt;
  // Credits: CDCC, Saver's, CTC/ODC (nonrefundable order).
  const nCare = g('n_care', 0);
  let cdcc = 0;
  if (nCare) {
    const cap = (nCare === 1 ? 3000 : 6000) - g('dcfsa');
    const exp = max(0, min(g('care_exp') - g('dcfsa'), cap, g('lower_earner', INF)));
    let rate;
    if (p.cdcc_rule === '2025') rate = max(20, 35 - ceil(max(0, agi - 15000) / 2000)) / 100;
    else {
      let r = max(35, 50 - ceil(max(0, agi - 15000) / 2000));
      const [thr2, step] = status === 'mfj' ? [150000, 4000] : [75000, 2000];
      r = max(20, r - ceil(max(0, agi - thr2) / step));
      rate = r / 100;
    }
    cdcc = min(rate * exp, before);
  }
  let savers = 0;
  const contribs = x.savers_contrib || [];
  if (contribs.length) {
    const [a, b, c] = p.savers[status];
    const rate = agi <= a ? .5 : agi <= b ? .2 : agi <= c ? .1 : 0;
    savers = min(contribs.reduce((s, cc) => s + min(cc, 2000), 0) * rate, max(0, before - cdcc));
  }
  const nCtc = g('n_ctc', 0), nOdc = g('n_odc', 0);
  let ctcTotal = nCtc * p.ctc + nOdc * p.odc;
  ctcTotal = max(0, ctcTotal - 50 * ceil(max(0, agi - p.ctc_thr[status]) / 1000));
  const limit = max(0, before - cdcc - savers);
  const ctcNonref = min(ctcTotal, limit);
  const ei = netC > 0 ? g('wages') + max(0, netC - halfSe) : g('wages');
  let actc = 0;
  if (nCtc) actc = min(ctcTotal - ctcNonref, nCtc * p.actc, 0.15 * max(0, ei - 2500));
  let eitc = 0;
  if ('eitc_children' in x) {
    const inv = g('interest') + g('ord_div') + max(0, netCg) + g('tax_exempt_int');
    if (inv <= p.eitc_inv_limit) {
      const n = min(Math.trunc(x.eitc_children), 3);
      const [, mx, rin, rpo, thrO, thrJ] = p.eitc[n];
      const thr = status === 'mfj' ? thrJ : thrO;
      const c1 = min(rin * ei, mx);
      const po = (inc) => max(0, mx - rpo * max(0, inc - thr));
      eitc = min(c1, po(ei));
      if (agi > thr) eitc = min(eitc, po(agi));
      eitc = max(0, eitc);
    }
  }
  const incomeTax = before - cdcc - savers - ctcNonref;
  const nii = g('interest') + g('ord_div') + max(-3000, netCg);
  const niitThr = status === 'mfj' ? 250000 : 200000;
  const niit = 0.038 * max(0, min(nii, agi - niitThr));
  const otherTaxes = seTax + niit + g('excise') + g('penalty');
  const totalTax = incomeTax + otherTaxes;
  const refundable = actc + eitc;
  const payments = g('withholding') + g('est_payments');
  Object.assign(out, {
    cdcc, savers, ctc_nonref: ctcNonref, actc, eitc, income_tax_after_nonref: incomeTax,
    niit, other_taxes: otherTaxes, total_tax: totalTax, refundable,
    net_federal_burden: totalTax - refundable, refund: payments + refundable - totalTax, earned_income: ei,
    nonitem_char: nonitemChar,
  });
  return out;
}

export const burden = (r) => r.net_federal_burden;
