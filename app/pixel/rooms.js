// Room scenes: each room has its own close-up, drawn at 192x108 and shown at
// 5x. The agent works here; the overview is only for travel.
import { C, u32 } from './palette.js';
import { hash2 } from './gfx.js';
import { digits } from './scene.js';

export const RW = 192;
export const RH = 108;
export const RFEET = 101;

const BOOKS_IRS = ['#efe8da', '#e0d5c0', '#d2c4aa', '#e8dfce', '#d8ccb6', '#c9bba0'].map(u32);
const BOOKS_IRS_D = ['#d1c6b0', '#c1b39a', '#b0a186', '#cabfa9', '#b9ac93', '#a99a7f'].map(u32);
const BOOKS_LAW = ['#7d4a36', '#5e3a2c', '#46503f', '#3a3430', '#86643a', '#6a3f3a', '#55402f'].map(u32);
const BOOKS_LAW_D = ['#5c3426', '#432a1f', '#323a2d', '#262220', '#64492a', '#4c2c29', '#3c2c20'].map(u32);
const BOX = ['#d6bb92', '#bea073', '#9d7f57', '#7d6344'].map(u32);
const MANILA = ['#f0deb0', '#dbc691', '#bea76f'].map(u32);

// ------------------------------------------------------------ materials

function plaster(r, x, y, w, h, base = C.pl, fleck = C.plM) {
  r.r(x, y, w, h, base);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (hash2(xx, yy) < 0.05) r.px(xx, yy, fleck);
}
function stripes(r, x, y, w, h, a, b, step = 6) {
  r.r(x, y, w, h, a);
  for (let xx = x + 2; xx < x + w; xx += step) r.vl(xx, y, h, b);
}
function panels(r, x, y, w, h, L, M, D, DD) {
  r.r(x, y, w, h, M);
  r.hl(x, y, w, DD); r.hl(x, y + 1, w, L); r.hl(x, y + 2, w, M);
  for (let px = x + 3; px + 18 < x + w; px += 22) {
    r.hl(px, y + 5, 18, D); r.vl(px, y + 5, h - 9, D);
    r.hl(px + 1, y + h - 4, 18, L); r.vl(px + 18, y + 6, h - 9, L);
    r.r(px + 1, y + 6, 17, h - 10, M);
    for (let k = 0; k < 3; k++) r.px(px + 4 + k * 5, y + 9 + k * 3, D);
  }
}
function planks(r, y, h) {
  for (let yy = y; yy < y + h; yy++) {
    const row = Math.floor((yy - y) / 4);
    const off = (row * 17) % 31;
    for (let xx = 0; xx < RW; xx++) {
      const seam = (yy - y) % 4 === 3 || (xx + off) % 31 === 0;
      const grain = hash2(xx >> 2, yy) < 0.12;
      r.px(xx, yy, seam ? C.wdD : grain ? C.wd : (yy - y) < 2 ? C.wdL : (row % 2 ? C.wd : C.wdL));
    }
  }
}
function tiles(r, y, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = 0; xx < RW; xx++) {
    const s = 6 + Math.floor((yy - y) / 3);
    const a = (Math.floor(xx / s) + Math.floor((yy - y) / 5)) & 1;
    const grout = (yy - y) % 5 === 4 || xx % s === 0;
    r.px(xx, yy, grout ? C.plD : a ? C.tileL : C.tileD);
  }
}
function concrete(r, y, h) {
  for (let yy = y; yy < y + h; yy++) for (let xx = 0; xx < RW; xx++) {
    const t = hash2(xx, yy);
    r.px(xx, yy, t < 0.06 ? C.concD : t > 0.97 ? C.concL : (yy - y) < 2 ? C.concL : C.conc);
  }
}
function carpetFloor(r, y, h, main = C.carpet, dark = C.carpetD, light = C.carpetL) {
  for (let yy = y; yy < y + h; yy++) for (let xx = 0; xx < RW; xx++) r.px(xx, yy, (yy - y) < 2 ? light : (xx + yy) % 2 && hash2(xx, yy) < 0.4 ? dark : main);
}
function rug(r, x, y, w, h, a, b, edge) {
  r.r(x, y, w, h, a);
  r.outline(x, y, w, h, edge); r.outline(x + 2, y + 1, w - 4, h - 2, b);
  for (let i = x + 6; i < x + w - 6; i += 8) { r.px(i, y + (h >> 1), b); r.px(i + 1, y + (h >> 1) - 1, b); r.px(i + 1, y + (h >> 1) + 1, b); r.px(i + 2, y + (h >> 1), b); }
  for (let i = x; i < x + w; i += 2) { r.px(i, y - 1, edge); r.px(i, y + h, edge); }
}
function baseboard(r, y) { r.hl(0, y, RW, C.wdL); r.r(0, y + 1, RW, 2, C.wd); r.hl(0, y + 3, RW, C.wdDD); }
function ceiling(r, c1 = C.plD, c2 = C.slab) { r.r(0, 0, RW, 3, c1); r.hl(0, 3, RW, c2); }

