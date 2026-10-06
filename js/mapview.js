'use strict';
// ---------------------------------------------------------------------------
// Zoomed-out world map: a half-scale glyph rendering of the whole overworld
// (4px per tile), a 1px-per-tile colour version for far zoom, fog of war
// that lifts as you explore, POI icons and a compass rose.
// ---------------------------------------------------------------------------

const MapView = {
  init(world) {
    const m = world.map, W = m.w, H = m.h;
    this.world = world; this.W = W; this.H = H;
    this.big = this.bakeBig(m);
    this.small = this.bakeSmall(m);
    this.fog = document.createElement('canvas'); this.fog.width = W; this.fog.height = H;
    this.fctx = this.fog.getContext('2d');
    this.fogData = this.fctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) this.fogData.data[i * 4 + 3] = 215;
    this.fogDirty = true;
    this.seen = new Uint8Array(W * H);
    this.zoom = 2; this.cx = W / 2; this.cy = H / 2;
  },

  bakeBig(m) {
    const W = m.w, H = m.h, S = 4;
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W * S, H * S), d = img.data, IW = W * S;
    const pal = m.bgPal.map((h) => { const r = hexToRgb(h); return [r[0] * 1.5, r[1] * 1.5, r[2] * 1.5]; });
    const set = (x, y, col) => {
      if (x < 0 || y < 0 || x >= IW || y >= H * S) return;
      const o = (y * IW + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const col = pal[m.bg[y * W + x]];
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) set(x * S + i, y * S + j, col);
    }
    const white = [236, 236, 228], dark = [8, 8, 10];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const r = m.road[y * W + x];
      if (!r) continue;
      const px = x * S, py = y * S;
      if (r & R_DOT) { set(px + 2, py + 2, white); continue; }
      set(px + 2, py + 2, white);
      if (r & R_N) { set(px + 2, py, white); set(px + 2, py + 1, white); }
      if (r & R_S) set(px + 2, py + 3, white);
      if (r & R_W) { set(px, py + 2, white); set(px + 1, py + 2, white); }
      if (r & R_E) set(px + 3, py + 2, white);
      if (r & R_NODE) {
        for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) set(px + i, py + j, white);
        set(px + 2, py + 2, dark);
      }
    }
    const rgbCache = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const gv = m.glyph[y * W + x];
      if (!gv) continue;
      const g = gv & 0x7fff, def = GLYPHS[g], mini = def.mini, flip = gv & FLIP;
      let cols = rgbCache.get(g);
      if (!cols) { cols = def.colors.map(hexToRgb); rgbCache.set(g, cols); }
      const ox = x * S, oy = (y + 1) * S - mini.h;
      for (let j = 0; j < mini.h; j++) for (let i = 0; i < mini.w; i++) {
        const ci = mini.data[j * mini.w + i];
        if (ci) set(ox + (flip ? mini.w - 1 - i : i), oy + j, cols[ci - 1]);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },

  bakeSmall(m) {
    const W = m.w, H = m.h;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H), d = img.data;
    const pal = m.bgPal.map((h) => { const r = hexToRgb(h); return [r[0] * 2, r[1] * 2, r[2] * 2]; });
    for (let i = 0; i < W * H; i++) {
      let col = pal[m.bg[i]];
      const gv = m.glyph[i] & 0x7fff;
      if (m.road[i]) col = (m.road[i] & R_DOT) && (i % 2) ? col : [236, 236, 228];
      else if (gv) {
        const def = GLYPHS[gv], rgb = hexToRgb(def.mapColor);
        const k = def.mini.data.reduce((a, b) => a + (b ? 1 : 0), 0) / def.mini.data.length;
        const f = 0.45 + 0.55 * Math.min(1, k * 2.2);
        col = [lerp(col[0], rgb[0], f), lerp(col[1], rgb[1], f), lerp(col[2], rgb[2], f)];
      }
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  },

  reveal(px, py, rad) {
    const W = this.W, H = this.H, d = this.fogData.data;
    const r2 = (rad + 4) * (rad + 4);
    for (let y = Math.max(0, py - rad - 4); y <= Math.min(H - 1, py + rad + 4); y++) {
      for (let x = Math.max(0, px - rad - 4); x <= Math.min(W - 1, px + rad + 4); x++) {
        const dx = x - px, dy = y - py, dd = dx * dx + dy * dy;
        if (dd > r2) continue;
        const a = Math.round(clamp((Math.sqrt(dd) - rad) / 4, 0, 1) * 215);
        const o = (y * W + x) * 4 + 3;
        if (a < d[o]) { d[o] = a; this.fogDirty = true; }
        if (a < 100) this.seen[y * W + x] = 1;
      }
    }
  },

  open(player) { this.cx = player.x + 0.5; this.cy = player.y + 0.5; this.zoom = 2; },

  update(dt, input) {
    const sp = 260 / this.zoom * dt;
    if (input.held('up')) this.cy -= sp;
    if (input.held('down')) this.cy += sp;
    if (input.held('left')) this.cx -= sp;
    if (input.held('right')) this.cx += sp;
    if (input.drag) { this.cx -= input.drag.dx / this.zoom; this.cy -= input.drag.dy / this.zoom; input.drag.dx = 0; input.drag.dy = 0; }
    this.cx = clamp(this.cx, 0, this.W); this.cy = clamp(this.cy, 0, this.H);
  },

  zoomBy(dir) {
    const levels = [0.5, 1, 2, 4];
    const k = clamp(levels.indexOf(this.zoom) + dir, 0, levels.length - 1);
    this.zoom = levels[k];
  },

  render(sctx, ectx, VW, VH, time, player, pois) {
    const z = this.zoom;
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, VW + 2, VH + 2);
    ectx.fillStyle = '#000'; ectx.fillRect(0, 0, VW + 2, VH + 2);
    const ox = Math.round(this.cx * z - VW / 2) - 1, oy = Math.round(this.cy * z - VH / 2) - 1;
    sctx.imageSmoothingEnabled = false;
    if (z === 4) sctx.drawImage(this.big, -ox, -oy);
    else { sctx.imageSmoothingEnabled = z < 1; sctx.drawImage(this.small, -ox, -oy, this.W * z, this.H * z); }
    if (this.fogDirty) { this.fctx.putImageData(this.fogData, 0, 0); this.fogDirty = false; }
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(this.fog, -ox, -oy, this.W * z, this.H * z);
    sctx.imageSmoothingEnabled = false;

    // POI icons on discovered locations
    for (const p of pois) {
      // boss lairs and arenas are known from the start (in red) so you can set out for them
      const boss = p.type === 'lair' || p.type === 'arena';
      if (!boss && !this.seen[p.y * this.W + p.x]) continue;
      const icon = MAP_ICONS[p.type];
      if (!icon) continue;
      const done = p.type === 'lair' ? Combat.worldDown.has(p.lair)
        : p.type === 'arena' && game.world.entrances.some((e) => e.poi === p && Combat.bossDown.has(String(e.id)));
      const x = Math.round(p.x * z + z / 2 - ox) - 2, y = Math.round(p.y * z - oy) - 6;
      if (x < -8 || y < -8 || x > VW + 8 || y > VH + 8) continue;
      sctx.fillStyle = '#000'; sctx.fillRect(x - 1, y - 1, 7, 7);
      for (const ctx of [sctx, ectx]) {
        ctx.fillStyle = ctx === sctx ? (boss && !done ? '#ff4a4a' : '#f2f0e8') : (boss && !done ? '#a02020' : '#6a6a64');
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (icon[j][i] === '1') ctx.fillRect(x + i, y + j, 1, 1);
      }
    }
    // player marker
    const px = Math.round((player.px / TS + 0.5) * z - ox), py = Math.round((player.py / TS + 0.5) * z - oy);
    const blink = (Math.sin(time * 6) > -0.3);
    for (const ctx of [sctx, ectx]) {
      ctx.fillStyle = SCARVES[Coop.myColor()];
      if (blink) { ctx.fillRect(px - 1, py - 1, 3, 3); }
      const rr = 4 + Math.floor((time * 6) % 4);
      ctx.fillRect(px - rr, py, 2, 1); ctx.fillRect(px + rr - 1, py, 2, 1);
      ctx.fillRect(px, py - rr, 1, 2); ctx.fillRect(px, py + rr - 1, 1, 2);
    }
    // co-op friends out in the overworld
    for (const f of Coop.peers.values()) {
      if (f.where !== 'o') continue;
      const fx = Math.round((f.px / TS + 0.5) * z - ox), fy = Math.round((f.py / TS + 0.5) * z - oy);
      for (const ctx of [sctx, ectx]) { ctx.fillStyle = SCARVES[f.c]; ctx.fillRect(fx - 1, fy - 1, 3, 3); }
    }
    // on touch screens the menu button sits top-left, so the compass moves right
    this.compass(sctx, ectx, document.body.classList.contains('touch') ? Math.round(VW) - 28 : 26, 30);
  },

  compass(sctx, ectx, cx, cy) {
    const F = {
      N: ['1..1', '11.1', '1.11', '1..1', '1..1'], E: ['111', '1..', '11.', '1..', '111'],
      S: ['111', '1..', '111', '..1', '111'], W: ['1...1', '1...1', '1.1.1', '1.1.1', '.1.1.'],
    };
    const letter = (ctx, ch, x, y) => { const g = F[ch]; for (let j = 0; j < 5; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '1') ctx.fillRect(x + i, y + j, 1, 1); };
    for (const ctx of [sctx, ectx]) {
      ctx.fillStyle = ctx === sctx ? '#f2f0e8' : '#3a3a36';
      ctx.fillRect(cx - 9, cy, 19, 1); ctx.fillRect(cx, cy - 9, 1, 19);
      ctx.fillRect(cx - 2, cy - 1, 5, 3); ctx.fillRect(cx - 1, cy - 2, 3, 5);
      ctx.fillRect(cx - 1, cy - 8, 3, 1); ctx.fillRect(cx - 1, cy + 8, 3, 1);
      ctx.fillRect(cx - 8, cy - 1, 1, 3); ctx.fillRect(cx + 8, cy - 1, 1, 3);
      letter(ctx, 'N', cx - 1, cy - 17); letter(ctx, 'S', cx - 1, cy + 13);
      letter(ctx, 'W', cx - 17, cy - 2); letter(ctx, 'E', cx + 13, cy - 2);
    }
  },
};
