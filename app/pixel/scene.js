// Static drawing of the world. Drawn once into a Raster; the stage copies it
// every frame and draws everything that moves on top.
import { C, u32 } from './palette.js';
import { hash2 } from './gfx.js';
import {
  W, H, FEET, IRS_BOOKS, LAW_LOW, LAW_HIGH, CATALOG, BOOTHS, CAB_DRAWERS, VAULT_BOXES, VAULT_LOOSE,
} from './layout.js';

const BOOKS_IRS = ['#ece5d6', '#ddd2bd', '#cdbfa5', '#e5dccb', '#d4c8b1'].map(u32);
const BOOKS_IRS_D = ['#cfc4ae', '#bfb197', '#ad9e83', '#c7bca6', '#b6a98f'].map(u32);
const BOOKS_LAW = ['#7d4a36', '#5e3a2c', '#46503f', '#3a3430', '#86643a', '#6a3f3a'].map(u32);
const BOOKS_LAW_D = ['#5c3426', '#432a1f', '#323a2d', '#262220', '#64492a', '#4c2c29'].map(u32);
const BOX = ['#d3b78e', '#bb9d70', '#9b7d55'].map(u32);
const MANILA = ['#eedcae', '#d9c48f'].map(u32);
const ASPHALT = u32('#9c968f');
const ASPHALT_D = u32('#8a847d');

// 3x5 digits for in-world readouts.
const DIGITS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  '$': ['011', '110', '010', '011', '110'], '%': ['101', '001', '010', '100', '101'],
  '.': ['000', '000', '000', '000', '010'], '-': ['000', '000', '111', '000', '000'],
  ':': ['000', '010', '000', '010', '000'], ' ': ['000', '000', '000', '000', '000'],
};
export function digits(r, s, x, y, c) {
  for (const ch of String(s)) {
    const g = DIGITS[ch] || DIGITS[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') r.px(x + i, y + j, c);
    x += 4;
  }
}

export function hillY(marketX, x) {
  const v = marketX[Math.max(0, Math.min(marketX.length - 1, x))];
  return Math.round(35 - (v - 82) * 0.85);
}

export function drawStatic(r, marketX) {
  hills(r, marketX);
  ground(r);
  officeShell(r);
  stairs(r);
  lobby(r);
  office(r);
  library(r);
  portals(r);
  news(r);
  archive(r);
  roof(r);
  street(r);
  alley(r);
  home(r);
}

// ---------------------------------------------------------------- materials

function wallpaper(r, x, y, w, h, base = C.pl, stripe = C.plM) {
  r.r(x, y, w, h, base);
  for (let xx = x + 3; xx < x + w; xx += 8) for (let yy = y; yy < y + h; yy += 2) r.px(xx, yy, stripe);
}

function wainscot(r, x, y, w, h) {
  r.r(x, y, w, h, C.wd);
  r.hl(x, y, w, C.wdDD);
  r.hl(x, y + 1, w, C.wdL);
  for (let px = x + 2; px + 12 < x + w; px += 16) {
    r.r(px, y + 4, 12, h - 7, C.wd);
    r.hl(px, y + 4, 12, C.wdD); r.vl(px, y + 4, h - 7, C.wdD);
    r.hl(px + 1, y + h - 4, 11, C.wdL); r.vl(px + 11, y + 5, h - 8, C.wdL);
  }
}

function baseboard(r, x, y, w) {
  r.hl(x, y, w, C.wdL);
  r.hl(x, y + 1, w, C.wdD);
}

function floorStrip(r, x, feet, w, kind) {
  const y = feet - 4;
  if (kind === 'tile') {
    for (let yy = y; yy <= feet; yy++) for (let xx = x; xx < x + w; xx++) {
      const a = (Math.floor((xx - (yy - y) * 2) / 6) + Math.floor((yy - y) / 3)) & 1;
      r.px(xx, yy, a ? C.tileL : C.tileD);
    }
  } else if (kind === 'wood') {
    for (let yy = y; yy <= feet; yy++) {
      const off = (yy * 13) % 23;
      for (let xx = x; xx < x + w; xx++) {
        const seam = (xx + off) % 23 === 0;
        r.px(xx, yy, seam ? C.wdD : (yy === y ? C.wdL : hash2(xx, yy) < 0.08 ? C.wdD : C.wd));
      }
    }
  } else if (kind === 'carpet') {
    for (let yy = y; yy <= feet; yy++) for (let xx = x; xx < x + w; xx++) {
      r.px(xx, yy, yy === y ? C.carpetL : ((xx + yy) % 2 && hash2(xx, yy) < 0.5) ? C.carpetD : C.carpet);
    }
  } else if (kind === 'lino') {
    for (let yy = y; yy <= feet; yy++) for (let xx = x; xx < x + w; xx++) r.px(xx, yy, (xx % 12 === 0) ? C.linoD : yy === y ? C.plL : C.lino);
  } else {
    for (let yy = y; yy <= feet; yy++) for (let xx = x; xx < x + w; xx++) r.px(xx, yy, yy === y ? C.concL : hash2(xx, yy) < 0.12 ? C.concD : C.conc);
  }
}

function brick(r, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const row = Math.floor(yy / 3);
    const mortarH = yy % 3 === 2;
    const mortarV = ((xx + (row % 2) * 3) % 6) === 0;
    const c = mortarH || mortarV ? C.brD : (hash2(xx >> 1, row) < 0.3 ? C.brL : C.br);
    r.px(xx, yy, c);
  }
}