function pendant(r, x, len = 8) {
  r.vl(x, 4, len, C.ink);
  r.r(x - 5, 4 + len, 11, 3, C.dwD); r.hl(x - 5, 4 + len, 11, C.dw);
  r.hl(x - 4, 7 + len, 9, C.bzL); r.r(x - 1, 8 + len, 3, 1, C.glint);
}
function windowFrame(r, x, y, w, h, view) {
  r.r(x - 2, y - 2, w + 4, h + 4, C.wdD);
  r.r(x, y, w, h, C.glass);
  if (view) view(r, x, y, w, h);
  for (let k = 0; k < 6; k++) r.line(x + 3 + k * 4, y + h - 3, x + 8 + k * 4, y + 2, C.glassT);
  r.r(x + (w >> 1) - 1, y, 2, h, C.wdD);
  r.r(x, y + (h >> 1) - 1, w, 2, C.wdD);
  r.r(x - 4, y + h + 2, w + 8, 2, C.wdL); r.hl(x - 4, y + h + 4, w + 8, C.wdDD);
}
function curtains(r, x, y, w, h) {
  r.r(x - 8, y - 6, w + 16, 2, C.bzD);
  for (const cx of [x - 9, x + w + 2]) {
    r.r(cx, y - 4, 7, h + 10, C.sage);
    for (let k = 0; k < 7; k += 2) r.vl(cx + k, y - 4, h + 10, C.sageD);
    r.vl(cx + 1, y - 4, h + 10, C.sageL);
    r.hl(cx, y + h + 5, 7, C.sageD);
  }
}
function plant(r, x, y) {
  r.r(x, y + 14, 12, 10, C.brL); r.hl(x - 1, y + 14, 14, C.brD); r.vl(x + 10, y + 15, 9, C.br); r.hl(x, y + 23, 12, C.brD);
  const L = [[5, 0], [2, 2], [8, 2], [0, 6], [10, 5], [3, 7], [7, 6], [5, 4], [1, 10], [9, 9], [4, 11], [6, 9], [11, 11], [-1, 12]];
  for (const [dx, dy] of L) {
    r.r(x + dx, y + dy, 3, 2, C.lf); r.px(x + dx, y + dy, C.lfL); r.px(x + dx + 2, y + dy + 1, C.lfD); r.px(x + dx + 1, y + dy + 2, C.lfDD);
  }
}
function bankerLamp(r, x, y) {
  r.r(x, y + 9, 9, 2, C.bzD); r.hl(x, y + 9, 9, C.bz);
  r.vl(x + 4, y + 4, 5, C.bzD);
  r.r(x - 2, y, 13, 4, C.lfD); r.hl(x - 2, y, 13, C.lf); r.hl(x - 1, y + 4, 11, C.bzL);
  r.r(x + 1, y + 5, 7, 1, C.glint);
}
// The view out of every window is the same city. Building heights follow the
// year's market index, so the April dip is a gap in the skyline.
const SKY = u32('#dfe9f1'), SKY2 = u32('#eef3f6');
const TOWER = [u32('#9aa7b4'), u32('#8a98a8'), u32('#a9b3bd')];
const TOWER_L = u32('#c3ccd4'), LIT = u32('#f3e3a6');
function skyline(marketX) {
  return (r, x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) r.hl(x, yy, w, (yy - y) < h * 0.45 ? SKY : SKY2);
    let i = 0, k = 0;
    while (i < w) {
      const bw = Math.min(3 + Math.floor(hash2(k, 11) * 3), w - i);
      const v = marketX[Math.floor(((i + bw / 2) / w) * (marketX.length - 1))];
      const top = y + h - 3 - Math.round((v - 80) * (h - 8) / 40);
      const col = TOWER[k % 3];
      r.r(x + i, top, bw, y + h - top, col);
      r.hl(x + i, top, bw, TOWER_L);
      for (let yy = top + 2; yy < y + h - 1; yy += 2) for (let xx = x + i + 1; xx < x + i + bw - 1; xx += 2) if (hash2(xx, yy) < 0.22) r.px(xx, yy, LIT);
      i += bw + (hash2(k, 9) < 0.25 ? 1 : 0); k++;
    }
  };
}
function books(r, x0, x1, board, set, setD, seed, hmin, hmax, gold = false) {
  let x = x0;
  while (x <= x1) {
    const t = hash2(x, board + seed);
    const wd = t < 0.2 ? 3 : t < 0.75 ? 4 : 5;
    if (x + wd - 1 > x1) break;
    if (t > 0.94) { // a leaning book
      r.line(x, board - 1, x + 3, board - hmin, set[0]); x += 4; continue;
    }
    const h = hmin + Math.floor(hash2(board, x * 3 + seed) * (hmax - hmin + 1));
    const k = Math.floor(hash2(x * 7, seed) * set.length);
    const top = board - h;
    r.r(x, top, wd, h, set[k]);
    r.vl(x, top, h, setD[k] === set[k] ? set[k] : set[k]);
    r.vl(x + wd - 1, top, h, setD[k]);
    r.hl(x, top, wd, setD[k]);
    const b1 = top + 2, b2 = board - 3;
    r.hl(x + 1, b1, wd - 2, setD[k]); r.hl(x + 1, b2, wd - 2, setD[k]);
    if (gold) { r.hl(x + 1, b1 + 1, wd - 2, C.bzL); r.px(x + 1, top + (h >> 1), C.bz); }
    else r.hl(x + 1, top + (h >> 1), wd - 3, setD[k]);
    x += wd;
  }
}
function shelfBoard(r, x, w, y, L, D) { r.hl(x, y, w, L); r.hl(x, y + 1, w, D); r.hl(x, y + 2, w, C.ink); }

