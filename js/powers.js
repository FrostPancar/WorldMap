'use strict';
// ---------------------------------------------------------------------------
// Powers: glowing orbs you absorb (each gives a differently coloured power),
// a charge-up drawn with arced particles spiralling into the player, and a
// beam fired on click/tap (or Space). The table is meant to grow: give a
// power new fields and read them in fire()/render() for future effects.
// ---------------------------------------------------------------------------

const POWERS = {
  spark: { glow: '#8ad8ff', core: '#ffffff', note: 523 },
  ember: { glow: '#ff6a1a', core: '#fff0c0', note: 392 },
  frost: { glow: '#4ae8f0', core: '#f0ffff', note: 659 },
  void: { glow: '#a86ae8', core: '#f4e8ff', note: 330 },
  bloom: { glow: '#6aff6a', core: '#f0ffd0', note: 587 },
  prism: { glow: '#ff6ad8', core: '#ffffff', note: 784, rainbow: true },
};
for (const k in POWERS) POWERS[k].rgb = hexToRgb(POWERS[k].glow);
const RAINBOW = ['#ff4a4a', '#ffb03a', '#ffe84a', '#5aff6a', '#4ad8ff', '#a86aff'];
const THEME_POWER = {
  scream: 'ember', muertos: 'ember', giza: 'ember', nightcity: 'ember', numbers: 'frost', aquarium: 'frost',
  eyes: 'void', starry: 'void', melting: 'void', rapanui: 'bloom', wave: 'bloom',
  vapor: 'prism', klimt: 'prism', mondrian: 'prism', gallery: 'prism', chess: 'prism',
};