function slabBand(r, x, y, w) {
  r.hl(x, y, w, C.ink);
  r.r(x, y + 1, w, 2, C.slab);
  r.hl(x, y + 3, w, C.slabD);
}

function pendant(r, x, y, drop = 4) {
  r.vl(x, y, drop, C.ink);
  r.r(x - 3, y + drop, 7, 2, C.dwD);
  r.hl(x - 2, y + drop + 2, 5, C.bzL);
}

function books(r, x0, x1, board, set, setD, seed, hmin = 6, hmax = 8) {
  let x = x0;
  while (x <= x1) {
    const t = hash2(x, board + seed);
    const wd = t < 0.25 ? 2 : t < 0.8 ? 3 : 4;
    if (x + wd - 1 > x1) break;
    if (t > 0.93) { x += 2; continue; }
    const h = hmin + Math.floor(hash2(board, x * 3 + seed) * (hmax - hmin + 1));
    const k = Math.floor(hash2(x * 7, seed) * set.length);
    const top = board - h;
    r.r(x, top, wd, h, set[k]);
    r.vl(x + wd - 1, top, h, setD[k]);
    r.hl(x, top, wd, setD[k]);
    if (wd >= 3) {
      const band = top + 2 + Math.floor(hash2(x, 99) * 2);
      r.hl(x, band, wd - 1, setD[k]);
      if (set === BOOKS_LAW) r.px(x + 1, band + 1, C.bzL);
    }
    x += wd;
  }
}

function plant(r, x, y, big = false) {
  const h = big ? 16 : 9;
  r.r(x + 1, y + h - 5, 6, 5, C.brL); r.hl(x, y + h - 5, 8, C.brD); r.vl(x + 6, y + h - 4, 4, C.brD);
  const leaves = big
    ? [[3, 0], [1, 2], [5, 1], [0, 5], [6, 4], [2, 6], [4, 7], [3, 3], [7, 7], [-1, 8], [1, 9]]
    : [[3, 0], [1, 1], [5, 1], [2, 3], [4, 3], [0, 3], [6, 2]];
  for (const [dx, dy] of leaves) {
    r.px(x + dx, y + dy, C.lf); r.px(x + dx + 1, y + dy, C.lfD); r.px(x + dx, y + dy + 1, C.lfD); r.px(x + dx - 1, y + dy, C.lfL);
  }
}

function windowPane(r, x, y, w, h, curtains = false) {
  r.r(x, y, w, h, C.wdD);
  r.r(x + 2, y + 2, w - 4, h - 4, C.glass);
  for (let k = 0; k < h - 4; k += 3) r.px(x + 3 + (k % 5), y + 3 + k, C.glassT);
  r.vl(x + (w >> 1), y + 2, h - 4, C.wdD);
  r.hl(x + 2, y + (h >> 1), w - 4, C.wdD);
  r.hl(x - 1, y + h, w + 2, C.wdL);
  r.hl(x - 1, y + h + 1, w + 2, C.wdDD);
  if (curtains) {
    for (const cx of [x - 3, x + w - 1]) {
      r.r(cx, y - 1, 4, h + 3, C.sage);
      r.vl(cx + 1, y - 1, h + 3, C.sageD);
      r.vl(cx + 3, y, h + 2, C.sageL);
    }
    r.hl(x - 5, y - 2, w + 10, C.bzD);
  }
}

// ------------------------------------------------------------------ outside

function hills(r, marketX) {
  for (let x = 0; x < W; x++) {
    const y = hillY(marketX, x);
    r.r(x, y + 1, 1, 194 - y, C.hill);
    // A second, nearer ridge gives depth without competing with the line.
    const near = 150 + Math.round(Math.sin(x / 37) * 6 + Math.sin(x / 13) * 2);
    r.r(x, near, 1, 194 - near, C.hillD);
    r.px(x, y, C.hillLine);
    if (x > 0) {
      const yp = hillY(marketX, x - 1);
      if (Math.abs(yp - y) > 1) r.r(x, Math.min(y, yp), 1, Math.abs(yp - y), C.hillLine);
    }
  }
}

function ground(r) {
  // Street and sidewalk.
  r.r(0, 194, W, 1, C.ink);
  r.r(0, 195, W, 3, ASPHALT);
  for (let x = 0; x < W; x += 7) r.px(x, 196, ASPHALT_D);
  for (let y = 198; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= 48 && x <= 347 && y <= 247) continue;
      if (((x - y) & 3) === 0) r.px(x, y, C.plD);
      else if (((x - y) & 3) === 2 && hash2(x, y) < 0.15) r.px(x, y, C.pl);
    }
  }
}