// ------------------------------------------------------------- scenes

function library(r, ctx) {
  ceiling(r);
  plaster(r, 0, 4, RW, 52, C.pl, C.plM);
  r.hl(0, 4, RW, C.wdD);
  panels(r, 0, 56, RW, 30, C.dwL, C.dw, C.dwD, C.dwDD);
  carpetFloor(r, 86, 22);
  rug(r, 72, 90, 64, 12, u32('#a9806b'), u32('#c9a58a'), u32('#7a5644'));
  // IRS bookcase.
  r.r(2, 6, 72, 81, C.wdD); r.r(4, 9, 68, 77, C.plD); r.r(2, 6, 72, 3, C.wd); r.hl(2, 6, 72, C.wdL);
  for (const b of ctx.irsBoards) { books(r, 5, 70, b, BOOKS_IRS, BOOKS_IRS_D, 1, 9, 12); shelfBoard(r, 4, 68, b, C.wdL, C.wdD); }
  r.vl(2, 6, 81, C.wdDD); r.vl(73, 6, 81, C.wdDD);
  // Arched window with curtains, the skyline outside.
  windowFrame(r, 86, 12, 26, 36, skyline(ctx.marketX));
  curtains(r, 86, 12, 26, 36);
  // Reading table.
  r.r(78, 70, 52, 2, C.wdL); r.r(78, 72, 52, 3, C.wd); r.hl(78, 75, 52, C.wdDD);
  r.r(81, 76, 3, 24, C.wdD); r.r(124, 76, 3, 24, C.wdD); r.hl(84, 92, 40, C.wdD);
  bankerLamp(r, 106, 59);
  r.r(86, 66, 12, 4, C.paper2); r.hl(86, 66, 12, C.paper3); r.vl(92, 66, 4, C.paper4);
  // Chair.
  r.r(132, 60, 3, 41, C.dwD); r.r(144, 72, 3, 29, C.dwD); r.r(132, 76, 15, 3, C.dw); r.hl(132, 76, 15, C.dwL);
  for (let y = 62; y < 76; y += 4) r.hl(133, y, 2, C.dw);
  // Card catalog.
  r.r(148, 44, 22, 43, C.wdD); r.r(149, 45, 20, 41, C.wd); r.hl(148, 44, 22, C.wdL);
  for (const [x, y] of ctx.catalog) { r.r(x, y, 6, 6, C.wdL); r.hl(x, y + 5, 6, C.wdD); r.vl(x + 5, y, 6, C.wdD); r.r(x + 2, y + 1, 2, 1, C.paper); r.px(x + 2, y + 3, C.bz); r.px(x + 3, y + 3, C.bzD); }
  r.r(150, 87, 3, 14, C.wdD); r.r(165, 87, 3, 14, C.wdD);
  // Case law.
  r.r(172, 6, 20, 81, C.dwD); r.r(174, 9, 18, 77, C.dwDD); r.r(172, 6, 20, 3, C.dw); r.hl(172, 6, 20, C.dwL);
  for (const b of ctx.irsBoards) { books(r, 175, 191, b, BOOKS_LAW, BOOKS_LAW_D, 7, 9, 12, true); shelfBoard(r, 174, 18, b, C.dwL, C.dwDD); }
  r.hl(172, 11, 20, C.bz); r.hl(172, 12, 20, C.bzD);
  pendant(r, 40, 2); pendant(r, 160, 2);
}

