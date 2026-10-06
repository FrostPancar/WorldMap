'use strict';
// ---------------------------------------------------------------------------
// Main loop: input, world/interior/map modes, rendering into three low-res
// layers (scene colour, light, emissive) and handing them to the post stack.
// ---------------------------------------------------------------------------

const cvs = document.getElementById('cvs');
const post = new Post(cvs);
const ctx2d = post.ok ? null : cvs.getContext('2d');

const layers = {};
for (const k of ['scene', 'light', 'emit']) {
  const c = document.createElement('canvas');
  layers[k] = { c, ctx: c.getContext('2d', { alpha: false }) };
}

const game = {
  mode: 'world', world: null, map: null, ret: null, stack: [], interiors: new Map(),
  time: 0, day: 0.79, bamb: 1, camX: 0, camY: 0,
  fade: 1, fadeDir: -1, fadeSpeed: 2.2, pending: null,
  player: new Player(), view: { scale: 4, VW: 480, VH: 270, SW: 482, SH: 272 },
};

// --- input -------------------------------------------------------------------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
const input = {
  order: [], keys: new Set(), drag: null, run: false,
  held(d) { return this.order.indexOf(d) >= 0; },
  dir() { return this.order.length ? this.order[this.order.length - 1] : null; },
};
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const d = KEYMAP[e.code];
  if (d) { if (input.order.indexOf(d) < 0) input.order.push(d); e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
  if (e.repeat) return;
  if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); toggleMap(); }
  if (e.code === 'Escape') { if (game.mode === 'map') toggleMap(); else CoopUI.toggle(); }
  if (game.mode === 'map') {
    if (e.code === 'KeyE' || e.code === 'Equal' || e.code === 'NumpadAdd') MapView.zoomBy(1);
    if (e.code === 'KeyQ' || e.code === 'Minus' || e.code === 'NumpadSubtract') MapView.zoomBy(-1);
    if (e.code === 'Space') MapView.open(game.player);
  }
});
addEventListener('keyup', (e) => {
  const d = KEYMAP[e.code];
  if (d) input.order = input.order.filter((k) => k !== d);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
});
addEventListener('blur', () => { input.order = []; input.run = false; });
cvs.addEventListener('wheel', (e) => { if (game.mode === 'map') { e.preventDefault(); MapView.zoomBy(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
cvs.addEventListener('pointerdown', (e) => { input.drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; });
addEventListener('pointerup', () => { input.drag = null; });
addEventListener('pointermove', (e) => {
  if (!input.drag) return;
  const s = game.view.scale / (devicePixelRatio || 1);
  input.drag.dx += (e.clientX - input.drag.x) / s; input.drag.dy += (e.clientY - input.drag.y) / s;
  input.drag.x = e.clientX; input.drag.y = e.clientY;
});
cvs.addEventListener('dblclick', () => { if (game.mode === 'map') MapView.zoomBy(1); });

// --- resolution ----------------------------------------------------------------
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const sw = Math.max(1, Math.floor(innerWidth * dpr)), sh = Math.max(1, Math.floor(innerHeight * dpr));
  cvs.width = sw; cvs.height = sh;
  const base = Math.max(2, Math.floor(Math.min(sw / 400, sh / 225)));
  const scale = game.mode === 'map' ? Math.max(1, Math.floor(base / 2)) : base;
  const VW = sw / scale, VH = sh / scale;
  const SW = Math.ceil(VW) + 2, SH = Math.ceil(VH) + 2;
  Object.assign(game.view, { scale, VW, VH, SW, SH });
  for (const k in layers) {
    layers[k].c.width = SW; layers[k].c.height = SH;
    layers[k].ctx.imageSmoothingEnabled = false;
  }
  post.resize(SW, SH);
}
addEventListener('resize', resize);

// --- transitions -----------------------------------------------------------------
function fadeTo(fn, speed) {
  if (game.pending || game.fadeDir === 1) return;
  game.pending = fn; game.fadeDir = 1; game.fadeSpeed = speed || 2.2;
}
function toggleMap() {
  if (game.pending) return;
  fadeTo(() => {
    if (game.mode === 'map') game.mode = 'world';
    else { game.mode = 'map'; MapView.open(game.player); }
    resize();
    snapCamera();
  }, 4);
}
// game.stack holds where to return to for every level we have gone down.
function enterInterior(ent) {
  const p = game.player;
  const back = { map: game.map, x: ent.ret ? ent.ret.x : p.fx, y: ent.ret ? ent.ret.y : p.fy, ent: game.ret };
  fadeTo(() => {
    let im = game.interiors.get(ent.id);
    if (!im) { im = genInterior(ent); game.interiors.set(ent.id, im); }
    game.stack.push(back);
    game.ret = ent; game.map = im;
    game.player.place(im.spawn.x, im.spawn.y); game.player.face = 'down';
    particles.length = 0;
    snapCamera();
  });
}
function exitInterior() {
  fadeTo(() => {
    const back = game.stack.pop() || { map: game.world.map, x: game.world.start.x, y: game.world.start.y, ent: null };
    game.map = back.map; game.ret = back.ent;
    game.player.place(back.x, back.y); game.player.face = 'down';
    particles.length = 0;
    snapCamera();
  });
}

// --- camera -------------------------------------------------------------------------
function cameraTarget() {
  const m = game.map, v = game.view, p = game.player;
  let x = p.px + TS / 2 - v.VW / 2, y = p.py + TS / 2 - v.VH / 2;
  const mw = m.w * TS, mh = m.h * TS;
  x = mw <= v.VW ? (mw - v.VW) / 2 : clamp(x, 0, mw - v.VW);
  y = mh <= v.VH ? (mh - v.VH) / 2 : clamp(y, 0, mh - v.VH);
  return [x, y];
}
function snapCamera() { const [x, y] = cameraTarget(); game.camX = x; game.camY = y; }

// --- lighting helpers -----------------------------------------------------------------
const _lightSpr = new Map();
function lightSprite(rgb) {
  const key = rgb.join(',');
  let c = _lightSpr.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, a = Math.pow(1 - t, 2.2);
    g.addColorStop(t, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  }
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _lightSpr.set(key, c);
  return c;
}

function dayState(t) {
  const sun = Math.cos((t - 0.5) * Math.PI * 2) * 0.5 + 0.5;
  const day = smoothstep(0.32, 0.72, sun);
  const night = [0.24, 0.27, 0.46], noon = [1.0, 0.98, 0.95], dusk = [1.0, 0.56, 0.42];
  const a = night.map((n, i) => lerp(n, noon[i], day));
  const s = Math.exp(-Math.pow((sun - 0.45) / 0.13, 2)) * 0.55;
  return { amb: a.map((v, i) => lerp(v, dusk[i] * (0.35 + day * 0.6), s)), day };
}

// --- update ---------------------------------------------------------------------------
function update(dt) {
  game.time += dt;
  game.day = (game.day + dt / 360) % 1;
  if (Coop.room) game.day = (Date.now() / 1000 / 360 + 0.79) % 1;
  if (game.fadeDir) {
    game.fade += game.fadeDir * dt * game.fadeSpeed;
    if (game.fadeDir === 1 && game.fade >= 1) {
      game.fade = 1;
      const fn = game.pending; game.pending = null;
      if (fn) fn();
      game.fadeDir = -1;
    } else if (game.fadeDir === -1 && game.fade <= 0) { game.fade = 0; game.fadeDir = 0; }
  }
  if (game.mode === 'map') { MapView.update(dt, input); return; }

  const m = game.map, p = game.player;
  const dir = game.pending ? null : input.dir();
  const arrived = p.update(dt, m, dir, input.run);
  if (arrived) {
    if (m === game.world.map) MapView.reveal(p.x, p.y, 13);
    const e = m.entr.get(p.y * m.w + p.x);
    if (e) { if (e.exit) exitInterior(); else enterInterior(e); }
    for (let k = 0; k < 2; k++) spawnParticle('step', p.x * TS + 2 + Math.random() * 4, p.y * TS + 7, (Math.random() - 0.5) * 6, -2 - Math.random() * 3, 0.35);
  }
  Coop.update(dt, p);
  const lim = 44;
  for (const c of m.creatures) {
    if (Math.abs(c.x - p.x) > lim || Math.abs(c.y - p.y) > lim) continue;
    updateCreature(c, m, dt, p);
  }
  // camera
  const [tx, ty] = cameraTarget();
  const k = 1 - Math.exp(-dt * 9);
  game.camX += (tx - game.camX) * k; game.camY += (ty - game.camY) * k;
  // biome ambience
  if (m === game.world.map) {
    const b = m.biome[p.y * m.w + p.x];
    game.bamb += (BIOME_AMB[b] - game.bamb) * Math.min(1, dt * 1.2);
  }
  ambientParticles(dt);
  updateParticles(dt);
}

function ambientParticles(dt) {
  const m = game.map, v = game.view, over = m === game.world.map;
  const night = over ? 1 - dayState(game.day).day : 1;
  const tries = Math.ceil(dt * 260);
  for (let k = 0; k < tries; k++) {
    const x = Math.floor((game.camX + Math.random() * v.VW) / TS), y = Math.floor((game.camY + Math.random() * v.VH) / TS);
    if (!m.inb(x, y)) continue;
    const i = y * m.w + x, wx = x * TS + Math.random() * TS, wy = y * TS + Math.random() * TS, r = Math.random();
    if (!over) {
      if (r < 0.025) spawnParticle('mote', wx, wy, (Math.random() - 0.5) * 3, -1 - Math.random() * 2, 3 + Math.random() * 3);
      else if (m.water[i] && r < 0.06) spawnParticle('twinkle', wx, wy, 0, 0, 0.5);
      continue;
    }
    if (m.water[i]) { if (r < 0.03) spawnParticle('twinkle', wx, wy, 0, 0, 0.45); continue; }
    switch (m.biome[i]) {
      case B.TAIGA: case B.FOREST: case B.GRASS: case B.PLAINS:
        if (r < 0.03 * night) spawnParticle('firefly', wx, wy, 0, 0, 4 + Math.random() * 4);
        else if (m.biome[i] === B.FOREST && r < 0.035) spawnParticle('leaf', wx, wy - 20, 0, 6 + Math.random() * 4, 4);
        break;
      case B.SPOOKY: if (r < 0.03) spawnParticle('wisp', wx, wy, 0, 0, 5); break;
      case B.MUSH:
        if (r < 0.03) spawnParticle('spore', wx, wy, (Math.random() - 0.5) * 4, -3 - Math.random() * 3, 4);
        else if (r < 0.045 * night) spawnParticle('firefly', wx, wy, 0, 0, 5);
        break;
      case B.PINK: if (r < 0.04) spawnParticle('sparkle', wx, wy, 0, -2, 0.9); break;
      case B.DUNES: if (r < 0.02) spawnParticle('dust', wx, wy, 14 + Math.random() * 10, (Math.random() - 0.5) * 2, 2.5); break;
      case B.MARSH: if (r < 0.025) spawnParticle('bubble', wx, wy, 0, -5, 1.2); break;
      case B.VOLCANO:
        if (r < 0.02) spawnParticle('ember', wx, wy, (Math.random() - 0.5) * 6, -8 - Math.random() * 8, 1.6);
        else if (r < 0.04) spawnParticle('ash', wx, wy - 20, 3, 5 + Math.random() * 3, 4);
        break;
      case B.CRYSTAL: if (r < 0.05) spawnParticle('shard', wx, wy, 0, -1.5, 1.2); break;
      case B.AUTUMN: if (r < 0.04) spawnParticle('leafA', wx, wy - 20, 0, 6 + Math.random() * 4, 4); break;
    }
  }
  // snow falls across the whole view while standing in the snowfields
  if (over && m.biome[game.player.y * m.w + game.player.x] === B.SNOW) {
    const n = Math.ceil(dt * 45);
    for (let k = 0; k < n; k++) spawnParticle('snow', game.camX + Math.random() * (v.VW + 40) - 20, game.camY - 4, 0, 12 + Math.random() * 10, 25);
  }
}

// --- render ------------------------------------------------------------------------------
function render() {
  const v = game.view, S = layers.scene.ctx, L = layers.light.ctx, E = layers.emit.ctx;
  const P = {
    camX: 0, camY: 0, amb: [1, 1, 1], emitK: 1, levels: 5, haze: 1, threshold: 0.62, viewW: v.VW, viewH: v.VH,
    fracX: 0, fracY: 0, time: game.time, fade: game.fade, curve: 0.045, scan: 0.55, bloom: 0.85, ca: 0.38,
  };
  if (game.mode === 'map') {
    MapView.render(S, E, v.VW, v.VH, game.time, game.player, game.world.pois);
    L.fillStyle = 'rgb(128,128,128)'; L.fillRect(0, 0, v.SW, v.SH);
    P.threshold = 0.75; P.bloom = 0.7; P.scan = 0.35; P.ca = 0.3;
  } else renderWorld(S, L, E, P);
  if (post.ok) post.render(layers.scene.c, layers.light.c, layers.emit.c, P);
  else {
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(layers.scene.c, 1, 1, v.VW, v.VH, 0, 0, cvs.width, cvs.height);
  }
}

function renderWorld(S, L, E, P) {
  const v = game.view, m = game.map, p = game.player, t = game.time;
  const over = m === game.world.map;
  const ix = Math.floor(game.camX), iy = Math.floor(game.camY);
  const ox = ix - 1, oy = iy - 1;
  P.fracX = game.camX - ix; P.fracY = game.camY - iy;
  P.camX = ((ox % 4) + 4) % 4; P.camY = ((oy % 4) + 4) % 4;

  S.fillStyle = m.voidColor; S.fillRect(0, 0, v.SW, v.SH);
  E.fillStyle = '#000'; E.fillRect(0, 0, v.SW, v.SH);

  const cx0 = Math.max(0, Math.floor(ox / CHPX)), cy0 = Math.max(0, Math.floor(oy / CHPX));
  const cx1 = Math.min(m.cw - 1, Math.floor((ox + v.SW) / CHPX)), cy1 = Math.min(m.chh - 1, Math.floor((oy + v.SH) / CHPX));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) S.drawImage(m.chunkCanvas(cx, cy), cx * CHPX - ox, cy * CHPX - oy);

  // animated + emissive cells (one chunk margin below for tall sprites)
  const W = m.w;
  for (let cy = cy0; cy <= Math.min(m.chh - 1, cy1 + 1); cy++) for (let cx = Math.max(0, cx0 - 1); cx <= cx1; cx++) {
    const ck = m.chunks[cy * m.cw + cx];
    for (const i of ck.anim) {
      const gv = m.glyph[i], g = gv & 0x7fff, d = GLYPHS[g];
      const x = i % W, y = (i / W) | 0;
      const px = x * TS - ox, py = (y + 1) * TS - d.h - oy;
      if (px < -d.w || py < -d.h || px > v.SW || py > v.SH) continue;
      const fr = Math.floor(t * d.anim + hash2(x, y, 5) * 8) % d.frames.length;
      S.drawImage(spr(g, fr, gv & FLIP), px, py);
      if (d.emit) E.drawImage(spr(g, fr, gv & FLIP, true), px, py);
    }
    for (const i of ck.emit) {
      const gv = m.glyph[i], g = gv & 0x7fff, d = GLYPHS[g];
      const x = i % W, y = (i / W) | 0;
      const px = x * TS - ox, py = (y + 1) * TS - d.h - oy;
      if (px < -d.w || py < -d.h || px > v.SW || py > v.SH) continue;
      E.drawImage(spr(g, 0, gv & FLIP, true), px, py);
    }
  }

  // creatures
  for (const c of m.creatures) {
    const px = Math.round(c.px - ox), py = Math.round(c.py - oy);
    if (px < -8 || py < -8 || px > v.SW || py > v.SH) continue;
    const d = GLYPHS[c.g];
    const fr = c.moving ? Math.floor(c.t * 2) % 2 : (Math.sin(t * 2 + c.ph) > 0.85 ? 1 : 0);
    S.drawImage(spr(c.g, fr, c.flip), px, py);
    if (d.emit) { E.globalAlpha = 0.6; E.drawImage(spr(c.g, fr, c.flip, true), px, py); E.globalAlpha = 1; }
  }
  // co-op friends on this map
  const friends = Coop.here();
  for (const f of friends) {
    const [fg, ff, fflip] = Coop.sprite(f.face, f.moving ? Math.floor(f.animT * 9) % 2 : 0, f.c, f.ch || 0, f);
    const fx = Math.round(f.px - ox), fy = Math.round(f.py - oy);
    if (fx < -8 || fy < -8 || fx > v.SW || fy > v.SH) continue;
    S.drawImage(spr(fg, ff, fflip), fx, fy);
    E.globalAlpha = 0.22; E.drawImage(spr(fg, ff, fflip), fx, fy); E.globalAlpha = 1;
  }
  // player
  const pf0 = p.sprite()[1];
  const [pg, pf, pflip] = Coop.sprite(p.face, pf0, Coop.myColor(), Coop.look.ch, p);
  const ppx = Math.round(p.px - ox), ppy = Math.round(p.py - oy);
  S.drawImage(spr(pg, pf, pflip), ppx, ppy);
  E.globalAlpha = 0.22; E.drawImage(spr(pg, pf, pflip), ppx, ppy); E.globalAlpha = 1;

  drawParticles(S, E, ox, oy, v.SW, v.SH, t);

  // lighting
  let amb, lightK, day = 0;
  if (over) {
    const ds = dayState(game.day);
    day = ds.day;
    amb = ds.amb.map((a) => a * lerp(game.bamb, 1, day * 0.6));
    lightK = 1 - day * 0.7;
    P.emitK = 0.5 + 0.5 * (1 - day);
  } else { amb = m.ambient; lightK = 1; }
  P.amb = amb;
  L.globalCompositeOperation = 'source-over';
  L.fillStyle = `rgb(${amb[0] * 127.5 | 0},${amb[1] * 127.5 | 0},${amb[2] * 127.5 | 0})`;
  L.fillRect(0, 0, v.SW, v.SH);
  L.globalCompositeOperation = 'lighter';
  const drawLight = (x, y, rgb, r, inten) => {
    if (inten <= 0.01) return;
    const sx = x - ox, sy = y - oy;
    if (sx < -r || sy < -r || sx > v.SW + r || sy > v.SH + r) return;
    L.globalAlpha = Math.min(1, inten * 0.5);
    L.drawImage(lightSprite(rgb), sx - r, sy - r, r * 2, r * 2);
    if (inten > 2) { L.globalAlpha = Math.min(1, (inten - 2) * 0.5); L.drawImage(lightSprite(rgb), sx - r, sy - r, r * 2, r * 2); }
  };
  const lcx0 = Math.max(0, cx0 - 1), lcy0 = Math.max(0, cy0 - 1);
  const lcx1 = Math.min(m.cw - 1, cx1 + 1), lcy1 = Math.min(m.chh - 1, cy1 + 1);
  for (let cy = lcy0; cy <= lcy1; cy++) for (let cx = lcx0; cx <= lcx1; cx++) {
    for (const Lt of m.chunks[cy * m.cw + cx].lights) {
      const fl = 1 + (Math.sin(t * 11 + Lt.ph) * 0.5 + Math.sin(t * 6.3 + Lt.ph * 1.7) * 0.35 + Math.sin(t * 23 + Lt.ph) * 0.15) * Lt.f;
      drawLight(Lt.x, Lt.y, Lt.rgb, Lt.r * (0.94 + 0.06 * fl), Lt.i * fl * lightK * 1.6);
      if (Lt.ember && Math.random() < 0.05) spawnParticle('ember', Lt.x + (Math.random() - 0.5) * 3, Lt.y - 2, (Math.random() - 0.5) * 4, -10 - Math.random() * 8, 1 + Math.random() * 0.8);
    }
  }
  // the player carries a soft glow
  drawLight(p.px + 4, p.py + 4, [190, 220, 255], over ? 46 : 52, over ? 0.9 * (1 - day * 0.8) : 1.1);
  for (const f of friends) drawLight(f.px + 4, f.py + 4, [190, 220, 255], over ? 46 : 52, over ? 0.9 * (1 - day * 0.8) : 1.1);
  L.globalAlpha = 1; L.globalCompositeOperation = 'source-over';
}

// --- boot -------------------------------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function boot() {
  const q = new URLSearchParams(location.search);
  const seed = parseInt(q.get('seed') || '1337', 10) >>> 0;
  resize();
  const t0 = performance.now();
  game.world = genOverworld(seed);
  game.map = game.world.map;
  MapView.init(game.world);
  game.player.place(game.world.start.x, game.world.start.y);
  MapView.reveal(game.player.x, game.player.y, 13);
  snapCamera();
  window.__genMs = performance.now() - t0;
  window.game = game;
  CoopUI.init(seed);
  Coop.initArtifactRoom();
  requestAnimationFrame(frame);
}
requestAnimationFrame(() => setTimeout(boot, 30));