function officeShell(r) {
  // Back walls by room.
  wallpaper(r, 52, 148, 80, 46);
  wainscot(r, 52, 172, 80, 18);
  wallpaper(r, 136, 148, 164, 46, C.plL, C.pl);
  wallpaper(r, 52, 98, 248, 46, C.pl, C.plM);
  r.r(52, 128, 248, 12, C.dw);
  r.hl(52, 128, 248, C.dwL);
  wallpaper(r, 52, 48, 162, 46, C.plL, C.pl);
  wallpaper(r, 218, 48, 82, 46, C.pl, C.plM);
  wainscot(r, 218, 74, 82, 16);
  // Basement: concrete block.
  for (let y = 198; y < 244; y++) for (let x = 52; x < 300; x++) {
    const row = Math.floor((y - 198) / 6);
    const m = (y - 198) % 6 === 5 || ((x + (row % 2) * 8) % 16) === 0;
    r.px(x, y, m ? C.concD : (hash2(x, y) < 0.06 ? C.concD : C.conc));
  }
  r.r(304, 48, 40, 196, C.plD);
  for (let y = 48; y < 244; y += 2) for (let x = 306; x < 344; x += 9) r.px(x, y, C.pl);

  // Floors (visible strips).
  floorStrip(r, 52, FEET.g, 80, 'tile');
  floorStrip(r, 136, FEET.g, 164, 'wood');
  floorStrip(r, 52, FEET.f1, 248, 'carpet');
  floorStrip(r, 52, FEET.f2, 162, 'lino');
  floorStrip(r, 218, FEET.f2, 82, 'wood');
  floorStrip(r, 52, FEET.b, 248, 'conc');
  floorStrip(r, 304, FEET.g, 40, 'wood');
  floorStrip(r, 304, FEET.f1, 40, 'wood');
  floorStrip(r, 304, FEET.f2, 40, 'wood');
  floorStrip(r, 304, FEET.b, 40, 'conc');
  baseboard(r, 136, FEET.g - 6, 164);
  baseboard(r, 52, FEET.f2 - 6, 162);

  // Cut walls in section.
  brick(r, 48, 36, 4, 124);
  brick(r, 48, 194, 4, 54);
  brick(r, 344, 36, 4, 126);
  brick(r, 344, 194, 4, 54);
  r.hl(48, 159, 4, C.ink); r.hl(344, 161, 4, C.ink);
  // Door lintels.
  r.r(48, 157, 4, 2, C.dwD); r.r(344, 159, 4, 2, C.dwD);
  // Slabs.
  slabBand(r, 52, 94, 292);
  slabBand(r, 52, 144, 292);
  slabBand(r, 48, 194, 300);
  slabBand(r, 48, 244, 300);
  // Partitions with door gaps.
  const part = (x, top, bottom) => { r.r(x, top, 4, bottom - top, C.plD); r.vl(x, top, bottom - top, C.ink); r.vl(x + 3, top, bottom - top, C.ink); r.hl(x, bottom - 1, 4, C.dwD); };
  part(132, 148, 162);
  part(214, 48, 62);
  for (const [top, gapTop] of [[48, 62], [98, 112], [148, 162], [198, 212]]) part(300, top, gapTop);
}

function flight(r, x0, yb, dir) {
  for (let k = 1; k <= 10; k++) {
    const x = x0 + dir * 3 * k;
    const y = yb - 5 * k;
    const tx = dir > 0 ? x - 3 : x;
    r.r(tx, y + 1, 4, 1, C.wdL);
    r.r(tx, y + 2, 4, 4, C.wd);
    r.vl(dir > 0 ? x : x + 3, y + 2, 4, C.wdD);
    r.r(tx, y + 6, 4, yb - y - 5, C.wdD);
  }
  // Balusters and rail.
  for (let k = 0; k <= 30; k++) {
    const x = x0 + dir * k;
    const y = yb - Math.round(k * 5 / 3) - 12;
    r.px(x, y, C.dwD);
    if (k % 6 === 3) r.vl(x, y + 1, 11, C.wdDD);
  }
}

function stairs(r) {
  flight(r, 309, 243, 1);
  flight(r, 339, 193, -1);
  flight(r, 309, 143, 1);
}

// ------------------------------------------------------------------- lobby

function lobby(r) {
  // Door leaf, open, and a mat.
  r.r(52, 160, 4, 33, C.wd); r.vl(52, 160, 33, C.wdDD); r.vl(55, 160, 33, C.wdL); r.px(54, 177, C.bz);
  r.r(57, 191, 12, 2, C.sageD);
  // Window over the desk.
  windowPane(r, 72, 151, 24, 14);
  // Coat rack.
  r.vl(60, 158, 32, C.dwD); r.hl(57, 189, 7, C.dwD); r.hl(57, 158, 7, C.dwD);
  r.r(57, 162, 6, 13, C.navy || C.wdD);
  r.r(57, 162, 6, 13, u32('#56627c')); r.vl(62, 163, 12, u32('#3f4a60')); r.hl(57, 162, 6, u32('#6b7894'));
  r.r(57, 156, 7, 2, u32('#5a4636')); r.r(58, 154, 5, 2, u32('#6e5744'));
  // Secretary desk top and typewriter. The front is drawn after the actors.
  r.r(63, 176, 34, 1, C.wdL); r.r(63, 177, 34, 2, C.wd); r.hl(63, 179, 34, C.wdDD);
  r.r(73, 169, 15, 7, C.mDD); r.hl(73, 169, 15, C.mD);
  for (let x = 74; x < 87; x += 2) { r.px(x, 172, C.mL); r.px(x + 1, 174, C.mL); }
  r.r(76, 163, 9, 6, C.paper); r.hl(76, 163, 9, C.paper3); r.hl(77, 165, 6, C.paper3); r.hl(77, 167, 5, C.paper3);
  r.r(74, 168, 13, 1, C.ink);
  // Desk lamp.
  r.r(90, 174, 5, 2, C.bzD); r.vl(92, 168, 6, C.bzD); r.r(89, 165, 7, 3, C.bz); r.hl(89, 165, 7, C.bzL);
  plant(r, 64, 166);
  // Flyer rack on the wall.
  r.r(98, 158, 10, 21, C.wdD); r.r(99, 159, 8, 19, C.wd);
  for (const y of [160, 166, 172]) {
    r.r(99, y, 8, 5, C.paper);
    r.hl(100, y + 1, 5, C.plD); r.hl(100, y + 3, 3, C.plD); r.px(105, y + 3, C.paper4);
    r.hl(98, y + 5, 10, C.wdDD);
  }
  // Water cooler.
  r.r(110, 156, 7, 2, C.mD);
  r.r(109, 158, 9, 11, C.water); r.vl(109, 158, 11, C.waterD); r.vl(117, 158, 11, C.waterD);
  r.vl(111, 159, 8, C.glass); r.hl(109, 162, 9, C.waterD);
  r.r(108, 169, 11, 23, C.m); r.vl(108, 169, 23, C.mD); r.vl(118, 169, 23, C.mDD); r.hl(108, 169, 11, C.mL);
  r.r(110, 174, 3, 2, C.ink); r.r(115, 174, 2, 2, C.rose === undefined ? C.ink : C.mDD);
  r.r(110, 182, 7, 1, C.mD);
  pendant(r, 92, 148, 3);
}