function office(r, ctx) {
  ceiling(r);
  plaster(r, 0, 4, RW, 62, C.plL, C.pl);
  panels(r, 0, 66, RW, 20, C.wdL, C.wd, C.wdD, C.wdDD);
  planks(r, 86, 22);
  rug(r, 54, 91, 84, 11, u32('#8d9aa6'), u32('#b4bfc8'), u32('#5f6b77'));
  // Corkboard with four columns: file it, still open, missed, next year.
  r.r(4, 12, 50, 42, C.wdD); r.r(6, 14, 46, 38, C.cork); r.hl(4, 12, 50, C.wdL);
  for (let i = 0; i < 140; i++) r.px(6 + Math.floor(hash2(i, 3) * 46), 14 + Math.floor(hash2(i, 5) * 38), hash2(i, 7) < 0.5 ? C.corkD : C.corkL);
  for (let c = 1; c < 4; c++) for (let y = 15; y < 51; y += 2) r.px(6 + c * 11 + 1, y, C.corkD);
  // Window with the skyline.
  windowFrame(r, 62, 10, 30, 28, skyline(ctx.marketX));
  // Clock and calendar.
  r.disc(104, 18, 7, C.paper); r.ring(104, 18, 7, C.ink); r.ring(104, 18, 8, C.wdD);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; r.px(Math.round(104 + Math.cos(a) * 6), Math.round(18 + Math.sin(a) * 6), C.mD); }
  r.r(116, 10, 16, 4, C.plD); r.px(119, 9, C.ink); r.px(128, 9, C.ink);
  r.r(116, 14, 16, 18, C.paper); r.outline(116, 10, 16, 22, C.paper4);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) r.px(118 + i * 3, 20 + j * 3, C.paper4);
  r.ring(127, 26, 2, C.rose);
  // Desk.
  r.r(58, 68, 78, 2, C.wdL); r.r(58, 70, 78, 3, C.wd); r.hl(58, 73, 78, C.wdDD);
  r.r(60, 74, 18, 27, C.wd); r.vl(60, 74, 27, C.wdL); r.vl(77, 74, 27, C.wdDD);
  for (const y of [74, 83, 92]) { r.hl(61, y + 8, 16, C.wdD); r.r(66, y + 3, 6, 2, C.bz); }
  r.r(130, 74, 3, 27, C.wdD);
  bankerLamp(r, 62, 57);
  r.r(76, 64, 18, 4, C.wdD); r.hl(76, 64, 18, C.wdL); r.hl(77, 67, 16, C.wdDD);
  // Monitor.
  r.r(98, 42, 26, 21, C.mDD); r.r(100, 44, 22, 16, C.scrOff); r.hl(100, 44, 22, C.scrOffD); r.px(111, 61, C.blueM);
  r.r(108, 63, 6, 3, C.mDD); r.r(104, 66, 14, 2, C.mD);
  r.r(98, 67, 18, 1, C.mL);
  // Phone.
  r.r(120, 63, 10, 5, C.ink); r.r(118, 61, 14, 2, C.ink); r.r(118, 60, 3, 1, C.ink); r.r(129, 60, 3, 1, C.ink);
  r.disc(125, 65, 2, C.paper3); r.px(125, 65, C.ink);
  // Jar.
  r.vl(132, 50, 18, C.glassD); r.vl(141, 50, 18, C.glassD); r.hl(132, 67, 10, C.glassD);
  r.r(133, 47, 8, 3, C.mD); r.hl(133, 47, 8, C.mL); r.vl(134, 51, 14, C.glass);
  // Filing cabinet.
  r.r(146, 38, 20, 63, C.m); r.vl(146, 38, 63, C.mL); r.vl(165, 38, 63, C.mDD); r.hl(146, 38, 20, C.mL);
  for (const y of ctx.cabinet) {
    r.r(148, y, 16, 19, C.m); r.hl(148, y, 16, C.mL); r.hl(148, y + 18, 16, C.mD); r.vl(163, y, 19, C.mD);
    r.r(152, y + 4, 8, 4, C.paper); r.outline(151, y + 3, 10, 6, C.mD); r.r(153, y + 11, 6, 2, C.mDD); r.hl(153, y + 11, 6, C.mL);
  }
  // Engine: a brass adding machine.
  r.r(168, 74, 24, 2, C.wdL); r.r(168, 76, 24, 3, C.wd); r.hl(168, 79, 24, C.wdDD);
  r.r(170, 80, 3, 21, C.wdD); r.r(187, 80, 3, 21, C.wdD);
  r.r(169, 46, 22, 28, C.bz); r.hl(169, 46, 22, C.bzL); r.vl(169, 46, 28, C.bzL); r.vl(190, 46, 28, C.bzD); r.hl(169, 73, 22, C.bzDD);
  r.outline(168, 45, 24, 30, C.ink);
  r.r(172, 50, 16, 9, C.paper); r.outline(171, 49, 18, 11, C.bzDD);
  for (let y = 62; y <= 70; y += 3) for (let x = 172; x < 188; x += 4) { r.r(x, y, 3, 2, C.paper2); r.hl(x, y + 2, 3, C.ink); }
  r.r(176, 42, 8, 3, C.ink);
  plant(r, 136, 77);
}

