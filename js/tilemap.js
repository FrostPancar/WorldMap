'use strict';
// ---------------------------------------------------------------------------
// TileMap: shared by the overworld and every interior.
// Static layers are baked into 16x16-tile chunk canvases; animated, emissive
// and light-emitting cells are indexed per chunk so each frame only touches
// what is on screen.
// ---------------------------------------------------------------------------

const CH = 16;              // chunk size in tiles
const CHPX = CH * TS;       // chunk size in pixels
const FLIP = 0x8000;        // glyph high bit = horizontal flip

// road bits
const R_N = 1, R_E = 2, R_S = 4, R_W = 8, R_NODE = 16, R_DOT = 32, R_ON = 64;

class TileMap {
  constructor(w, h, opts) {
    this.w = w; this.h = h;
    this.glyph = new Uint16Array(w * h);
    this.solid = new Uint8Array(w * h);
    this.bg = new Uint8Array(w * h);
    this.biome = new Uint8Array(w * h);
    this.water = new Uint8Array(w * h);
    this.road = new Uint8Array(w * h);
    this.entr = new Map();
    this.bgPal = opts.bgPal;
    this.kind = opts.kind;
    this.ambient = opts.ambient || [1, 1, 1];
    this.voidColor = opts.voidColor || '#000000';
    this.roadColor = opts.roadColor || '#ecece4';
    this.cw = Math.ceil(w / CH); this.chh = Math.ceil(h / CH);
    this.cache = new Map();
    this.extraLights = [];
    this.creatures = [];
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  i(x, y) { return y * this.w + x; }
  blocked(x, y) { return !this.inb(x, y) || this.solid[y * this.w + x] === 1; }
  put(x, y, g, solid, flip) {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x;
    this.glyph[i] = g ? (G[g] | (flip ? FLIP : 0)) : 0;
    if (solid !== undefined) this.solid[i] = solid ? 1 : 0;
  }
  addLight(px, py, c, r, inten, flick, ember) {
    this.extraLights.push({ x: px, y: py, rgb: hexToRgb(c), r, i: inten, f: flick || 0.1, ember: ember || 0 });
  }

  // Build per-chunk index lists. Call after generation is finished.
  finalize() {
    const n = this.cw * this.chh;
    this.chunks = new Array(n);
    for (let k = 0; k < n; k++) this.chunks[k] = { anim: [], emit: [], lights: [] };
    const w = this.w;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) {
      const g = this.glyph[y * w + x] & 0x7fff;
      if (!g) continue;
      const d = GLYPHS[g];
      const ck = this.chunks[((y / CH) | 0) * this.cw + ((x / CH) | 0)];
      if (d.anim) ck.anim.push(y * w + x);
      else if (d.emit) ck.emit.push(y * w + x);
      if (d.light) {
        const L = d.light;
        ck.lights.push({ x: x * TS + L.ox, y: y * TS + L.oy, rgb: L.rgb, r: L.r, i: L.i, f: L.f, ember: L.ember || 0,
          ph: hash2(x, y, 9) * 100 });
      }
    }
    for (const L of this.extraLights) {
      const cx = clamp((L.x / CHPX) | 0, 0, this.cw - 1), cy = clamp((L.y / CHPX) | 0, 0, this.chh - 1);
      L.ph = hash2(L.x | 0, L.y | 0, 3) * 100;
      this.chunks[cy * this.cw + cx].lights.push(L);
    }
    this.cache.clear();
  }