// ------------------------------------------------------------------ office

function office(r) {
  // Corkboard.
  r.r(139, 153, 41, 23, C.wdD); r.r(140, 154, 39, 21, C.cork);
  for (let i = 0; i < 60; i++) r.px(140 + Math.floor(hash2(i, 3) * 39), 154 + Math.floor(hash2(i, 5) * 21), hash2(i, 7) < 0.5 ? C.corkD : C.corkL);
  r.hl(139, 153, 41, C.wdL);
  // Clock.
  r.disc(189, 158, 5, C.paper); r.ring(189, 158, 5, C.ink); r.ring(189, 158, 6, C.wdD);
  for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) r.px(189 + dx, 158 + dy, C.mD);
  // Calendar.
  r.r(199, 154, 12, 3, C.plD); r.px(201, 153, C.ink); r.px(208, 153, C.ink);
  r.r(199, 157, 12, 12, C.paper); r.outline(199, 154, 12, 15, C.paper4);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) r.px(201 + i * 3, 160 + j * 3, C.paper4);
  // Desk top.
  r.r(178, 176, 63, 1, C.wdL); r.r(178, 177, 63, 2, C.wd); r.hl(178, 179, 63, C.wdDD);
  // Banker's lamp.
  r.r(181, 174, 7, 2, C.bzD); r.vl(184, 169, 5, C.bzD); r.r(180, 166, 9, 3, C.dwD); r.hl(180, 166, 9, C.dwL); r.hl(181, 169, 7, C.bzL);
  // Tray.
  r.r(192, 173, 15, 3, C.wdD); r.hl(192, 173, 15, C.wdL);
  // Monitor.
  r.r(209, 157, 18, 14, C.mDD); r.r(211, 159, 14, 10, C.scrOff); r.hl(211, 159, 14, C.scrOffD);
  r.r(216, 171, 4, 3, C.mDD); r.r(213, 174, 10, 1, C.mD);
  // Keyboard.
  r.r(207, 175, 13, 1, C.mD);
  // Phone.
  r.r(227, 172, 8, 4, C.ink); r.r(226, 171, 10, 1, C.ink); r.px(228, 173, C.mD); r.px(231, 173, C.mD); r.px(233, 173, C.mD);
  // Jar (glass).
  r.vl(235, 162, 14, C.glassD); r.vl(241, 162, 14, C.glassD); r.hl(235, 175, 7, C.glassD);
  r.r(236, 160, 5, 2, C.mD); r.vl(236, 163, 10, C.glass);
  // Plant.
  plant(r, 243, 176, true);
  // Filing cabinet.
  r.r(252, 152, 15, 41, C.m); r.vl(252, 152, 41, C.mL); r.vl(266, 152, 41, C.mDD); r.hl(252, 152, 15, C.mL);
  for (const [x, y] of CAB_DRAWERS) {
    r.r(x, y, 11, 11, C.m); r.hl(x, y, 11, C.mL); r.hl(x, y + 10, 11, C.mD); r.vl(x + 10, y, 11, C.mD);
    r.r(x + 3, y + 3, 5, 2, C.paper); r.r(x + 4, y + 6, 3, 1, C.mDD);
  }
  // Engine: a brass adding machine on a small table.
  r.r(268, 178, 31, 1, C.wdL); r.r(268, 179, 31, 2, C.wd); r.hl(268, 181, 31, C.wdDD);
  r.vl(270, 182, 11, C.wdD); r.vl(296, 182, 11, C.wdD); r.hl(270, 188, 27, C.wdD);
  r.r(270, 161, 23, 17, C.bz); r.hl(270, 161, 23, C.bzL); r.vl(270, 161, 17, C.bzL); r.vl(292, 161, 17, C.bzD); r.hl(270, 177, 23, C.bzDD);
  r.outline(269, 160, 25, 18, C.ink);
  r.r(273, 163, 15, 7, C.paper); r.outline(272, 162, 17, 9, C.bzDD);
  for (let y = 172; y <= 175; y += 2) for (let x = 273; x < 290; x += 3) { r.px(x, y, C.paper2); r.px(x + 1, y, C.ink); }
  r.r(293, 166, 2, 3, C.ink);
  r.r(279, 158, 7, 2, C.ink);
  pendant(r, 196, 148, 3);
  pendant(r, 262, 148, 3);
}