function lobby(r, ctx) {
  ceiling(r);
  stripes(r, 0, 4, RW, 60, C.pl, C.plM, 7);
  panels(r, 0, 64, RW, 22, C.wdL, C.wd, C.wdD, C.wdDD);
  tiles(r, 86, 22);
  // Glass front door: the street and the shiny truck outside.
  r.r(2, 14, 32, 87, C.wdD);
  r.r(5, 18, 26, 66, C.glass);
  r.r(5, 60, 26, 24, C.hill);
  r.r(5, 78, 26, 6, C.mD);
  r.r(6, 62, 22, 12, C.trk); r.hl(6, 62, 22, C.trkL); r.r(8, 64, 8, 5, C.glassT); r.r(22, 66, 9, 8, C.trk); r.hl(22, 66, 9, C.trkL);
  r.disc(11, 75, 3, C.ink); r.disc(25, 75, 3, C.ink); r.px(11, 75, C.mD); r.px(25, 75, C.mD);
  r.r(5, 18, 26, 2, C.wdD); for (let k = 0; k < 7; k++) r.line(7 + k * 3, 56, 12 + k * 3, 21, C.glassT);
  r.r(5, 84, 26, 15, C.wd); r.outline(5, 84, 26, 15, C.wdDD); r.r(28, 70, 2, 5, C.bz);
  r.r(36, 96, 26, 5, C.sageD); r.hl(36, 96, 26, C.sage);
  // Coat rack.
  r.r(42, 20, 2, 80, C.dwD); r.r(37, 99, 12, 2, C.dwD); r.r(37, 20, 12, 2, C.dwD);
  r.r(37, 24, 10, 22, u32('#56627c')); r.vl(46, 25, 21, u32('#3f4a60')); r.hl(37, 24, 10, u32('#6b7894'));
  r.r(37, 16, 12, 4, u32('#5a4636')); r.r(39, 13, 8, 3, u32('#6e5744'));
  // Secretary desk.
  r.r(52, 68, 52, 2, C.wdL); r.r(52, 70, 52, 3, C.wd); r.hl(52, 73, 52, C.wdDD);
  r.r(54, 54, 24, 14, C.mDD); r.hl(54, 54, 24, C.mD);
  for (let x = 56; x < 76; x += 3) { r.r(x, 60, 2, 2, C.mL); r.r(x + 1, 64, 2, 2, C.mL); }
  r.r(58, 44, 16, 10, C.paper); r.hl(60, 47, 12, C.paper3); r.hl(60, 50, 9, C.paper3);
  r.r(56, 53, 20, 1, C.ink);
  r.r(94, 62, 8, 6, C.wd); r.r(95, 63, 6, 2, C.paper2);
  // Flyer rack: folk wisdom with pictures.
  r.r(110, 20, 26, 46, C.wdD); r.r(112, 22, 22, 42, C.wd);
  const fly = [[113, 24], [124, 24], [113, 38], [124, 38], [113, 52], [124, 52]];
  fly.forEach(([x, y], i) => {
    r.r(x, y, 9, 12, C.paper); r.hl(x, y + 12, 9, C.paper4);
    if (i === 0) { r.r(x + 1, y + 4, 7, 3, C.trk); r.px(x + 2, y + 7, C.ink); r.px(x + 6, y + 7, C.ink); }
    if (i === 1) { r.r(x + 2, y + 3, 5, 4, C.roseL); r.px(x + 4, y + 2, C.rose); r.px(x + 2, y + 7, C.roseL); r.px(x + 6, y + 7, C.roseL); }
    if (i === 2) { r.px(x + 4, y + 2, C.ink); r.hl(x + 3, y + 3, 3, C.ink); r.hl(x + 2, y + 4, 5, C.ink); r.r(x + 3, y + 5, 3, 3, C.wd); }
    if (i === 3) { r.disc(x + 4, y + 5, 2, C.ochreL); r.px(x + 4, y + 5, C.ochre); }
    if (i >= 4) { r.hl(x + 1, y + 3, 7, C.plD); r.hl(x + 1, y + 5, 5, C.plD); r.hl(x + 1, y + 7, 6, C.plD); }
    r.hl(x + 1, y + 10, 5, C.plD);
  });
  // Water cooler.
  r.r(144, 22, 14, 3, C.mD);
  r.r(143, 25, 16, 20, C.water); r.vl(143, 25, 20, C.waterD); r.vl(158, 25, 20, C.waterD); r.vl(146, 27, 16, C.glass); r.hl(143, 33, 16, C.waterD);
  r.r(141, 45, 20, 56, C.m); r.vl(141, 45, 56, C.mL); r.vl(160, 45, 56, C.mDD); r.hl(141, 45, 20, C.mL);
  r.r(145, 54, 4, 3, C.ink); r.r(153, 54, 4, 3, C.mDD); r.r(144, 66, 14, 2, C.mD);
  // Window.
  windowFrame(r, 166, 12, 22, 30, skyline(ctx.marketX));
  pendant(r, 80, 4); pendant(r, 150, 2);
}

function lobbyFront(r) {
  r.r(52, 73, 52, 28, C.wd); r.vl(52, 73, 28, C.wdL); r.vl(103, 73, 28, C.wdDD); r.hl(52, 100, 52, C.wdDD);
  for (const x of [56, 80]) { r.outline(x, 77, 20, 19, C.wdD); r.hl(x + 1, 95, 19, C.wdL); r.vl(x + 19, 78, 18, C.wdL); }
}

