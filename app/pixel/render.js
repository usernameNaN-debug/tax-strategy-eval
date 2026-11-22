// Builds the static world once, then per frame: copy, draw dynamic things,
// and post-process un-inked rooms into a pencil sketch on the page colour.
import { W, H, ROOM_RECTS } from './layout.js';
import { drawStatic } from './scene.js';
import { Raster } from './gfx.js';
import { BAYER } from './palette.js';

export function buildWorld(marketX) {
  const base = new Raster(W, H);
  drawStatic(base, marketX);
  const rooms = new Uint8Array(W * H);
  for (const r of ROOM_RECTS) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      // The attic follows the roof line.
      if (r.y < 98 && r.id === 8 && Math.abs(x - 426) > (y - 46) * 1.08 - 3) continue;
      rooms[y * W + x] = r.id;
    }
  }
  return { base, rooms };
}

// inkLevel[room] in [0,1]; dim[room] in [0,1] fades toward the page colour.
// Sketch: luminance mapped to a pale grey so outlines survive and fills vanish.
export function postProcess(frame, rooms, inkLevel, dim, page) {
  const u = frame.u32;
  const [pr, pg, pb] = page;
  const pageC = ((255 << 24) | (pb << 16) | (pg << 8) | pr) >>> 0;
  const dark = (pr + pg + pb) / 3 < 128;
  for (let y = 0; y < H; y++) {
    const row = (y & 3) << 2;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const c = u[i];
      if (!(c >>> 24)) continue;
      const room = rooms[i];
      const t = BAYER[row | (x & 3)];
      if (dim[room] > t) { u[i] = pageC; continue; }
      if (inkLevel[room] > t) continue;
      const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
      const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      const k = 0.05 + 0.36 * Math.pow(1 - l, 1.45);
      const target = dark ? 235 : 70;
      const v = (base) => Math.round(base + (target - base) * k);
      u[i] = ((255 << 24) | (v(pb) << 16) | (v(pg) << 8) | v(pr)) >>> 0;
    }
  }
}

export function pageColor() {
  const s = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#ffffff';
  const n = parseInt((s.startsWith('#') ? s : '#ffffff').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
