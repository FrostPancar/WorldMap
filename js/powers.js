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
// Specials: the beam plus three you learn from traders. All of them channel:
// hold to charge (time = seconds to full), release to cast. Anything but the
// beam needs at least a third of a charge or it fizzles.
const SPECIALS = {
  beam: { name: 'BEAM', icon: 'icon_beam', time: 1.1 },
  vortex: { name: 'VORTEX', icon: 'icon_vortex', time: 1.5, glow: '#b06aff', core: '#f0e0ff', note: 220 },
  shadow: { name: 'SHADOW STEP', icon: 'icon_shadow', time: 0.9, glow: '#7a5ad8', core: '#e8dcff', note: 165 },
  starfall: { name: 'STARFALL', icon: 'icon_star', time: 1.7, glow: '#ffd84a', core: '#fffbe0', note: 880 },
};
for (const k in SPECIALS) if (SPECIALS[k].glow) SPECIALS[k].rgb = hexToRgb(SPECIALS[k].glow);
function pal(k) { return POWERS[k] || SPECIALS[k] || POWERS.spark; }
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
  vortices: [], meteors: [], trails: [], possess: null,

  color(k, i) {
    const P = pal(k);
    return P.rainbow ? RAINBOW[(i === undefined ? Math.floor(Math.random() * 6) : i) % 6] : P.glow;
  },
  center(e) { return [e.px + 4, e.py + 4]; },

  // --- input ---------------------------------------------------------------------
  canAct() { return game.mode === 'world' && !game.pending && game.map; },
  special() { return Combat.special(); },
  // colour scheme for the charge: the beam wears your absorbed power, specials their own
  chargeKind() { const sp = this.special(); return sp === 'beam' ? this.kind : sp; },
  startCharge(aim) {
    if (!this.canAct() || this.charging) return;
    if (this.possess) { this.endPossess(); return; } // the special button also lets go of a possessed body
    this.charging = true; this.charge = 0; this.aim = aim; this.ringT = 0;
    Sound.chargeStart(pal(this.chargeKind()).note);
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

  // --- casting ---------------------------------------------------------------------
  fire(c) {
    const sp = this.special();
    if (sp !== 'beam') {
      if (c < 0.33) { // not channelled long enough: a puff of sparks and nothing more
        const [x, y] = this.center(game.player);
        for (let n = 0; n < 8; n++) spawnParticle('beamSpark', x, y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.3, this.color(sp));
        Sound.sfx('poke'); return;
      }
      if (sp === 'vortex') this.castVortex(c);
      else if (sp === 'shadow') this.castShadow(c);
      else if (sp === 'starfall') this.castStarfall(c);
      return;
    }
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
    // the beam hurts enemies along its length (a friend's beam is only drawn here)
    if (owner === game.player) for (const cr of m.creatures.slice()) {
      if (!Combat.isEnemy(cr)) continue;
      const cx = cr.px + 4, cy = cr.py + 4;
      const t = clamp(((cx - x0) * ca + (cy - y0) * sa) / d, 0, 1);
      const dx = x0 + ca * d * t - cx, dy = y0 + sa * d * t - cy;
      if (dx * dx + dy * dy > 36 + w * 9) continue;
      Combat.damage(cr, (2 + c * 8) * (owner === game.player ? Combat.power() : 0.5), k, a);
    }
  },

  // where a special will land: toward the cursor (clamped to its reach) or ahead of you
  target(sp, c) {
    const p = game.player, [x0, y0] = this.center(p);
    const reach = (sp === 'vortex' ? 3 + c * 4 : sp === 'starfall' ? 4 + c * 5 : 3 + c * 7) * TS;
    let x, y;
    if (this.aim) {
      const dx = this.aim.x - x0, dy = this.aim.y - y0, d = Math.hypot(dx, dy);
      const k = d > reach ? reach / d : 1;
      x = x0 + dx * k; y = y0 + dy * k;
    } else {
      const [fx, fy] = DIRS[p.face];
      x = x0 + fx * reach * 0.8; y = y0 + fy * reach * 0.8;
    }
    const r = (sp === 'vortex' ? 1.6 + c * 2.6 : 1.2 + c * 1.8) * TS;
    return { x, y, r, reach };
  },
  // VORTEX: a whirlpool that drags enemies in, grinds them, then collapses
  castVortex(c) {
    const T = this.target('vortex', c), life = 1.6 + c * 2.4;
    this.vortices.push({ x: T.x, y: T.y, r: T.r, life, max: life, tick: 0.2, pull: 0, a: 0, dmg: (0.5 + c) * Combat.power() });
    this.rings.push({ x: T.x, y: T.y, r: T.r, vr: -T.r * 2, life: 0.4, max: 0.4, k: 'vortex' });
    this.shake = Math.max(this.shake, 1 + c * 2);
    Sound.sfx('beam', 0.2 + c * 0.3); Sound.sfx('absorb', 220);
  },
  // SHADOW STEP: vanish and reappear inside a creature (not a boss), wearing it
  // as a disguise; ordinary enemies ignore you until you burst out of it, which
  // tears an enemy vessel apart. With nobody in reach it is a plain blink.
  castShadow(c) {
    const m = game.map, p = game.player, [x0, y0] = this.center(p), T = this.target('shadow', c);
    let best = null, bd = Infinity;
    for (const cr of m.creatures) {
      if (cr.dead || cr.pet || cr.npc || cr.boss || cr.netT !== undefined) continue;
      const cx = cr.px + 4, cy = cr.py + 4;
      if (Math.hypot(cx - x0, cy - y0) > T.reach + 4) continue;
      const d = this.aim ? Math.hypot(cx - this.aim.x, cy - this.aim.y) : Math.hypot(cx - x0, cy - y0);
      if (this.aim && d > 3 * TS) continue;
      if (d < bd) { bd = d; best = cr; }
    }
    let tx = p.x, ty = p.y;
    if (best) { tx = best.x; ty = best.y; }
    else {
      // blink along the aim to the furthest open tile
      const dx = T.x - x0, dy = T.y - y0, n = Math.ceil(Math.hypot(dx, dy) / 4);
      for (let k = 1; k <= n; k++) {
        const x = Math.floor((x0 + dx * k / n) / TS), y = Math.floor((y0 + dy * k / n) / TS);
        if (m.blocked(x, y)) break;
        if (!m.entr.has(y * m.w + x)) { tx = x; ty = y; }
      }
    }
    this.trails.push({ x0, y0, x1: tx * TS + 4, y1: ty * TS + 4, life: 0.45, max: 0.45 });
    for (let n = 0; n < 24; n++) spawnParticle('beamSpark', x0, y0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.5, n % 2 ? '#1a1024' : '#9a7ae8');
    p.place(tx, ty);
    for (let n = 0; n < 24; n++) spawnParticle('beamSpark', tx * TS + 4, ty * TS + 4, (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 70, 0.5, n % 2 ? '#1a1024' : '#c8b0ff');
    this.rings.push({ x: tx * TS + 4, y: ty * TS + 4, r: 2, vr: 70, life: 0.4, max: 0.4, k: 'shadow' });
    Sound.sfx('flash'); Sound.sfx('enter');
    if (!best) return;
    m.creatures.splice(m.creatures.indexOf(best), 1);
    best.moving = false;
    const dur = 4 + c * 8;
    this.possess = { c: best, t: dur, max: dur, k: c, map: m, ox: best.x, oy: best.y };
    Combat.say('POSSESSED ' + (Combat.isEnemy(best) ? 'FOE' : 'ANIMAL'), G.icon_shadow);
  },
  endPossess(quiet) {
    const P = this.possess;
    if (!P) return;
    this.possess = null;
    const p = game.player, c = P.c, m = P.map, here = m === game.map;
    const x = here ? p.x : P.ox, y = here ? p.y : P.oy;
    c.x = c.fx = x; c.y = c.fy = y; c.t = 1; c.moving = false; c.px = x * TS; c.py = y * TS; c.wait = 0.8;
    m.creatures.push(c);
    for (let n = 0; n < 26; n++) spawnParticle('beamSpark', c.px + 4, c.py + 4, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 0.5, n % 2 ? '#1a1024' : '#c8b0ff');
    this.rings.push({ x: c.px + 4, y: c.py + 4, r: 2, vr: 90, life: 0.45, max: 0.45, k: 'shadow' });
    if (!here) return;
    if (Combat.isEnemy(c)) Combat.damage(c, (3 + P.k * 9) * Combat.power(), 'void', Math.random() * Math.PI * 2);
    else Combat.poke(c, Math.random() * Math.PI * 2);
    if (!quiet) Sound.sfx('impact', 0.6);
  },
  // STARFALL: mark a spot, and a shower of stars crashes down on it
  castStarfall(c) {
    const T = this.target('starfall', c), n = 3 + Math.round(c * 9), dmg = (1.5 + c * 2.5) * Combat.power();
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = k ? Math.sqrt(Math.random()) * T.r : 0;
      this.meteors.push({ x: T.x + Math.cos(a) * r, y: T.y + Math.sin(a) * r, t: -k * 0.11 - 0.15, fall: 0.45, dmg });
    }
    Sound.sfx('absorb', 880);
  },
  updateSpecials(dt) {
    const m = game.map;
    for (let i = this.vortices.length - 1; i >= 0; i--) {
      const v = this.vortices[i];
      v.life -= dt; v.a += dt * 7; v.tick -= dt; v.pull -= dt;
      for (let n = Math.ceil(dt * 60); n > 0; n--) {
        const a = Math.random() * Math.PI * 2, r = v.r * (0.5 + Math.random() * 0.6);
        spawnParticle('beamSpark', v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, -Math.sin(a) * 70 - Math.cos(a) * 45, Math.cos(a) * 70 - Math.sin(a) * 45, 0.35, Math.random() < 0.5 ? '#b06aff' : '#f0e0ff');
      }
      const inside = [];
      for (const cr of m.creatures) {
        if (!Combat.isEnemy(cr)) continue;
        const d = Math.hypot(cr.px + 4 - v.x, cr.py + 4 - v.y);
        if (d < v.r + (cr.r || 4)) inside.push([cr, d]);
      }
      if (v.pull <= 0) {
        v.pull = 0.22;
        for (const [cr, d] of inside) {
          if (cr.boss || cr.moving || d < 6) continue;
          const dx = v.x - (cr.px + 4), dy = v.y - (cr.py + 4);
          const sx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0, sy = sx ? 0 : Math.sign(dy);
          const nx = cr.x + sx, ny = cr.y + sy;
          if (m.blocked(nx, ny) || m.entr.has(ny * m.w + nx)) continue;
          cr.fx = cr.x; cr.fy = cr.y; cr.x = nx; cr.y = ny; cr.t = 0; cr.moving = true; cr.wait = 0.3;
        }
      }
      if (v.tick <= 0) {
        v.tick = 0.4;
        for (const [cr] of inside) Combat.damage(cr, v.dmg, 'void', Math.atan2(v.y - cr.py - 4, v.x - cr.px - 4));
      }
      if (v.life <= 0) {
        for (const [cr, d] of inside) if (d < v.r * 0.7) Combat.damage(cr, v.dmg * 3, 'void', Math.atan2(cr.py + 4 - v.y, cr.px + 4 - v.x));
        this.rings.push({ x: v.x, y: v.y, r: 2, vr: v.r * 4, life: 0.4, max: 0.4, k: 'vortex' });
        for (let n = 0; n < 30; n++) { const a = Math.random() * Math.PI * 2; spawnParticle('beamSpark', v.x, v.y, Math.cos(a) * 100, Math.sin(a) * 100, 0.5, n % 2 ? '#b06aff' : '#ffffff'); }
        this.shake = Math.max(this.shake, 2.5); Sound.sfx('impact', 0.8);
        this.vortices.splice(i, 1);
      }
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const s = this.meteors[i];
      s.t += dt;
      if (s.t < s.fall) continue;
      for (const cr of m.creatures.slice()) {
        if (!Combat.isEnemy(cr)) continue;
        if (Math.hypot(cr.px + 4 - s.x, cr.py + 4 - s.y) < 13 + (cr.r ? cr.r - 6 : 0)) Combat.damage(cr, s.dmg, 'ember', Math.atan2(cr.py + 4 - s.y, cr.px + 4 - s.x));
      }
      this.rings.push({ x: s.x, y: s.y, r: 2, vr: 70, life: 0.3, max: 0.3, k: 'starfall' });
      for (let n = 0; n < 12; n++) { const a = Math.random() * Math.PI * 2; spawnParticle('beamSpark', s.x, s.y, Math.cos(a) * 60, Math.sin(a) * 60 - 20, 0.45, n % 3 ? '#ffd84a' : '#ffffff'); }
      this.shake = Math.max(this.shake, 1.4); Sound.sfx('impact', 0.5);
      this.meteors.splice(i, 1);
    }
    for (let i = this.trails.length - 1; i >= 0; i--) if ((this.trails[i].life -= dt) <= 0) this.trails.splice(i, 1);
    if (this.possess) {
      const P = this.possess;
      P.t -= dt;
      if (Math.random() < dt * 20) spawnParticle('beamSpark', game.player.px + Math.random() * 8, game.player.py + Math.random() * 8, 0, -12, 0.5, '#7a5ad8');
      if (P.t <= 0 || P.map !== game.map) this.endPossess();
    }
  },
  // drawing for specials: vortices, falling stars, shadow trails, aim previews
  renderSpecials(px, L, t) {
    for (const v of this.vortices) {
      const f = Math.min(1, v.life / 0.4, (v.max - v.life) / 0.3 + 0.2);
      for (let arm = 0; arm < 4; arm++) for (let s = 0; s < 24; s++) {
        const rr = v.r * (s / 24), a = v.a + arm * Math.PI / 2 + s * 0.32;
        px(v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr * 0.8, s % 3 ? '#b06aff' : '#f0e0ff', f * (0.4 + 0.6 * s / 24));
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(v.x + dx, v.y + dy, '#1a0a2a', f, 0);
      L.push({ x: v.x, y: v.y, rgb: SPECIALS.vortex.rgb, r: v.r + 16, i: 1.1 * f });
    }
    for (const s of this.meteors) {
      // a blinking mark on the ground, then the star streaking down onto it
      if (s.t > -0.4 && Math.sin(t * 30) > -0.2) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; px(s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 3, '#ffd84a', 0.6); }
      if (s.t <= 0) continue;
      const f = s.t / s.fall, hx = s.x + (1 - f) * 40, hy = s.y - (1 - f) * 140;
      for (let k = 0; k < 10; k++) px(hx + k * 1.2, hy - k * 4, k ? '#ffd84a' : '#ffffff', 1 - k * 0.09);
      L.push({ x: hx, y: hy, rgb: SPECIALS.starfall.rgb, r: 26, i: 1.2 });
    }
    for (const tr of this.trails) {
      const f = tr.life / tr.max, len = Math.hypot(tr.x1 - tr.x0, tr.y1 - tr.y0);
      for (let d = 0; d < len; d += 2) {
        const x = tr.x0 + (tr.x1 - tr.x0) * d / len + (Math.random() - 0.5) * 3, y = tr.y0 + (tr.y1 - tr.y0) * d / len + (Math.random() - 0.5) * 3;
        px(x, y, d % 4 ? '#1a1024' : '#9a7ae8', f, d % 4 ? 0 : f);
      }
    }
    if (this.possess) {
      // a shrinking ring of shadow shows how long the possession lasts
      const p = game.player, f = this.possess.t / this.possess.max, n = Math.max(3, Math.round(24 * f));
      for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k / 24) * Math.PI * 2; px(p.px + 4 + Math.cos(a) * 9, p.py + 4 + Math.sin(a) * 9, '#9a7ae8', 0.8); }
      L.push({ x: p.px + 4, y: p.py + 4, rgb: SPECIALS.shadow.rgb, r: 24, i: 0.6 });
    }
    // while channelling a special, preview where it will land
    const sp = this.special();
    if (this.charging && sp !== 'beam') {
      const c = Math.max(0.33, this.charge), T = this.target(sp, c), col = this.color(sp), ready = this.charge >= 0.33;
      if (sp === 'shadow') {
        const [x0, y0] = this.center(game.player), len = Math.hypot(T.x - x0, T.y - y0);
        for (let d = 6; d < len; d += 4) px(x0 + (T.x - x0) * d / len, y0 + (T.y - y0) * d / len, col, ready ? 0.7 : 0.3);
      }
      const r = sp === 'shadow' ? 6 : T.r, n = Math.max(12, Math.round(r * 1.6));
      for (let k = 0; k < n; k++) {
        if ((k + Math.floor(t * 12)) % 3 === 0) continue;
        const a = (k / n) * Math.PI * 2;
        px(T.x + Math.cos(a) * r, T.y + Math.sin(a) * r * 0.8, col, ready ? 0.8 : 0.35);
      }
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
      this.charge = Math.min(1, this.charge + dt / SPECIALS[this.special()].time);
      Sound.chargeLevel(this.charge);
      this.spawnChargeArcs(p, this.charge, this.chargeKind(), dt);
      if (this.charge >= 1) {
        this.ringT -= dt;
        if (this.ringT <= 0) { this.ringT = 0.3; const [x, y] = this.center(p); this.rings.push({ x, y, r: 4, vr: 30, life: 0.3, max: 0.3, k: this.chargeKind() }); }
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
    this.updateSpecials(dt);
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
      L.push({ x, y, rgb: pal(k).rgb, r: 24 + c * 46, i: 0.4 + c * 1.4 });
    };
    if (this.charging) aura(p, this.charge, this.chargeKind());
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
      L.push({ x: r.x, y: r.y, rgb: pal(r.k).rgb, r: 20 + Math.max(0, r.r), i: f });
    }
    this.renderSpecials(px, L, t);
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
  if (e.code !== 'Space' || e.repeat || game.mode !== 'world' || CoopUI.isOpen() || (e.target && e.target.tagName === 'INPUT')) return;
  e.preventDefault(); Powers.startCharge(null);
});
addEventListener('keyup', (e) => { if (e.code === 'Space') Powers.release(); });