  chunkCanvas(cx, cy) {
    const key = cy * this.cw + cx;
    let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }
    c = this.bake(cx, cy);
    this.cache.set(key, c);
    if (this.cache.size > 260) this.cache.delete(this.cache.keys().next().value);
    return c;
  }

  bake(cx, cy) {
    const c = document.createElement('canvas');
    c.width = CHPX; c.height = CHPX;
    const ctx = c.getContext('2d');
    const w = this.w, x0 = cx * CH, y0 = cy * CH;
    ctx.fillStyle = this.voidColor; ctx.fillRect(0, 0, CHPX, CHPX);
    // background runs
    const xe = Math.min(x0 + CH, w);
    for (let y = y0; y < y0 + CH && y < this.h; y++) {
      let run = x0, cur = this.bg[y * w + x0];
      for (let x = x0 + 1; x <= xe; x++) {
        const b = x < xe ? this.bg[y * w + x] : -1;
        if (b !== cur) {
          ctx.fillStyle = this.bgPal[cur];
          ctx.fillRect((run - x0) * TS, (y - y0) * TS, (x - run) * TS, TS);
          run = x; cur = b;
        }
      }
    }
    // roads
    ctx.fillStyle = this.roadColor;
    for (let y = y0; y < y0 + CH && y < this.h; y++) for (let x = x0; x < x0 + CH && x < w; x++) {
      const r = this.road[y * w + x];
      if (r) this.drawRoad(ctx, (x - x0) * TS, (y - y0) * TS, r, this.bgPal[this.bg[y * w + x]]);
    }
    // static glyphs, top to bottom so tall sprites overlap correctly
    for (let y = y0; y < y0 + CH + 6 && y < this.h; y++) {
      for (let x = Math.max(0, x0 - 5); x < x0 + CH && x < w; x++) {
        const gv = this.glyph[y * w + x];
        if (!gv) continue;
        const g = gv & 0x7fff, d = GLYPHS[g];
        if (d.anim) continue;
        const px = (x - x0) * TS, py = (y - y0 + 1) * TS - d.h;
        if (px + d.w <= 0 || px >= CHPX || py >= CHPX || py + d.h <= 0) continue;
        ctx.drawImage(spr(g, 0, gv & FLIP), px, py);
      }
    }
    // interiors: a pale rim where walls meet open floor
    if (this.wall) {
      ctx.fillStyle = this.edgeColor || '#8a8cae';
      ctx.globalAlpha = 0.7;
      const W = this.wall, h = this.h;
      for (let y = y0; y < y0 + CH && y < h; y++) for (let x = x0; x < xe; x++) {
        const i = y * w + x;
        if (!W[i]) continue;
        const px = (x - x0) * TS, py = (y - y0) * TS;
        if (y + 1 < h && !W[i + w]) ctx.fillRect(px, py + TS - 1, TS, 1);
        if (y > 0 && !W[i - w]) ctx.fillRect(px, py, TS, 1);
        if (x > 0 && !W[i - 1]) ctx.fillRect(px, py, 1, TS);
        if (x + 1 < w && !W[i + 1]) ctx.fillRect(px + TS - 1, py, 1, TS);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  drawRoad(ctx, px, py, r, bgc) {
    const cx = px + 3, cy = py + 3;
    ctx.fillStyle = this.roadColor;
    if (r & R_DOT) {
      ctx.fillRect(cx, cy, 2, 2);
      if (r & R_N) ctx.fillRect(cx, py, 2, 1);
      if (r & R_S) ctx.fillRect(cx, py + 7, 2, 1);
      if (r & R_W) ctx.fillRect(px, cy, 1, 2);
      if (r & R_E) ctx.fillRect(px + 7, cy, 1, 2);
      return;
    }
    ctx.fillRect(cx, cy, 2, 2);
    if (r & R_N) ctx.fillRect(cx, py, 2, 4);
    if (r & R_S) ctx.fillRect(cx, cy, 2, 5);
    if (r & R_W) ctx.fillRect(px, cy, 4, 2);
    if (r & R_E) ctx.fillRect(cx, cy, 5, 2);
    if (r & R_NODE) {
      ctx.fillRect(px + 2, py + 1, 4, 6);
      ctx.fillRect(px + 1, py + 2, 6, 4);
      ctx.fillStyle = bgc;
      ctx.fillRect(px + 3, py + 3, 2, 2);
      ctx.fillStyle = this.roadColor;
    }
  }
}