// ----------------------------------------------------------------- library

function library(r) {
  // IRS publications: paper booklets on painted shelves.
  r.r(54, 99, 90, 43, C.wdD);
  r.r(56, 102, 86, 39, C.plD);
  r.r(54, 99, 90, 3, C.wd); r.hl(54, 99, 90, C.wdL);
  for (const b of [110, 120, 130, 140]) {
    books(r, 57, 141, b, BOOKS_IRS, BOOKS_IRS_D, 1, 6, 8);
    r.r(56, b, 86, 1, C.wdL); r.r(56, b + 1, 86, 1, C.wdD);
  }
  for (const [x, b] of IRS_BOOKS) { r.r(x, b - 8, 3, 8, C.paper2); r.vl(x + 2, b - 8, 8, C.paper4); r.hl(x, b - 8, 3, C.paper4); r.hl(x, b - 5, 2, C.plD); }
  // Window with curtains.
  windowPane(r, 150, 104, 18, 20, true);
  // Reading table with chairs and a lamp.
  r.r(172, 126, 38, 1, C.wdL); r.r(172, 127, 38, 2, C.wd); r.hl(172, 129, 38, C.wdDD);
  r.vl(175, 130, 13, C.wdD); r.vl(206, 130, 13, C.wdD);
  for (const cx of [166, 210]) { r.vl(cx, 120, 23, C.dwD); r.vl(cx + 4, 120, 23, C.dwD); r.hl(cx, 120, 5, C.dw); r.hl(cx, 132, 5, C.dw); for (let y = 122; y < 132; y += 3) r.px(cx + 2, y, C.dw); }
  r.r(193, 124, 7, 2, C.bzD); r.vl(196, 119, 5, C.bzD); r.r(192, 116, 9, 3, C.lfD); r.hl(192, 116, 9, C.lf); r.hl(193, 119, 7, C.bzL);
  // Card catalog.
  r.r(213, 113, 21, 30, C.wdD); r.r(214, 114, 19, 28, C.wd); r.hl(213, 113, 21, C.wdL);
  for (const [x, y] of CATALOG) { r.r(x, y, 5, 5, C.wdL); r.hl(x, y + 4, 5, C.wdD); r.vl(x + 4, y, 5, C.wdD); r.px(x + 2, y + 2, C.bz); }
  // Case law: leather on dark wood, with a brass rail for the ladder.
  r.r(236, 99, 63, 43, C.dwD);
  r.r(238, 102, 59, 39, C.dwDD);
  r.r(236, 99, 63, 3, C.dw); r.hl(236, 99, 63, C.dwL);
  for (const b of [110, 120, 130, 140]) {
    books(r, 239, 296, b, BOOKS_LAW, BOOKS_LAW_D, 7, 6, 8);
    r.r(238, b, 59, 1, C.dwL); r.r(238, b + 1, 59, 1, C.dwDD);
  }
  for (const [x, b] of [...LAW_LOW, ...LAW_HIGH]) { r.r(x, b - 8, 3, 8, u32('#6a3d2e')); r.vl(x + 2, b - 8, 8, u32('#4a281e')); r.px(x + 1, b - 5, C.bzL); }
  r.hl(236, 103, 63, C.bz);
  pendant(r, 120, 98, 3);
  pendant(r, 190, 98, 5);
  pendant(r, 266, 98, 3);
}

// ----------------------------------------------------------------- portals

function booth(r, x0, kind) {
  r.r(x0 + 2, 54, 34, 27, C.mD); r.r(x0 + 3, 55, 32, 25, C.m); r.hl(x0 + 3, 55, 32, C.mL); r.vl(x0 + 34, 55, 25, C.mD);
  // Sign plaque with a pictogram.
  r.r(x0 + 13, 49, 12, 6, C.wdD); r.r(x0 + 14, 50, 10, 4, C.paper2);
  const cx = x0 + 19, cy = 52;
  if (kind === 'benefits') { r.hl(cx - 1, cy, 3, C.ink); r.vl(cx, cy - 1, 3, C.ink); }
  if (kind === 'brokerage') { r.px(cx - 3, cy + 1, C.ink); r.px(cx - 2, cy, C.ink); r.px(cx - 1, cy + 1, C.ink); r.px(cx, cy, C.ink); r.px(cx + 1, cy - 1, C.ink); r.px(cx + 2, cy - 1, C.ink); }
  if (kind === 'bank') { r.hl(cx - 2, cy - 1, 5, C.ink); r.px(cx - 2, cy, C.ink); r.px(cx, cy, C.ink); r.px(cx + 2, cy, C.ink); r.hl(cx - 2, cy + 1, 5, C.ink); }
  if (kind === 'hsa') { r.px(cx - 1, cy - 1, C.ink); r.px(cx + 1, cy - 1, C.ink); r.hl(cx - 2, cy, 5, C.ink); r.hl(cx - 1, cy + 1, 3, C.ink); }
  // Screen.
  r.r(x0 + 8, 58, 22, 16, C.mDD); r.r(x0 + 10, 60, 18, 12, C.scrOff); r.hl(x0 + 10, 60, 18, C.scrOffD);
  // Ledge, keypad, lower cabinet with a statement drawer.
  r.r(x0, 80, 38, 1, C.wdL); r.r(x0, 81, 38, 2, C.wd); r.hl(x0, 83, 38, C.wdDD);
  r.r(x0 + 26, 78, 6, 2, C.mDD);
  r.r(x0 + 2, 84, 34, 8, C.plD); r.vl(x0 + 2, 84, 8, C.mD); r.vl(x0 + 35, 84, 8, C.mD);
  r.r(x0 + 13, 85, 12, 5, C.wd); r.hl(x0 + 13, 85, 12, C.wdL); r.hl(x0 + 13, 89, 12, C.wdD); r.r(x0 + 17, 87, 4, 1, C.bz);
}

