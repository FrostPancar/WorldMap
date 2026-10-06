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
// Specials: the beam plus five you learn from traders. All of them channel:
// hold to charge (time = seconds to full), release to cast. Anything but the
// beam needs at least a third of a charge or it fizzles. Drain is different:
// it works the whole time you hold it and does nothing on release.
// (Drain keeps the save id 'vortex' from when it was a vortex.)
const SPECIALS = {
  beam: { name: 'BEAM', icon: 'icon_beam', time: 1.1 },
  vortex: { name: 'DRAIN', icon: 'icon_drain', time: 1.0, glow: '#ff4a6a', core: '#ffd0d8', note: 196, channel: true },
  firework: { name: 'FIREWORKS', icon: 'icon_firework', time: 1.4, glow: '#ff9a3a', core: '#fff0c0', note: 698 },
  wings: { name: 'WINGS', icon: 'icon_wings', time: 1.0, glow: '#e8f4ff', core: '#ffffff', note: 587 },
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
  meteors: [], trails: [], possess: null, rockets: [], flight: null, drainT: 0,

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
    if (!this.canAct() || this.charging || this.flight) return;
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
    if (SPECIALS[sp].channel) return; // drain only works while held
    if (sp !== 'beam') {
      if (c < 0.33) { // not channelled long enough: a puff of sparks and nothing more
        const [x, y] = this.center(game.player);
        for (let n = 0; n < 8; n++) spawnParticle('beamSpark', x, y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.3, this.color(sp));
        Sound.sfx('poke'); return;
      }
      if (sp === 'firework') this.castFireworks(c);
      else if (sp === 'wings') this.castWings(c);
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
  // the beam ricochets off walls: one bounce, up to three on a full charge
  spawnBeam(x0, y0, a, c, k, owner) {
    const m = game.map;
    let range = (7 + c * 15) * TS, bounces = 1 + Math.round(c * 2);
    const w = 1 + Math.round(c * 3), life = 0.3 + c * 0.3;
    this.shake = Math.max(this.shake, 0.6 + c * 2.4);
    Sound.sfx('beam', c);
    const hitSet = new Set();
    for (let seg = 0; seg <= bounces && range > 8; seg++) {
      const ca = Math.cos(a), sa = Math.sin(a);
      let d = seg ? 1 : 5, hit = false, flipX = false;
      for (; d < range; d += 1.5) {
        const tx = Math.floor((x0 + ca * d) / TS), ty = Math.floor((y0 + sa * d) / TS);
        const blocked = !m.inb(tx, ty) || (m.solid[ty * m.w + tx] && !m.water[ty * m.w + tx]);
        if (!blocked) continue;
        hit = true;
        // which face did it strike? the tile we stepped in from tells us
        const px = Math.floor((x0 + ca * (d - 1.5)) / TS);
        flipX = px !== tx;
        d -= 1.5;
        break;
      }
      const x1 = x0 + ca * d, y1 = y0 + sa * d;
      this.beams.push({ x0, y0, x1, y1, a, w, k, life, max: life, owner });
      if (owner === game.player) for (const cr of m.creatures.slice()) {
        if (!Combat.isEnemy(cr) || hitSet.has(cr)) continue;
        const cx = cr.px + 4, cy = cr.py + 4;
        const t = clamp(((cx - x0) * ca + (cy - y0) * sa) / d, 0, 1);
        const dx = x0 + ca * d * t - cx, dy = y0 + sa * d * t - cy, rr = 6 + (cr.r ? cr.r - 6 : 0) + w;
        if (dx * dx + dy * dy > rr * rr) continue;
        hitSet.add(cr);
        Combat.damage(cr, (2 + c * 8) * Combat.power() * (seg ? 0.75 : 1), k, a);
      }
      if (!hit) break;
      Sound.sfx('impact', c * (seg ? 0.5 : 1));
      this.rings.push({ x: x1, y: y1, r: 2, vr: 40 + c * 60, life: 0.35, max: 0.35, k });
      for (let n = 0; n < 8 + c * 14; n++) {
        const pa = a + Math.PI + (Math.random() - 0.5) * 2.4, sp = 20 + Math.random() * 60 * (0.5 + c);
        spawnParticle('beamSpark', x1, y1, Math.cos(pa) * sp, Math.sin(pa) * sp, 0.3 + Math.random() * 0.4, this.color(k));
      }
      range -= d; x0 = x1; y0 = y1;
      a = flipX ? Math.PI - a : -a;
    }
  },

  // where a special will land: toward the cursor (clamped to its reach) or ahead of you
  target(sp, c) {
    const p = game.player, [x0, y0] = this.center(p);
    const reach = (sp === 'firework' ? 5 + c * 5 : sp === 'wings' ? 3 + c * 5 : sp === 'starfall' ? 4 + c * 5 : 3 + c * 7) * TS;
    let x, y;
    if (this.aim) {
      const dx = this.aim.x - x0, dy = this.aim.y - y0, d = Math.hypot(dx, dy);
      const k = d > reach ? reach / d : 1;
      x = x0 + dx * k; y = y0 + dy * k;
    } else {
      const [fx, fy] = DIRS[p.face];
      x = x0 + fx * reach * 0.8; y = y0 + fy * reach * 0.8;
    }
    const r = (1.2 + c * 1.8) * TS;
    return { x, y, r, reach };
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
    Combat.say('', G.icon_shadow);
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
  // DRAIN: while held, slowly pulls life out of every enemy close by and into you
  drain(dt) {
    const p = game.player, [x0, y0] = this.center(p), R = 5 * TS;
    this.drainT -= dt;
    const near = game.map.creatures.filter((cr) => Combat.isEnemy(cr) && Math.hypot(cr.px + 4 - x0, cr.py + 4 - y0) < R + (cr.r || 0));
    for (const cr of near) if (Math.random() < dt * 25) {
      // a thread of red motes drifting from the enemy into you
      const sx = cr.px + 4 + (Math.random() - 0.5) * 6, sy = cr.py + 4 + (Math.random() - 0.5) * 6;
      this.arcs.push({ x0: sx, y0: sy, cx: (sx + x0) / 2 + (Math.random() - 0.5) * 20, cy: (sy + y0) / 2 + (Math.random() - 0.5) * 20, t: 0, dur: 0.5, col: Math.random() < 0.5 ? '#ff4a6a' : '#ffd0d8', tgt: p });
    }
    if (this.drainT > 0) return;
    this.drainT = 0.45;
    let got = 0;
    for (const cr of near) { const before = cr.hp; Combat.damage(cr, 0.5 * Combat.power(), 'void', Math.atan2(y0 - cr.py - 4, x0 - cr.px - 4)); got += Math.max(0, before - Math.max(0, cr.hp)); }
    if (got > 0) {
      this.drained = (this.drained || 0) + Math.min(got, 1) * 0.45; // slow: at most ~1 HP a second, however many are near
      if (this.drained >= 1 && Combat.hp < Combat.maxHp()) { const h = Math.floor(this.drained); this.drained -= h; Combat.hp = Math.min(Combat.maxHp(), Combat.hp + h); Combat.showHearts(); Sound.sfx('heart'); }
    }
  },
  // FIREWORKS: a fan of rockets that weave as they fly and burst at the end of their range
  castFireworks(c) {
    const p = game.player, [x0, y0] = this.center(p), T = this.target('firework', c);
    const a0 = Math.atan2(T.y - y0, T.x - x0), n = 4 + Math.round(c * 6), dmg = (1.5 + c * 2) * Combat.power();
    for (let k = 0; k < n; k++) {
      const a = a0 + (Math.random() - 0.5) * 0.7, dist = T.reach * (0.65 + Math.random() * 0.35);
      this.rockets.push({ x: x0, y: y0, a, sp: 130 + Math.random() * 40, curl: (Math.random() - 0.5) * 3.2, wob: Math.random() * 6, left: dist, t: -k * 0.05, dmg,
        col: RAINBOW[Math.floor(Math.random() * RAINBOW.length)] });
    }
    Sound.sfx('shot', 'wand'); this.shake = Math.max(this.shake, 1);
  },
  burst(x, y, col, dmg) {
    for (const cr of game.map.creatures.slice()) {
      if (!Combat.isEnemy(cr)) continue;
      if (Math.hypot(cr.px + 4 - x, cr.py + 4 - y) < 16 + (cr.r ? cr.r - 6 : 0)) Combat.damage(cr, dmg, 'ember', Math.atan2(cr.py + 4 - y, cr.px + 4 - x));
    }
    for (let n = 0; n < 22; n++) { const a = (n / 22) * Math.PI * 2; spawnParticle('beamSpark', x, y, Math.cos(a) * 70, Math.sin(a) * 70, 0.6, n % 3 ? col : '#ffffff'); }
    this.rings.push({ x, y, r: 2, vr: 60, life: 0.3, max: 0.3, k: 'firework' });
    this.shake = Math.max(this.shake, 1); Sound.sfx('impact', 0.35);
  },
  // WINGS: dash to a spot, then fly for two seconds over anything, steering
  // with the arrow keys; enemies you touch are carried up and slammed down
  castWings(c) {
    const p = game.player, [x0, y0] = this.center(p), T = this.target('wings', c);
    this.flight = { phase: 'dash', t: 0, dash: 0.22, x0: p.px, y0: p.py, x1: T.x - 4, y1: T.y - 4, fly: 2, a: Math.atan2(T.y - y0, T.x - x0), carried: [], k: c, h: 0 };
    p.moving = false;
    for (let n = 0; n < 16; n++) spawnParticle('beamSpark', x0, y0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.4, '#e8f4ff');
    Sound.sfx('beam', 0.3);
  },
  // runs instead of the normal step-by-step walk while you are in the air
  updateFlight(dt, dir) {
    const F = this.flight, p = game.player, m = game.map;
    F.t += dt;
    if (F.phase === 'dash') {
      const f = Math.min(1, F.t / F.dash), e = 1 - (1 - f) * (1 - f);
      p.px = lerp(F.x0, F.x1, e); p.py = lerp(F.y0, F.y1, e); F.h = e * 7;
      if (f >= 1) { F.phase = 'fly'; F.t = 0; }
    } else if (F.phase === 'fly') {
      const [dx, dy] = dir ? DIRS[dir] : [Math.cos(F.a) * 0.35, Math.sin(F.a) * 0.35];
      if (dir) F.a = Math.atan2(dy, dx);
      p.px = clamp(p.px + dx * 70 * dt, 0, (m.w - 1) * TS); p.py = clamp(p.py + dy * 70 * dt, 0, (m.h - 1) * TS);
      if (dir) p.face = dir;
      F.h = 7 + Math.sin(F.t * 9) * 1.5;
      if (F.t >= F.fly) {
        // only land on open ground; otherwise glide on to the nearest spot that is
        const tx = Math.round(p.px / TS), ty = Math.round(p.py / TS);
        const ok = (x, y) => m.inb(x, y) && !m.blocked(x, y) && !m.water[y * m.w + x] && !m.entr.has(y * m.w + x);
        if (ok(tx, ty)) { F.phase = 'land'; F.t = 0; F.lx = tx; F.ly = ty; F.sx = p.px; F.sy = p.py; }
        else {
          let best = null;
          for (let r = 1; r < 20 && !best; r++) for (let j = -r; j <= r && !best; j++) for (let i = -r; i <= r; i++) {
            if (Math.max(Math.abs(i), Math.abs(j)) !== r || !ok(tx + i, ty + j)) continue;
            best = [tx + i, ty + j]; break;
          }
          if (best) { F.phase = 'land'; F.t = 0; F.lx = best[0]; F.ly = best[1]; F.sx = p.px; F.sy = p.py; F.glide = 0.35; }
          else F.fly += 0.5;
        }
      }
    } else if (F.phase === 'land') {
      const f = Math.min(1, F.t / (F.glide || 0.18));
      p.px = lerp(F.sx, F.lx * TS, f); p.py = lerp(F.sy, F.ly * TS, f); F.h = 7 * (1 - f);
      if (f >= 1) { this.land(); return; }
    }
    p.x = p.tx = p.fx = clamp(Math.round(p.px / TS), 0, m.w - 1); p.y = p.ty = p.fy = clamp(Math.round(p.py / TS), 0, m.h - 1);
    // scoop up enemies on the way (not bosses), and carry them along
    for (const cr of m.creatures) {
      if (cr.carried || cr.boss || !Combat.isEnemy(cr) || Math.hypot(cr.px - p.px, cr.py - p.py) > 9) continue;
      cr.carried = true; cr.moving = false; F.carried.push(cr);
      for (let n = 0; n < 8; n++) spawnParticle('beamSpark', cr.px + 4, cr.py + 4, (Math.random() - 0.5) * 50, -Math.random() * 50, 0.4, '#ffffff');
    }
    F.carried.forEach((cr, k) => { cr.px = p.px + (k % 2 ? 4 : -4); cr.py = p.py + 3; cr.lift = F.h + 2; });
    if (Math.random() < dt * 30) spawnParticle('beamSpark', p.px + 4 + (Math.random() - 0.5) * 10, p.py + 6, 0, 10, 0.4, '#e8f4ff');
  },
  land() {
    const F = this.flight, p = game.player, m = game.map;
    this.flight = null;
    p.place(F.lx, F.ly);
    const x = p.px + 4, y = p.py + 4;
    this.rings.push({ x, y, r: 2, vr: 90, life: 0.35, max: 0.35, k: 'wings' });
    for (let n = 0; n < 16; n++) spawnParticle('step', x + (Math.random() - 0.5) * 8, y + 3, (Math.random() - 0.5) * 50, -Math.random() * 20, 0.5);
    // carried enemies are slammed into the ground beside you
    F.carried.forEach((cr, k) => {
      cr.carried = false; cr.lift = 0;
      let cx = F.lx, cy = F.ly;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].slice(k % 6).concat([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
        if (!m.blocked(F.lx + dx, F.ly + dy) && !m.entr.has((F.ly + dy) * m.w + F.lx + dx)) { cx = F.lx + dx; cy = F.ly + dy; break; }
      }
      cr.x = cr.fx = cx; cr.y = cr.fy = cy; cr.t = 1; cr.moving = false; cr.px = cx * TS; cr.py = cy * TS; cr.wait = 0.8;
      Combat.damage(cr, (3 + F.k * 6) * Combat.power(), 'spark', Math.random() * Math.PI * 2);
    });
    if (F.carried.length) {
      this.shake = Math.max(this.shake, 4); Sound.sfx('impact', 1);
      this.rings.push({ x, y, r: 4, vr: 160, life: 0.4, max: 0.4, k: 'wings' });
      for (const cr of m.creatures.slice()) if (Combat.isEnemy(cr) && Math.hypot(cr.px + 4 - x, cr.py + 4 - y) < 22) Combat.damage(cr, 1.5 * Combat.power(), 'spark', Math.atan2(cr.py + 4 - y, cr.px + 4 - x));
    } else { this.shake = Math.max(this.shake, 1.5); Sound.sfx('impact', 0.4); }
  },
  updateSpecials(dt) {
    const m = game.map;
    if (this.charging && SPECIALS[this.special()].channel) this.drain(dt);
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.t += dt;
      if (r.t < 0) continue;
      // each rocket curls one way and wobbles, so the volley spreads out unpredictably
      r.a += (r.curl + Math.sin(r.t * 9 + r.wob) * 2.5) * dt;
      const step = r.sp * dt, nx = r.x + Math.cos(r.a) * step, ny = r.y + Math.sin(r.a) * step;
      const tx = Math.floor(nx / TS), ty = Math.floor(ny / TS);
      r.left -= step;
      const wall = !m.inb(tx, ty) || (m.solid[ty * m.w + tx] && !m.water[ty * m.w + tx]);
      const touch = m.creatures.some((cr) => Combat.isEnemy(cr) && Math.hypot(cr.px + 4 - nx, cr.py + 4 - ny) < 5 + (cr.r ? cr.r - 6 : 0));
      if (wall || touch || r.left <= 0) { this.burst(wall ? r.x : nx, wall ? r.y : ny, r.col, r.dmg); this.rockets.splice(i, 1); continue; }
      r.x = nx; r.y = ny;
      if (Math.random() < 0.6) spawnParticle('beamSpark', r.x, r.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.35, Math.random() < 0.5 ? r.col : '#fff0c0');
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
  // drawing for specials: rockets, wings, falling stars, shadow trails, aim previews
  renderSpecials(px, L, t) {
    for (const r of this.rockets) {
      if (r.t < 0) continue;
      px(r.x, r.y, '#ffffff', 1); px(r.x - Math.cos(r.a) * 1.5, r.y - Math.sin(r.a) * 1.5, r.col, 1);
      L.push({ x: r.x, y: r.y, rgb: hexToRgb(r.col), r: 14, i: 0.8 });
    }
    if (this.flight) {
      // a shadow on the ground and a pair of beating wings
      const F = this.flight, p = game.player, gx = p.px + 4, gy = p.py + 8, wy = p.py + 4 - F.h;
      for (let i = -3; i <= 3; i++) px(gx + i, gy, '#000000', 0.45, 0);
      const flap = Math.sin(t * 22) * 2.5, side = (s) => {
        for (let k = 0; k < 7; k++) {
          const wx = gx + s * (3 + k), top = wy - 2 - Math.round(flap * (k / 6)) - Math.round(k * 0.5);
          for (let j = 0; j < Math.max(1, 4 - (k >> 1)); j++) px(wx, top + j, j ? '#c8d8f0' : '#ffffff', 0.95);
        }
      };
      side(-1); side(1);
      L.push({ x: gx, y: wy, rgb: [232, 244, 255], r: 30, i: 0.9 });
    }
    if (this.charging && SPECIALS[this.special()].channel) {
      // the reach of the drain, a slow ring of red
      const [x, y] = this.center(game.player), n = 40;
      for (let k = 0; k < n; k++) { if ((k + Math.floor(t * 8)) % 4 === 0) continue; const a = (k / n) * Math.PI * 2; px(x + Math.cos(a) * 5 * TS, y + Math.sin(a) * 5 * TS * 0.8, '#ff4a6a', 0.45); }
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
    if (this.charging && sp !== 'beam' && !SPECIALS[sp].channel) {
      const c = Math.max(0.33, this.charge), T = this.target(sp, c), col = this.color(sp), ready = this.charge >= 0.33;
      if (sp === 'shadow' || sp === 'wings') {
        const [x0, y0] = this.center(game.player), len = Math.hypot(T.x - x0, T.y - y0);
        for (let d = 6; d < len; d += 4) px(x0 + (T.x - x0) * d / len, y0 + (T.y - y0) * d / len, col, ready ? 0.7 : 0.3);
      }
      const r = sp === 'shadow' || sp === 'wings' ? 6 : T.r, n = Math.max(12, Math.round(r * 1.6));
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
  if (R() > 0.6 && theme !== 'trophy') return; // trophy rooms always hold one
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