function portals(r, ctx) {
  ceiling(r, C.plD, C.mD);
  plaster(r, 0, 4, RW, 82, C.plL, C.pl);
  for (const x of [20, 70, 120, 170]) { r.r(x - 12, 4, 24, 2, C.mD); r.hl(x - 11, 6, 22, C.mL); }
  for (let yy = 86; yy < 108; yy++) for (let xx = 0; xx < RW; xx++) r.px(xx, yy, (xx % 16 === 0 || (yy - 86) % 7 === 6) ? C.linoD : (yy < 88 ? C.plL : C.lino));
  for (const b of ctx.booths) {
    const x0 = b.x;
    r.r(x0, 14, 44, 66, C.mD); r.r(x0 + 2, 16, 40, 62, C.m); r.hl(x0 + 2, 16, 40, C.mL); r.vl(x0 + 41, 16, 62, C.mD);
    // Plaque.
    r.r(x0 + 14, 8, 16, 9, C.wdD); r.r(x0 + 15, 9, 14, 7, C.paper2);
    const cx = x0 + 22, cy = 12;
    if (b.kind === 'benefits') { r.hl(cx - 2, cy, 5, C.ink); r.vl(cx, cy - 2, 5, C.ink); }
    if (b.kind === 'brokerage') { r.line(cx - 4, cy + 2, cx - 1, cy - 1, C.ink); r.line(cx - 1, cy - 1, cx + 1, cy + 1, C.ink); r.line(cx + 1, cy + 1, cx + 4, cy - 2, C.ink); }
    if (b.kind === 'bank') { r.hl(cx - 4, cy - 2, 9, C.ink); for (const dx of [-3, -1, 1, 3]) r.vl(cx + dx, cy - 1, 3, C.ink); r.hl(cx - 4, cy + 2, 9, C.ink); }
    if (b.kind === 'hsa') { r.px(cx - 2, cy - 2, C.rose); r.px(cx + 2, cy - 2, C.rose); r.hl(cx - 3, cy - 1, 7, C.rose); r.hl(cx - 2, cy, 5, C.rose); r.hl(cx - 1, cy + 1, 3, C.rose); r.px(cx, cy + 2, C.rose); }
    // Screen.
    r.r(x0 + 6, 22, 32, 26, C.mDD); r.r(x0 + 8, 24, 28, 21, C.scrOff); r.hl(x0 + 8, 24, 28, C.scrOffD);
    r.r(x0 + 20, 48, 4, 2, C.mDD);
    // Ledge and keypad.
    r.r(x0, 54, 44, 2, C.wdL); r.r(x0, 56, 44, 3, C.wd); r.hl(x0, 59, 44, C.wdDD);
    r.r(x0 + 30, 50, 9, 4, C.mDD); for (let k = 0; k < 3; k++) r.px(x0 + 32 + k * 2, 51, C.mL);
    // Statement drawer below.
    r.r(x0 + 4, 62, 36, 38, C.plD); r.vl(x0 + 4, 62, 38, C.mD); r.vl(x0 + 39, 62, 38, C.mD);
    r.r(x0 + 12, 66, 20, 10, C.wd); r.hl(x0 + 12, 66, 20, C.wdL); r.hl(x0 + 12, 75, 20, C.wdD); r.r(x0 + 19, 70, 6, 2, C.bz);
    r.r(x0 + 12, 80, 20, 10, C.wd); r.hl(x0 + 12, 80, 20, C.wdL); r.hl(x0 + 12, 89, 20, C.wdD); r.r(x0 + 19, 84, 6, 2, C.bz);
  }
}

function news(r, ctx) {
  ceiling(r);
  stripes(r, 0, 4, RW, 58, C.pl, C.plM, 9);
  panels(r, 0, 62, RW, 24, C.wdL, C.wd, C.wdD, C.wdDD);
  planks(r, 86, 22);
  rug(r, 16, 92, 70, 10, u32('#9aa58c'), u32('#bcc5ae'), u32('#6e7a63'));
  // Big screen.
  r.r(10, 8, 80, 50, C.ink); r.r(12, 10, 76, 46, C.scrOff); r.hl(12, 10, 76, C.scrOffD);
  r.r(46, 58, 8, 3, C.mDD);
  // Armchair.
  r.r(18, 70, 40, 18, C.sage); r.hl(18, 70, 40, C.sageL); for (let k = 22; k < 56; k += 6) r.vl(k, 71, 16, C.sageD);
  r.r(14, 78, 8, 20, C.sageD); r.r(54, 78, 8, 20, C.sageD); r.hl(14, 78, 8, C.sage); r.hl(54, 78, 8, C.sage);
  r.r(22, 86, 32, 8, C.sageL); r.hl(22, 93, 32, C.sageD);
  r.r(18, 98, 3, 3, C.wdDD); r.r(56, 98, 3, 3, C.wdDD);
  // Floor lamp.
  r.vl(100, 40, 60, C.bzD); r.r(94, 32, 13, 8, C.paper2); r.hl(94, 39, 13, C.paper4); r.r(96, 99, 9, 2, C.bzD);
  // Window.
  windowFrame(r, 146, 10, 34, 28, skyline(ctx.marketX));
  // Radio on a table, a box of old broadcasts below.
  r.r(110, 66, 74, 2, C.wdL); r.r(110, 68, 74, 3, C.wd); r.hl(110, 71, 74, C.wdDD);
  r.r(113, 72, 3, 29, C.wdD); r.r(178, 72, 3, 29, C.wdD);
  r.r(120, 44, 40, 22, C.dw); r.hl(120, 44, 40, C.dwL); r.vl(159, 44, 22, C.dwD); r.r(122, 42, 36, 2, C.dwL);
  r.r(124, 48, 20, 14, C.cork); for (let x = 125; x < 144; x += 2) r.vl(x, 48, 14, C.corkD);
  r.r(147, 48, 10, 6, C.paper2); r.hl(148, 51, 8, C.ink); r.px(151, 50, C.rose);
  r.disc(149, 58, 2, C.bz); r.disc(155, 58, 2, C.bz);
  r.r(126, 82, 38, 16, BOX[1]); r.hl(126, 82, 38, BOX[0]); r.vl(163, 82, 16, BOX[2]); r.r(138, 86, 14, 6, C.paper2); r.hl(140, 88, 10, C.paper4);
  pendant(r, 120, 2);
}