const Powers = {
  kind: (() => { try { const k = localStorage.getItem('worldmap-power'); return POWERS[k] ? k : 'spark'; } catch (e) { return 'spark'; } })(),
  charging: false, charge: 0, aim: null, arcs: [], beams: [], rings: [], lights: [],
  shake: 0, absorbT: 0, seq: 0, lastBeam: null, ringT: 0,

  color(k, i) {
    const P = POWERS[k] || POWERS.spark;
    return P.rainbow ? RAINBOW[(i === undefined ? Math.floor(Math.random() * 6) : i) % 6] : P.glow;
  },
  center(e) { return [e.px + 4, e.py + 4]; },

  // --- input ---------------------------------------------------------------------
  canAct() { return game.mode === 'world' && !game.pending && game.map; },
  startCharge(aim) {
    if (!this.canAct() || this.charging) return;
    this.charging = true; this.charge = 0; this.aim = aim; this.ringT = 0;
    Sound.chargeStart(POWERS[this.kind].note);
  },
  release() {
    if (!this.charging) return;
    this.charging = false;
    Sound.chargeStop();
    if (this.canAct()) this.fire(this.charge);
  },
  aimFromEvent(e) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    return { x: game.camX + (e.clientX * dpr) / game.view.scale, y: game.camY + (e.clientY * dpr) / game.view.scale };
  },

  // --- beam ------------------------------------------------------------------------
  fire(c) {
    const p = game.player, [x0, y0] = this.center(p);
    let a;
    if (this.aim) a = Math.atan2(this.aim.y - y0, this.aim.x - x0);
    else a = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.face];
    if (!p.moving) p.face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
    this.spawnBeam(x0, y0, a, c, this.kind, p);
    this.lastBeam = { s: ++this.seq, a: Math.round(a * 100) / 100, c: Math.round(c * 100) / 100, t: performance.now() };
  },
  remoteBeam(e, bm) {
    if (typeof bm.a !== 'number' || typeof bm.c !== 'number') return;
    const [x0, y0] = this.center(e);
    this.spawnBeam(x0, y0, bm.a, clamp(bm.c, 0, 1), POWERS[e.pk] ? e.pk : 'spark', e);
  },
  spawnBeam(x0, y0, a, c, k, owner) {
    const m = game.map, ca = Math.cos(a), sa = Math.sin(a);
    const range = (7 + c * 15) * TS;
    let d = 5, hit = false;
    for (; d < range; d += 1.5) {
      const tx = Math.floor((x0 + ca * d) / TS), ty = Math.floor((y0 + sa * d) / TS);
      if (!m.inb(tx, ty)) { hit = true; break; }
      const i = ty * m.w + tx;
      if (m.solid[i] && !m.water[i]) { hit = true; break; }
    }
    const x1 = x0 + ca * d, y1 = y0 + sa * d, w = 1 + Math.round(c * 3);
    const life = 0.3 + c * 0.3;
    this.beams.push({ x0, y0, x1, y1, a, w, k, life, max: life, owner });
    this.shake = Math.max(this.shake, 0.6 + c * 2.4);
    Sound.sfx('beam', c);
    // impact
    if (hit) {
      Sound.sfx('impact', c);
      this.rings.push({ x: x1, y: y1, r: 2, vr: 40 + c * 60, life: 0.35, max: 0.35, k });
      for (let n = 0; n < 10 + c * 20; n++) {
        const pa = a + Math.PI + (Math.random() - 0.5) * 2.4, sp = 20 + Math.random() * 60 * (0.5 + c);
        spawnParticle('beamSpark', x1, y1, Math.cos(pa) * sp, Math.sin(pa) * sp, 0.3 + Math.random() * 0.4, this.color(k));
      }
    }
    // the beam hurts enemies along its length
    for (const cr of m.creatures.slice()) {
      if (!Combat.isEnemy(cr)) continue;
      const cx = cr.px + 4, cy = cr.py + 4;
      const t = clamp(((cx - x0) * ca + (cy - y0) * sa) / d, 0, 1);
      const dx = x0 + ca * d * t - cx, dy = y0 + sa * d * t - cy;
      if (dx * dx + dy * dy > 36 + w * 9) continue;
      Combat.damage(cr, (2 + c * 8) * (owner === game.player ? Combat.power() : 0.5), k, a);
    }
  },

  // --- absorbing orbs -----------------------------------------------------------------
  absorb(pk) {
    pk.taken = true;
    this.kind = pk.k;
    try { localStorage.setItem('worldmap-power', pk.k); } catch (e) { /* no storage */ }
    const p = game.player, ox = pk.x * TS + 4, oy = pk.y * TS + 4;
    for (let n = 0; n < 40; n++) {
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 30;
      this.arcs.push({ x0: ox, y0: oy, cx: ox + Math.cos(a) * r, cy: oy + Math.sin(a) * r, t: -n * 0.012, dur: 0.45 + Math.random() * 0.5,
        col: this.color(pk.k, n), tgt: p });
    }
    this.rings.push({ x: ox, y: oy, r: 1, vr: 70, life: 0.45, max: 0.45, k: pk.k });
    this.absorbT = 1.1;
    Sound.sfx('absorb', POWERS[pk.k].note);
  },

  // --- per frame ------------------------------------------------------------------------
  update(dt) {
    const p = game.player, m = game.map;
    if (this.charging) {
      if (!this.canAct()) { this.charging = false; Sound.chargeStop(); }
      this.charge = Math.min(1, this.charge + dt / 1.1);
      Sound.chargeLevel(this.charge);
      this.spawnChargeArcs(p, this.charge, this.kind, dt);
      if (this.charge >= 1) {
        this.ringT -= dt;
        if (this.ringT <= 0) { this.ringT = 0.3; const [x, y] = this.center(p); this.rings.push({ x, y, r: 4, vr: 30, life: 0.3, max: 0.3, k: this.kind }); }
      }
      if (this.aim && !p.moving) {
        const [x0, y0] = this.center(p), a = Math.atan2(this.aim.y - y0, this.aim.x - x0);
        p.face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
      }
    }
    for (const f of Coop.here()) if (f.cg > 0) this.spawnChargeArcs(f, f.cg, POWERS[f.pk] ? f.pk : 'spark', dt);
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.t += dt / a.dur;
      if (a.t >= 1) this.arcs.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) if ((this.beams[i].life -= dt) <= 0) this.beams.splice(i, 1);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.r += r.vr * dt;
      if ((r.life -= dt) <= 0) this.rings.splice(i, 1);
    }
    this.absorbT = Math.max(0, this.absorbT - dt);
    this.shake = Math.max(0, this.shake - dt * 12);
    for (const c of m.creatures) if (c.flash) c.flash = Math.max(0, c.flash - dt);
    if (m.pickups && !game.pending) {
      for (const pk of m.pickups) if (!pk.taken && pk.x === p.x && pk.y === p.y) this.absorb(pk);
    }
  },
  // particles that arc in from a ring around the target along curved paths
  spawnChargeArcs(tgt, c, k, dt) {
    const [x, y] = this.center(tgt);
    let n = (20 + c * 80) * dt;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      n--;
      const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 22 + c * 10;
      const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r;
      const bend = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 14);
      const mx = (sx + x) / 2 - Math.sin(a) * bend, my = (sy + y) / 2 + Math.cos(a) * bend;
      this.arcs.push({ x0: sx, y0: sy, cx: mx, cy: my, t: 0, dur: 0.35 + Math.random() * 0.35, col: this.color(k), tgt });
    }
  },
  shakeOffset() {
    if (this.shake <= 0) return [0, 0];
    return [(Math.random() - 0.5) * this.shake * 2, (Math.random() - 0.5) * this.shake * 2];
  },

  // --- drawing ------------------------------------------------------------------------------
  render(S, E, ox, oy, W, H, t) {
    const L = this.lights; L.length = 0;
    const m = game.map, p = game.player;
    const px = (x, y, col, a, glowA) => {
      x = Math.round(x - ox); y = Math.round(y - oy);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      S.globalAlpha = a; S.fillStyle = col; S.fillRect(x, y, 1, 1);
      E.globalAlpha = glowA === undefined ? a : glowA; E.fillStyle = col; E.fillRect(x, y, 1, 1);
    };
    // orbs waiting to be absorbed
    if (m.pickups) for (const pk of m.pickups) {
      if (pk.taken) continue;
      const cx = pk.x * TS + 4, cy = pk.y * TS + 4 + Math.round(Math.sin(t * 2.5 + pk.x) * 1.5);
      if (cx - ox < -12 || cy - oy < -12 || cx - ox > W + 12 || cy - oy > H + 12) continue;
      const P = POWERS[pk.k], pulse = 0.6 + 0.4 * Math.sin(t * 5 + pk.y);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > 2) continue;
        px(cx + dx, cy + dy, d === 0 ? '#ffffff' : d === 1 ? P.core : this.color(pk.k, dx + dy + 6 + Math.floor(t * 8)), 1, d === 2 ? pulse : 1);
      }
      for (let k = 0; k < 3; k++) {
        const a = t * 2 + k * 2.1;
        px(cx + Math.cos(a) * 5, cy + Math.sin(a) * 3, this.color(pk.k, k), 0.8);
      }
      L.push({ x: cx, y: cy, rgb: P.rgb, r: 26, i: 0.7 + pulse * 0.4 });
    }
    // charging auras (me and co-op friends)
    const aura = (e, c, k) => {
      const [x, y] = this.center(e);
      const rr = 6 + c * 5 + Math.sin(t * 20) * c;
      const n = 10 + Math.round(c * 10);
      for (let i = 0; i < n; i++) {
        const a = t * (3 + c * 6) + (i / n) * Math.PI * 2;
        px(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, this.color(k, i), 0.5 + c * 0.5);
      }
      L.push({ x, y, rgb: POWERS[k].rgb, r: 24 + c * 46, i: 0.4 + c * 1.4 });
    };
    if (this.charging) aura(p, this.charge, this.kind);
    for (const f of Coop.here()) if (f.cg > 0) aura(f, f.cg, POWERS[f.pk] ? f.pk : 'spark');
    if (this.absorbT > 0) {
      const [x, y] = this.center(p);
      L.push({ x, y, rgb: POWERS[this.kind].rgb, r: 30 + this.absorbT * 30, i: this.absorbT * 1.6 });
    }
    // arcs: quadratic curves easing into the target, with a short fading tail
    for (const a of this.arcs) {
      if (a.t <= 0) continue;
      const [ex, ey] = this.center(a.tgt);
      for (let k = 0; k < 3; k++) {
        const tt = a.t - k * 0.07;
        if (tt <= 0) break;
        const e = tt * tt, u = 1 - e;
        const x = u * u * a.x0 + 2 * u * e * a.cx + e * e * ex, y = u * u * a.y0 + 2 * u * e * a.cy + e * e * ey;
        px(x, y, k === 0 ? a.col : a.col, (1 - k * 0.35) * (0.4 + 0.6 * Math.sin(Math.min(1, a.t) * Math.PI)));
      }
    }
    // beams
    for (const b of this.beams) {
      const f = b.life / b.max, P = POWERS[b.k] || POWERS.spark;
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0), ca = (b.x1 - b.x0) / len, sa = (b.y1 - b.y0) / len;
      const w = Math.max(1, Math.round(b.w * Math.sqrt(f)));
      for (let d = 4; d < len; d += 1) {
        const wob = Math.sin(d * 0.45 - t * 50) * 0.5 * b.w * f;
        const x = b.x0 + ca * d - sa * wob, y = b.y0 + sa * d + ca * wob;
        const col = P.rainbow ? RAINBOW[Math.floor(d / 3 + t * 20) % 6] : P.glow;
        for (let o = -w; o <= w; o++) {
          const edge = Math.abs(o) === w;
          px(x - sa * o, y + ca * o, edge ? col : P.core, edge ? 0.55 * f : f);
        }
        if (Math.floor(d) % 22 === 0) L.push({ x, y, rgb: P.rgb, r: 18 + b.w * 7, i: 1.4 * f });
        if (Math.random() < 0.04 * f) spawnParticle('beamSpark', x, y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.3, col);
      }
      L.push({ x: b.x1, y: b.y1, rgb: P.rgb, r: 26 + b.w * 8, i: 1.8 * f });
      L.push({ x: b.x0, y: b.y0, rgb: P.rgb, r: 20 + b.w * 6, i: 1.2 * f });
    }
    // expanding rings
    for (const r of this.rings) {
      const f = r.life / r.max, n = Math.max(8, Math.round(r.r * 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        px(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, this.color(r.k, i), f);
      }
      L.push({ x: r.x, y: r.y, rgb: POWERS[r.k].rgb, r: 20 + r.r, i: f });
    }
    S.globalAlpha = 1; E.globalAlpha = 1;
  },
};