function portals(r) {
  for (const b of BOOTHS) booth(r, b.x, b.kind);
  for (const x of [70, 150]) { r.r(x, 48, 30, 2, C.mD); r.hl(x + 1, 50, 28, C.mL); }
}

// -------------------------------------------------------------------- news

function news(r) {
  // Screen on a bracket.
  r.r(224, 54, 40, 25, C.ink); r.r(226, 56, 36, 21, C.scrOff); r.hl(226, 56, 36, C.scrOffD);
  r.r(242, 79, 4, 1, C.mDD);
  // Armchair.
  r.r(226, 76, 20, 9, C.sage); r.hl(226, 76, 20, C.sageL); r.r(224, 80, 4, 10, C.sageD); r.r(244, 80, 4, 10, C.sageD);
  r.r(228, 84, 16, 5, C.sageL); r.hl(228, 88, 16, C.sageD); r.vl(226, 89, 4, C.wdDD); r.vl(245, 89, 4, C.wdDD);
  // Floor lamp.
  r.vl(252, 66, 26, C.bzD); r.r(249, 62, 7, 4, C.paper2); r.hl(249, 65, 7, C.paper4); r.r(250, 91, 5, 2, C.bzD);
  windowPane(r, 270, 52, 22, 15);
  // Radio on a table, with a box of old broadcasts underneath.
  r.r(262, 80, 35, 1, C.wdL); r.r(262, 81, 35, 2, C.wd); r.hl(262, 83, 35, C.wdDD);
  r.vl(264, 84, 9, C.wdD); r.vl(294, 84, 9, C.wdD);
  r.r(266, 70, 19, 10, C.dw); r.hl(266, 70, 19, C.dwL); r.vl(284, 70, 10, C.dwD);
  r.r(268, 72, 9, 6, C.cork); for (let x = 268; x < 277; x += 2) r.vl(x, 72, 6, C.corkD);
  r.r(279, 72, 4, 3, C.paper2); r.px(281, 73, C.ink); r.r(279, 76, 1, 2, C.bz); r.r(282, 76, 1, 2, C.bz);
  r.r(270, 85, 20, 8, BOX[1]); r.hl(270, 85, 20, BOX[0]); r.vl(289, 85, 8, BOX[2]); r.r(276, 87, 8, 3, C.paper2);
}

// ----------------------------------------------------------------- archive

function archive(r) {
  // Pipes.
  r.r(52, 200, 248, 3, C.mD); r.hl(52, 200, 248, C.mL); r.hl(52, 202, 248, C.mDD);
  for (let x = 64; x < 300; x += 40) r.r(x, 199, 3, 5, C.mDD);
  r.disc(122, 207, 2, C.rose === undefined ? C.mDD : u32('#7a4a3a')); r.vl(122, 203, 3, C.mDD);
  // Bulbs.
  for (const x of [130, 230]) { r.vl(x, 203, 5, C.ink); r.r(x - 1, 208, 3, 3, C.paper); r.hl(x - 1, 208, 3, C.mD); }
  // Metal shelving.
  for (const x of [54, 132, 136, 194]) r.r(x, 204, 2, 39, C.mD);
  for (const b of [214, 228, 242]) { r.r(54, b, 78, 1, C.mL); r.r(54, b + 1, 78, 1, C.mD); r.r(136, b, 60, 1, C.mL); r.r(136, b + 1, 60, 1, C.mD); }
  for (const [x, b] of VAULT_BOXES) {
    r.r(x, b - 9, 12, 9, BOX[1]); r.hl(x, b - 9, 12, BOX[0]); r.vl(x + 11, b - 9, 9, BOX[2]);
    r.r(x + 3, b - 6, 6, 3, C.paper2); r.hl(x + 4, b - 5, 4, C.paper4);
  }
  for (const [x, b] of VAULT_LOOSE) { r.r(x, b - 3, 10, 3, MANILA[0]); r.hl(x, b - 1, 10, MANILA[1]); r.r(x + 2, b - 4, 3, 1, MANILA[0]); }
  // Old safe: "cash is safest".
  r.r(200, 222, 17, 21, C.mDD); r.hl(200, 222, 17, C.mD); r.vl(200, 222, 21, C.mD);
  r.outline(202, 224, 13, 16, C.ink); r.disc(208, 231, 2, C.bzD); r.px(208, 231, C.bzL); r.r(212, 230, 2, 3, C.bz);
  // Drawer chest.
  r.r(220, 220, 15, 23, C.wd); r.hl(220, 220, 15, C.wdL); r.vl(234, 220, 23, C.wdD);
  for (const y of [222, 229, 236]) { r.hl(221, y + 6, 13, C.wdD); r.r(226, y + 2, 3, 1, C.bz); }
  // Dry well.
  r.r(252, 208, 2, 19, C.wdD); r.r(288, 208, 2, 19, C.wdD); r.r(250, 206, 42, 2, C.wd); r.hl(250, 206, 42, C.wdL);
  r.r(268, 208, 6, 2, C.wdDD);
  r.r(251, 225, 40, 2, C.ink);
  for (let y = 227; y < 244; y++) for (let x = 250; x < 292; x++) {
    const row = Math.floor((y - 227) / 4);
    const m = (y - 227) % 4 === 3 || ((x + (row % 2) * 4) % 8) === 0;
    r.px(x, y, m ? C.concD : (hash2(x >> 2, row) < 0.4 ? C.concL : C.conc));
  }
  r.hl(250, 227, 42, C.concL);
}

