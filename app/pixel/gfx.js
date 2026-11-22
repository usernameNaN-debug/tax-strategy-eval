// A small software rasterizer. All drawing writes straight into a Uint32
// pixel buffer, so compositing, sketching and dithering are cheap per frame.

export class Raster {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.u32 = new Uint32Array(this.img.data.buffer);
  }
  clear() { this.u32.fill(0); }
  copyFrom(other) { this.u32.set(other.u32); }
  px(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.u32[y * this.w + x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.u32[y * this.w + x];
  }
  r(x, y, w, h, c) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    let x0 = Math.max(0, x), x1 = Math.min(this.w, x + w);
    let y0 = Math.max(0, y), y1 = Math.min(this.h, y + h);
    if (x1 <= x0 || y1 <= y0) return;
    for (let yy = y0; yy < y1; yy++) this.u32.fill(c, yy * this.w + x0, yy * this.w + x1);
  }
  hl(x, y, w, c) { this.r(x, y, w, 1, c); }
  vl(x, y, h, c) { this.r(x, y, 1, h, c); }
  outline(x, y, w, h, c) {
    this.r(x, y, w, 1, c); this.r(x, y + h - 1, w, 1, c);
    this.r(x, y, 1, h, c); this.r(x + w - 1, y, 1, h, c);
  }
  // Filled panel with a lit top-left edge and a shadowed bottom-right edge.
  bevel(x, y, w, h, light, mid, dark, line) {
    this.r(x, y, w, h, mid);
    this.r(x + 1, y + 1, w - 2, 1, light);
    this.r(x + 1, y + 1, 1, h - 2, light);
    this.r(x + 1, y + h - 2, w - 2, 1, dark);
    this.r(x + w - 2, y + 1, 1, h - 2, dark);
    if (line) this.outline(x, y, w, h, line);
  }
  // Checker dither between two colours.
  dither(x, y, w, h, a, b, phase = 0) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, ((xx + yy + phase) & 1) ? a : b);
  }
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) this.px(cx + x, cy + y, c);
  }
  ring(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r + r * 0.8 && d >= (r - 1) * (r - 1) + (r - 1) * 0.8) this.px(cx + x, cy + y, c);
    }
  }
  // Draw a string sprite with a char -> colour map.
  sprite(rows, x, y, map, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      const n = row.length;
      for (let i = 0; i < n; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = map[ch];
        if (c === undefined) continue;
        this.px(flip ? x + (n - 1 - i) : x + i, y + j, c);
      }
    }
  }
}

export const hash2 = (a, b) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