// --- placing orbs -------------------------------------------------------------------------------
function biomePower(b) {
  return ({ [B.VOLCANO]: 'ember', [B.DUNES]: 'ember', [B.SNOW]: 'frost', [B.LAKE]: 'frost', [B.SPOOKY]: 'void', [B.MARSH]: 'void',
    [B.MUSH]: 'bloom', [B.FOREST]: 'bloom', [B.TAIGA]: 'bloom', [B.AUTUMN]: 'bloom', [B.CRYSTAL]: 'prism', [B.PINK]: 'prism' })[b] || 'spark';
}
function seedOverworldOrbs(world, seed) {
  const m = world.map, R = mulberry32(seed ^ 0x2545f491);
  m.pickups = [];
  const near = (x, y) => {
    for (let r = 2; r < 6; r++) for (let t = 0; t < 12; t++) {
      const a = R() * Math.PI * 2, nx = Math.round(x + Math.cos(a) * r), ny = Math.round(y + Math.sin(a) * r), i = ny * m.w + nx;
      if (m.inb(nx, ny) && !m.solid[i] && !m.water[i] && !m.road[i] && !m.entr.has(i)) return [nx, ny];
    }
    return null;
  };
  for (const p of world.pois) {
    if (['shrine', 'stones', 'worldtree', 'volcano', 'temple', 'oasis', 'ribs', 'lighthouse'].indexOf(p.type) < 0 && R() > 0.15) continue;
    const c = near(p.hub.x, p.hub.y);
    if (c) m.pickups.push({ x: c[0], y: c[1], k: biomePower(m.biome[c[1] * m.w + c[0]]) });
  }
}
function seedInteriorOrb(m, theme, seed) {
  const R = mulberry32(seed ^ 0x7f4a7c15);
  m.pickups = [];
  if (R() > 0.6) return;
  const d = bfsFrom(m, m.spawn.x, m.spawn.y);
  let max = 0;
  for (const v of d) if (v > max) max = v;
  const cand = [];
  for (let i = 0; i < d.length; i++) if (d[i] > max * 0.5 && !m.glyph[i] && !m.solid[i] && !m.entr.has(i)) cand.push(i);
  if (!cand.length) return;
  const i = cand[Math.floor(R() * cand.length)];
  m.pickups.push({ x: i % m.w, y: (i / m.w) | 0, k: THEME_POWER[theme] || 'spark' });
}

// --- input bindings -------------------------------------------------------------------------------
addEventListener('pointermove', (e) => { if (Powers.charging && Powers.aim) Powers.aim = Powers.aimFromEvent(e); });
addEventListener('pointerup', () => Powers.release());
addEventListener('pointercancel', () => Powers.release());
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || game.mode !== 'world' || (e.target && e.target.tagName === 'INPUT')) return;
  e.preventDefault(); Powers.startCharge(null);
});
addEventListener('keyup', (e) => { if (e.code === 'Space') Powers.release(); });
