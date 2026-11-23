// Hand-drawn marks and paint. Everything is seeded, so a line looks drawn
// but draws the same way on every visit.

export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = (s) => [...String(s)].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619)) >>> 0, 2166136261);
const f = (n) => n.toFixed(1);

// Catmull-Rom through points, as cubic Béziers.
export function smooth(pts, closed = false) {
  if (pts.length < 2) return '';
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f(P[1][0])} ${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

// A circle drawn by hand: starts somewhere, overshoots, never quite closes.
export function roughCircle(cx, cy, r, seed = 1, wob = 0.05) {
  const R = rng(seed);
  const a0 = R() * Math.PI * 2, turns = 1.08 + R() * 0.1, n = 14;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + t * turns * Math.PI * 2;
    const rr = r * (1 + (R() - 0.5) * wob * 2 + t * 0.05);
    pts.push([cx + Math.cos(a) * rr * 1.03, cy + Math.sin(a) * rr * 0.97]);
  }
  return smooth(pts);
}

// A line with a slight bow, the way a hand pulls a pencil.
export function roughLine(x1, y1, x2, y2, seed = 1, bow = 1.2) {
  const R = rng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4, b = Math.sin(t * Math.PI) * bow * (R() < 0.5 ? 1 : -0.6) + (R() - 0.5) * 0.6;
    pts.push([x1 + (x2 - x1) * t + nx * b, y1 + (y2 - y1) * t + ny * b]);
  }
  return smooth(pts);
}

export function roughRect(x, y, w, h, seed = 1) {
  const R = rng(seed), j = () => (R() - 0.5) * 2.2;
  return [
    roughLine(x + j(), y + j(), x + w + j(), y + j(), seed + 1, 0.8),
    roughLine(x + w + j(), y - 2, x + w + j(), y + h + 2, seed + 2, 1),
    roughLine(x + w + 2, y + h + j(), x - 1, y + h + j(), seed + 3, 0.8),
    roughLine(x + j(), y + h + 2, x + j(), y - 3, seed + 4, 1),
  ].join(' ');
}

// Watercolor blob: a wobbly closed shape.
export function blob(cx, cy, rx, ry, seed = 1, n = 9) {
  const R = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 0.82 + R() * 0.3;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts, true);
}

// The paint filters, installed once per page.
export function installFilters() {
  if (document.getElementById('ink-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'ink-defs';
  s.setAttribute('aria-hidden', 'true');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = `
  <defs>
    <!-- watercolor: wobbly edge, pigment granulation -->
    <filter id="wc" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="2" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="shape"/>
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.45" result="ga"/>
      <feComposite in="shape" in2="ga" operator="in"/>
    </filter>
    <!-- larger washes for backgrounds -->
    <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="8" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="60" xChannelSelector="R" yChannelSelector="G" result="shape"/>
      <feGaussianBlur in="shape" stdDeviation="6" result="soft"/>
      <feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="3" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 1.35" result="ga"/>
      <feComposite in="soft" in2="ga" operator="in"/>
    </filter>
    <!-- dry brush: bristle streaks along the stroke, ragged ends -->
    <filter id="bristle" x="-4%" y="-40%" width="108%" height="180%">
      <feTurbulence type="fractalNoise" baseFrequency=".004 .28" numOctaves="2" seed="4" result="s"/>
      <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.1 -.28" result="sa"/>
      <feComposite in="SourceGraphic" in2="sa" operator="in" result="streaked"/>
      <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="9" result="e"/>
      <feDisplacementMap in="streaked" in2="e" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <!-- pencil: a grainy, slightly broken line -->
    <filter id="pencil" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="1" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.7" result="ga"/>
      <feComposite in="SourceGraphic" in2="ga" operator="in" result="broken"/>
      <feTurbulence type="fractalNoise" baseFrequency=".2" numOctaves="1" seed="6" result="w"/>
      <feDisplacementMap in="broken" in2="w" scale="1.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>`;
  document.body.prepend(s);
}

// When the money arrives, as flower colors.
export const SECTION = {
  file: { name: 'This return', color: '#e0a63a', flower: 'Marigold' },
  open: { name: 'Before April 15', color: '#cf7651', flower: 'Poppy' },
  next: { name: 'Next year', color: '#7d9dc8', flower: 'Cornflower' },
  missed: { name: 'Earlier years', color: '#cd8a96', flower: 'Sweet pea' },
};

// Small hand-drawn weather marks, 40×40.
export const GLYPH = {
  sun: (s = 1) => `<g fill="none" stroke="#2e2923" stroke-width="1.3" stroke-linecap="round" filter="url(#pencil)">
    <path d="${blob(20, 20, 7, 7, 3 + s, 7)}" fill="#efc561" fill-opacity=".8" stroke="#b9862c"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4 + 0.2; return `<path d="${roughLine(20 + Math.cos(a) * 11, 20 + Math.sin(a) * 11, 20 + Math.cos(a) * 15.5, 20 + Math.sin(a) * 15.5, i + s)}" stroke="#b9862c"/>`; }).join('')}
  </g>`,
  cloud: (s = 1) => `<g filter="url(#pencil)"><path d="M9 26 C 5 26 5 19 10 19 C 10 13 18 11 21 16 C 23 12 31 13 30 19 C 35 19 35 26 30 26 Z" fill="#dfe3e6" stroke="#5d544a" stroke-width="1.2" stroke-linejoin="round"/></g>`,
  rain: (s = 1) => `<g filter="url(#pencil)"><path d="M9 21 C 5 21 5 14 10 14 C 10 8 18 6 21 11 C 23 7 31 8 30 14 C 35 14 35 21 30 21 Z" fill="#c8d1da" stroke="#5d544a" stroke-width="1.2" stroke-linejoin="round"/>
    <g stroke="#6f8daa" stroke-width="1.4" stroke-linecap="round" class="drops">${[12, 19, 26].map((x, i) => `<path d="${roughLine(x, 25 + i % 2 * 2, x - 3, 33 + i % 2 * 2, x)}"/>`).join('')}</g></g>`,
  moon: (s = 1) => `<g filter="url(#pencil)"><path d="M24 8 C 14 9 11 22 18 29 C 23 33 30 31 33 27 C 25 28 19 21 24 8 Z" fill="#d9d4ea" stroke="#5d544a" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="${roughLine(9, 11, 9, 15, 2)} ${roughLine(7, 13, 11, 13, 3)}" stroke="#6d6488" stroke-width="1.1" stroke-linecap="round"/></g>`,
  leaf: (s = 1) => `<g filter="url(#wc)"><path d="M10 30 C 12 18 22 10 32 9 C 31 20 22 29 10 30 Z" fill="#8fae86" stroke="#5c7d55" stroke-width="1" fill-opacity=".9"/><path d="M11 29 C 17 22 23 16 30 11" stroke="#5c7d55" stroke-width="1" fill="none"/></g>`,
};
