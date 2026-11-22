// The macro year, simulated. The shape follows 2025 (a February peak, a sharp
// April drawdown after the tariff announcements, a recovery by summer, rate
// cuts in the fall), but every number here is generated, not historical.
import { stream } from './rng.js';

const ANCHORS = [
  // [day of year, index level]
  [0, 100.0], [30, 102.7], [49, 104.6], [71, 94.5], [89, 98.0], [97, 84.7], [119, 94.4],
  [150, 100.5], [180, 105.4], [211, 107.6], [241, 109.6], [272, 113.3], [303, 115.8],
  [324, 112.0], [364, 116.3],
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function dayOfYear(month, day) {
  return MONTH_START[month - 1] + day - 1;
}

export function indexPath(seed = 2025) {
  const rand = stream('macro', 'index', seed);
  const out = new Array(365);
  let k = 0;
  for (let d = 0; d < 365; d++) {
    while (k < ANCHORS.length - 2 && d > ANCHORS[k + 1][0]) k++;
    const [d0, v0] = ANCHORS[k];
    const [d1, v1] = ANCHORS[k + 1];
    const t = (d - d0) / Math.max(1, d1 - d0);
    const s = t * t * (3 - 2 * t);
    out[d] = v0 + (v1 - v0) * s;
  }
  // Day-to-day noise that vanishes at the anchors.
  let walk = 0;
  for (let d = 0; d < 365; d++) {
    walk = walk * 0.8 + (rand() - 0.5) * 0.9;
    const near = ANCHORS.some(([a]) => Math.abs(a - d) < 2);
    out[d] = +(out[d] + (near ? 0 : walk)).toFixed(2);
  }
  return out;
}

export function macroYear(seed = 2025) {
  const index = indexPath(seed);
  const cpi = [3.0, 2.8, 2.4, 2.3, 2.4, 2.7, 2.7, 2.9, 3.0, 3.0, 2.8, 2.7];
  const fed = [4.50, 4.50, 4.50, 4.50, 4.50, 4.50, 4.50, 4.50, 4.25, 4.00, 4.00, 3.75];
  const tenYear = [4.6, 4.3, 4.2, 4.2, 4.4, 4.3, 4.4, 4.2, 4.1, 4.1, 4.0, 4.2];
  const peak = index.slice(0, 120).reduce((m, v, i) => (v > m.v ? { v, i } : m), { v: -1, i: 0 });
  const trough = index.slice(peak.i, 150).reduce((m, v, i) => (v < m.v ? { v, i: i + peak.i } : m), { v: 1e9, i: 0 });
  return {
    seed,
    index,
    cpi,
    fed,
    tenYear,
    drawdown: { peakDay: peak.i, troughDay: trough.i, depth: +(1 - trough.v / peak.v).toFixed(3) },
    // Public events. The agent can find these on the news screen.
    events: [
      { day: dayOfYear(1, 2), topic: 'brackets', text: 'New inflation-adjusted brackets take effect.' },
      { day: dayOfYear(4, 2), topic: 'tariffs', text: 'Tariff announcement. Stocks slide.' },
      { day: trough.i, topic: 'drawdown', text: `Index ${Math.round(trough.v / peak.v * 100 - 100)}% from its February high.` },
      { day: dayOfYear(7, 4), topic: 'tax-bill', text: 'Tax bill signed. New deductions for tips, overtime and seniors; SALT cap raised.' },
      { day: dayOfYear(8, 7), topic: 'w2', text: 'IRS: no changes to 2025 W-2s or withholding tables.' },
      { day: dayOfYear(9, 17), topic: 'rates', text: 'First rate cut of the year.' },
      { day: dayOfYear(11, 1), topic: 'enrollment', text: 'Open enrollment season.' },
      { day: dayOfYear(12, 10), topic: 'rates', text: 'Third cut. Policy rate at 3.75%.' },
    ],
  };
}

// Resample the daily path to n columns for the skyline.
export function resample(index, n) {
  const out = new Array(n);
  for (let x = 0; x < n; x++) {
    const d = (x / (n - 1)) * (index.length - 1);
    const i = Math.floor(d), f = d - i;
    out[x] = index[i] * (1 - f) + (index[Math.min(index.length - 1, i + 1)] ?? index[i]) * f;
  }
  return out;
}