// -------------------------------------------------------------------- roof

function roof(r) {
  brick(r, 46, 32, 304, 4);
  r.hl(46, 31, 304, C.ink);
  r.r(46, 36, 304, 12, C.slab); r.hl(46, 36, 304, C.slabD); r.r(46, 40, 304, 1, C.slabD); r.hl(46, 47, 304, C.ink);
  // Water tank.
  r.vl(76, 22, 10, C.wdDD); r.vl(94, 22, 10, C.wdDD); r.hl(74, 26, 23, C.wdDD);
  for (let x = 72; x < 98; x++) r.vl(x, 6, 16, (x % 3 === 0) ? C.wdD : x < 76 ? C.wdL : C.wd);
  r.hl(72, 9, 26, C.mDD); r.hl(72, 17, 26, C.mDD);
  for (let y = 0; y < 5; y++) r.hl(74 + y * 2, 5 - y, 22 - y * 4, C.wdDD);
  // Chimney and antenna.
  brick(r, 272, 16, 9, 15); r.r(270, 14, 13, 2, C.slabD);
  r.vl(190, 12, 19, C.ink); r.hl(186, 15, 9, C.ink); r.hl(187, 19, 7, C.ink); r.hl(188, 23, 5, C.ink);
}

// ------------------------------------------------------------ street, alley

function street(r) {
  // Lamp post.
  r.vl(4, 156, 38, C.ink); r.r(3, 190, 3, 4, C.ink);
  r.r(1, 151, 7, 5, C.ink); r.r(2, 152, 5, 3, C.paper2);
  // A shiny pickup: the deduction nobody needs.
  const T = C;
  r.r(9, 172, 15, 14, T.trk); r.hl(10, 171, 13, T.trkL); r.vl(9, 172, 14, T.trkL);
  r.r(11, 174, 10, 5, T.glass); r.vl(12, 175, 3, T.glassT);
  r.r(23, 178, 24, 8, T.trk); r.hl(23, 177, 24, T.trkL); r.hl(23, 181, 24, T.trkD);
  r.r(7, 182, 4, 4, T.chrome); r.r(45, 182, 3, 4, T.chrome);
  r.hl(8, 186, 40, T.trkDD);
  for (const x of [15, 39]) { r.disc(x, 189, 4, C.ink); r.disc(x, 189, 2, C.mD); r.px(x, 189, C.mL); }
  r.outline(8, 171, 17, 16, T.trkDD);
}

function alley(r) {
  // Mailbox.
  r.r(356, 182, 3, 12, C.ink);
  r.r(351, 171, 13, 11, u32('#58616a')); r.hl(351, 171, 13, u32('#78828b')); r.vl(363, 171, 11, u32('#40474e'));
  r.r(353, 173, 7, 2, C.ink);
  // Lamp post.
  r.vl(372, 156, 38, C.ink); r.r(371, 190, 3, 4, C.ink);
  r.r(369, 151, 7, 5, C.ink); r.r(370, 152, 5, 3, C.paper2);
  // Trash can.
  r.r(362, 184, 8, 10, C.mD); r.hl(361, 183, 10, C.m); r.vl(364, 185, 8, C.mL);
}

// -------------------------------------------------------------------- home