function archive(r, ctx) {
  r.r(0, 0, RW, 4, C.slabD);
  for (let yy = 4; yy < 86; yy++) for (let xx = 0; xx < RW; xx++) {
    const row = Math.floor((yy - 4) / 9);
    const m = (yy - 4) % 9 === 8 || ((xx + (row % 2) * 12) % 24) === 0;
    r.px(xx, yy, m ? C.concD : (hash2(xx, yy) < 0.05 ? C.concD : hash2(xx + 3, yy) > 0.97 ? C.concL : C.conc));
  }
  concrete(r, 86, 22);
  // Pipes.
  r.r(0, 6, RW, 4, C.mD); r.hl(0, 6, RW, C.mL); r.hl(0, 9, RW, C.mDD);
  for (let x = 16; x < RW; x += 44) r.r(x, 5, 4, 6, C.mDD);
  r.disc(60, 16, 3, u32('#7a4a3a')); r.vl(60, 10, 3, C.mDD);
  for (const x of [50, 140]) { r.vl(x, 10, 10, C.ink); r.r(x - 2, 20, 5, 5, C.paper); r.hl(x - 2, 20, 5, C.mD); r.px(x, 22, C.glint); }
  // Metal shelving with archive boxes.
  for (const x of [4, 50, 96]) r.r(x, 24, 3, 77, C.mD);
  for (const b of ctx.boards) { r.r(4, b, 95, 2, C.mL); r.hl(4, b + 2, 95, C.mD); }
  for (const [x, b, label] of ctx.boxes) {
    r.r(x, b - 14, 18, 14, BOX[1]); r.hl(x, b - 14, 18, BOX[0]); r.vl(x + 17, b - 14, 14, BOX[2]); r.hl(x, b - 1, 18, BOX[3]);
    r.r(x + 3, b - 10, 12, 7, C.paper2); r.outline(x + 3, b - 10, 12, 7, C.paper4);
    digits(r, label, x + 4, b - 9, C.mDD);
  }
  for (const [x, b] of ctx.loose) { r.r(x, b - 4, 16, 4, MANILA[0]); r.hl(x, b - 1, 16, MANILA[1]); r.r(x + 3, b - 5, 5, 1, MANILA[0]); r.hl(x + 1, b - 2, 12, MANILA[2]); }
  // Safe.
  r.r(104, 60, 26, 41, C.mDD); r.hl(104, 60, 26, C.mD); r.vl(104, 60, 41, C.mD);
  r.outline(107, 64, 20, 32, C.ink); r.disc(117, 78, 4, C.bzD); r.disc(117, 78, 2, C.bz); r.px(117, 78, C.bzL);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; r.px(Math.round(117 + Math.cos(a) * 5), Math.round(78 + Math.sin(a) * 5), C.mL); }
  r.r(123, 75, 2, 7, C.bz);
  // Drawer chest.
  r.r(134, 64, 20, 37, C.wd); r.hl(134, 64, 20, C.wdL); r.vl(153, 64, 37, C.wdD);
  for (const y of [66, 78, 90]) { r.hl(135, y + 10, 18, C.wdD); r.r(141, y + 4, 6, 2, C.bz); }
  // Dry well.
  r.r(160, 28, 3, 46, C.wdD); r.r(186, 28, 3, 46, C.wdD); r.r(156, 24, 36, 4, C.wd); r.hl(156, 24, 36, C.wdL); r.hl(156, 27, 36, C.wdDD);
  r.r(170, 28, 10, 3, C.wdDD); r.r(181, 29, 6, 2, C.mDD);
  r.r(158, 72, 34, 3, C.ink);
  for (let yy = 75; yy < 101; yy++) for (let xx = 157; xx < 192; xx++) {
    const row = Math.floor((yy - 75) / 6);
    const m = (yy - 75) % 6 === 5 || ((xx + (row % 2) * 6) % 12) === 0;
    r.px(xx, yy, m ? C.concD : (hash2(xx >> 2, row) < 0.4 ? C.concL : C.conc));
  }
  r.hl(157, 75, 35, C.concL);
}