function home(r) {
  // Interiors.
  wallpaper(r, 380, 148, 92, 46, u32('#efe6d6'), u32('#e3d6c0'));
  for (let y = 152; y < 190; y += 6) for (let x = 384; x < 470; x += 6) r.px(x + ((y / 6) % 2) * 3, y, u32('#d9c7a8'));
  wallpaper(r, 380, 98, 92, 46, u32('#e9e3ef'), u32('#dcd4e4'));
  floorStrip(r, 380, FEET.g, 92, 'wood');
  floorStrip(r, 380, FEET.f1, 92, 'carpet');
  // Roof and attic.
  for (let y = 46; y <= 93; y++) {
    const half = Math.round((y - 46) * 1.08);
    const L = 426 - half, R = 426 + half;
    if (y > 50) r.r(L + 3, y, R - L - 5, 1, u32('#dccdb4'));
    for (let k = 0; k < 3; k++) { r.px(L + k, y, k === 0 ? C.ink : C.brD); r.px(R - k, y, k === 0 ? C.ink : C.brD); }
  }
  for (let x = 400; x < 456; x += 9) { const top = Math.round(50 + Math.abs(x - 426) / 1.08); r.vl(x, top, 93 - top, C.wdD); }
  floorStrip(r, 392, FEET.f2, 70, 'wood');
  brick(r, 446, 52, 8, 16); r.r(444, 50, 12, 2, C.slabD);
  // Walls and slabs.
  brick(r, 376, 94, 4, 68); brick(r, 472, 94, 4, 100);
  r.hl(376, 161, 4, C.ink); r.r(376, 159, 4, 2, C.dwD);
  slabBand(r, 372, 94, 108);
  slabBand(r, 376, 144, 100);
  // Door leaf.
  r.r(380, 162, 4, 31, C.wd); r.vl(380, 162, 31, C.wdDD); r.vl(383, 162, 31, C.wdL);
  // Ladders.
  for (const [x, top, bot] of [[383, 145, 193], [457, 95, 143]]) {
    r.vl(x, top, bot - top + 1, C.wdD); r.vl(x + 5, top, bot - top + 1, C.wdD);
    for (let y = top + 3; y < bot; y += 5) r.hl(x, y, 6, C.wd);
  }
  // Ground floor: sofa, side table with phone, kitchen.
  r.r(396, 172, 30, 9, C.sage); r.hl(396, 172, 30, C.sageL);
  r.r(394, 178, 34, 9, C.sage); r.hl(394, 178, 34, C.sageL); r.r(394, 178, 4, 10, C.sageD); r.r(424, 178, 4, 10, C.sageD);
  r.vl(396, 188, 5, C.wdDD); r.vl(426, 188, 5, C.wdDD);
  r.r(398, 175, 6, 4, C.lavL);
  r.r(430, 180, 10, 1, C.wdL); r.r(430, 181, 10, 2, C.wd); r.vl(431, 183, 10, C.wdD); r.vl(438, 183, 10, C.wdD);
  r.r(432, 177, 6, 3, C.ink); r.hl(431, 176, 8, C.ink);
  r.r(404, 155, 16, 11, C.wdD); r.r(406, 157, 12, 7, C.paper2); r.r(408, 160, 8, 3, C.lf);
  r.r(444, 172, 27, 1, C.mL); r.r(444, 173, 27, 20, C.plL); r.outline(444, 173, 27, 20, C.plD);
  r.r(446, 175, 11, 4, C.pl); r.outline(446, 175, 11, 4, C.plD); r.r(450, 176, 3, 1, C.mDD);
  r.r(459, 175, 10, 4, C.pl); r.outline(459, 175, 10, 4, C.plD); r.r(462, 176, 3, 1, C.mDD);
  r.r(446, 181, 23, 10, C.pl); r.vl(457, 181, 10, C.plD);
  r.r(446, 152, 23, 10, C.plL); r.outline(446, 152, 23, 10, C.plD); r.vl(457, 152, 10, C.plD);
  r.r(449, 168, 4, 4, C.lfD); r.px(450, 167, C.lf);
  // Upper floor: bed, desk with a drawer, window.
  r.r(388, 130, 30, 6, C.paper); r.r(392, 131, 18, 5, C.lav); r.hl(392, 131, 18, C.lavL); r.r(412, 130, 6, 3, C.paper2);
  r.r(386, 124, 3, 19, C.wdD); r.r(417, 130, 3, 13, C.wdD); r.hl(388, 136, 30, C.wdD);
  r.r(424, 126, 22, 1, C.wdL); r.r(424, 127, 22, 2, C.wd); r.vl(425, 129, 14, C.wdD); r.vl(444, 129, 14, C.wdD);
  r.r(427, 129, 9, 4, C.wdL); r.hl(427, 132, 9, C.wdD); r.r(430, 130, 3, 1, C.bz);
  r.r(438, 121, 5, 5, C.paper); r.outline(438, 121, 5, 5, C.paper4);
  windowPane(r, 448, 104, 16, 15);
  // Attic: boxes, a trunk, a shoebox, cobwebs.
  r.r(400, 84, 12, 9, BOX[1]); r.hl(400, 84, 12, BOX[0]); r.vl(411, 84, 9, BOX[2]);
  r.r(418, 87, 11, 6, C.paper2); r.outline(418, 87, 11, 6, C.paper4); r.hl(418, 89, 11, C.paper4);
  r.r(434, 82, 16, 11, C.dw); r.hl(434, 82, 16, C.dwL); r.hl(434, 86, 16, C.bzD); r.px(441, 87, C.bz);
  for (const [x, y] of [[398, 70], [399, 71], [400, 72], [452, 70], [451, 71]]) r.px(x, y, C.plD);
}

// Occluders drawn after the actors: desk fronts hide legs.
export function drawFront(r) {
  r.r(63, 180, 34, 13, C.wd); r.vl(63, 180, 13, C.wdL); r.vl(96, 180, 13, C.wdDD);
  r.r(66, 182, 12, 9, C.wd); r.outline(66, 182, 12, 9, C.wdD); r.r(71, 186, 2, 1, C.bz);
  r.r(178, 180, 63, 13, C.wd); r.vl(178, 180, 13, C.wdL); r.vl(240, 180, 13, C.wdDD);
  for (const x of [181, 222]) { r.outline(x, 181, 16, 5, C.wdD); r.outline(x, 186, 16, 6, C.wdD); r.r(x + 7, 183, 3, 1, C.bz); r.r(x + 7, 188, 3, 1, C.bz); }
  r.r(198, 182, 23, 10, C.wdD);
}