function home(r, ctx) {
  ceiling(r, u32('#e2d6c3'), u32('#c9b89c'));
  r.r(0, 4, RW, 82, u32('#efe6d6'));
  for (let y = 8; y < 84; y += 8) for (let x = 4; x < RW; x += 8) { const ox = ((y / 8) % 2) * 4; r.px(x + ox, y, u32('#d9c7a8')); r.px(x + ox + 1, y + 1, u32('#e3d3b8')); }
  baseboard(r, 82);
  planks(r, 86, 22);
  rug(r, 14, 92, 76, 10, C.lav, C.lavL, C.lavD);
  // Window and a picture.
  windowFrame(r, 16, 12, 30, 28, skyline(ctx.marketX));
  r.r(58, 16, 24, 18, C.wdD); r.r(60, 18, 20, 14, C.paper2); r.r(62, 24, 16, 6, C.lf); r.disc(74, 21, 2, C.ochreL);
  // Sofa.
  r.r(10, 60, 62, 16, C.sage); r.hl(10, 60, 62, C.sageL); for (let k = 12; k < 72; k += 20) r.vl(k + 19, 61, 14, C.sageD);
  r.r(6, 68, 10, 26, C.sageD); r.r(66, 68, 10, 26, C.sageD); r.hl(6, 68, 10, C.sage); r.hl(66, 68, 10, C.sage);
  r.r(14, 76, 54, 12, C.sageL); r.hl(14, 87, 54, C.sageD); r.r(18, 68, 10, 8, C.lavL); r.outline(18, 68, 10, 8, C.lav);
  r.r(10, 94, 3, 6, C.wdDD); r.r(70, 94, 3, 6, C.wdDD);
  // Side table and the phone.
  r.r(80, 72, 16, 2, C.wdL); r.r(80, 74, 16, 3, C.wd); r.r(82, 77, 2, 24, C.wdD); r.r(92, 77, 2, 24, C.wdD);
  r.r(83, 66, 10, 6, C.rose); r.hl(83, 66, 10, C.roseM); r.r(81, 63, 14, 2, C.ink); r.px(81, 62, C.ink); r.px(94, 62, C.ink); r.disc(88, 69, 2, C.paper); r.px(88, 69, C.ink);
  // Kitchen.
  r.r(104, 22, 52, 18, C.plL); r.outline(104, 22, 52, 18, C.plD); r.vl(130, 22, 18, C.plD); r.r(116, 30, 3, 2, C.mDD); r.r(141, 30, 3, 2, C.mDD);
  r.r(102, 62, 56, 3, C.mL); r.hl(102, 64, 56, C.mD);
  r.r(104, 65, 52, 36, C.plL); r.outline(104, 65, 52, 36, C.plD);
  for (const [x, y] of ctx.kitchen) { r.r(x, y, 24, 10, C.pl); r.outline(x, y, 24, 10, C.plD); r.r(x + 9, y + 4, 6, 2, C.mDD); }
  r.r(108, 56, 8, 6, C.lfD); r.px(110, 54, C.lf); r.px(113, 55, C.lf);
  r.r(140, 52, 10, 10, C.paper2); r.outline(140, 52, 10, 10, C.paper4);
  // Stairs up.
  for (let k = 0; k < 9; k++) {
    const x = 164 + k * 3, y = 96 - k * 10;
    r.r(x, y, 30, 3, C.wdL); r.r(x, y + 3, 30, 7, C.wd); r.hl(x, y + 9, 30, C.wdDD);
  }
  r.line(162, 72, 190, 0, C.wdDD); r.line(162, 73, 190, 1, C.wdDD);
  for (let k = 0; k < 9; k++) r.vl(166 + k * 3, 72 - k * 7 - 6, 10, C.wdD);
}

// ------------------------------------------------------------- registry

const IRS_BOARDS = [22, 38, 54, 70, 86];

export const SCENES = {
  library: {
    draw: library,
    ctx: {
      irsBoards: IRS_BOARDS,
      catalog: (() => { const o = []; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) o.push([150 + i * 6, 47 + j * 8]); return o; })(),
    },
    slots: {
      book: [[10, 38], [24, 38], [40, 38], [56, 38], [14, 54], [30, 54], [46, 54], [62, 54], [8, 70], [26, 70], [44, 70], [60, 70]],
      law: [[176, 70], [182, 70], [186, 86], [178, 86], [180, 54]],
      lawHigh: [[176, 22], [182, 38], [186, 22], [178, 38]],
    },
    enter: 196,
  },
  office: {
    draw: office,
    ctx: { cabinet: [41, 61, 81] },
    stations: { desk: 70, monitor: 86, phone: 100, cabinet: 126, engine: 146, cork: 30 },
    enter: -26,
  },
  lobby: { draw: lobby, front: lobbyFront, ctx: {}, stations: { flyers: 92, cooler: 124, truck: 4, desk: 60 }, enter: 196 },
  portals: {
    draw: portals,
    ctx: { booths: [{ kind: 'benefits', x: 2 }, { kind: 'brokerage', x: 50 }, { kind: 'bank', x: 98 }, { kind: 'hsa', x: 146 }] },
    enter: 196,
  },
  news: { draw: news, ctx: {}, stations: { tv: 76, radio: 100 }, enter: 196 },
  archive: {
    draw: archive,
    ctx: {
      boards: [44, 70, 99],
      boxes: [[6, 44, '19'], [26, 44, '20'], [52, 44, '21'], [72, 44, '22'], [8, 70, '23'], [54, 70, '24'], [74, 70, '25'], [28, 99, '18']],
      loose: [[30, 70], [56, 99], [76, 99], [6, 99]],
    },
    stations: { safe: 84, chest: 112, well: 138 },
    enter: 196,
  },
  home: { draw: home, ctx: { kitchen: [[106, 68], [130, 68]] }, stations: { phone: 98, seat: 30, drawer: 110 }, enter: 196 },
};

export function buildScene(name, marketX, Raster) {
  const sc = SCENES[name];
  const r = new Raster(RW, RH);
  sc.draw(r, { ...sc.ctx, marketX });
  return r;
}

// Things that stand in front of the people (desk fronts).
export function buildFront(name, Raster) {
  const sc = SCENES[name];
  if (!sc.front) return null;
  const r = new Raster(RW, RH);
  sc.front(r);
  return r;
}
