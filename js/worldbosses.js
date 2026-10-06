'use strict';
// ---------------------------------------------------------------------------
// World bosses: five giants, each in a lair out in its own biome. They are
// 4x4 tiles big, plod slowly and fight with telegraphed patterns: bolt rings
// with a gap to slip through, sweeping walls of bolts with an opening, twin
// spirals, ground marks that erupt a moment after they appear, root lines
// that chase toward you, aimed volleys and leaps. They stay near their lair,
// heal up if you run away, and each drops a crystal with a lasting effect.
// Crystal progress is shown in the Escape menu (7 slots).
// ---------------------------------------------------------------------------

// --- a tiny pixel painter for the big sprites -----------------------------------------
// Slots: 1 outline, 2 base, 3 shadow, 4 highlight, 5 glow (emissive), 6 extra.
function painter(w, h) {
  const g = Array.from({ length: h }, () => new Array(w).fill('.'));
  const P = {
    g, eyes: [],
    px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
    rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.px(x, y, c); },
    // filled ellipse, lit from the top left when shaded
    ell(cx, cy, rx, ry, c, shade) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const l = -(nx * 0.7 + ny * 0.8);
        P.px(x, y, !shade ? c : l > 0.55 ? '4' : l < -0.45 ? '3' : c);
      }
    },
    line(x0, y0, x1, y1, c, th) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        P.px(x, y, c);
        if (th > 1) { P.px(x + 1, y, c); P.px(x, y + 1, c); }
      }
    },
    eye(x, y) { P.px(x, y, '6'); P.eyes.push([x, y]); },
  };
  return P;
}
// outline every filled shape, then return the rows
function finishPaint(P) {
  const g = P.g, h = g.length, w = g[0].length, out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== '.') continue;
    const n = (dx, dy) => { const r = g[y + dy]; return r && r[x + dx] && r[x + dx] !== '.'; };
    if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) out[y][x] = '1';
  }
  return out.map((r) => r.join(''));
}
function bigBoss(name, colors, draw, emit) {
  const frames = [], eyes = [];
  for (let f = 0; f < 2; f++) {
    const P = painter(32, 32);
    draw(P, f);
    frames.push(finishPaint(P));
    if (!f) eyes.push(...P.eyes);
  }
  defGlyph(name, frames, colors, { emit, tags: 'center' });
  addRedEyes(name, eyes);
}

// Each is a giant of an enemy you already meet, in its colours and with the
// same glowing red eyes: a spider, a slime, a ghost, a dragon and a trash bag.

// Mother Spider: eight legs, a fat abdomen with a red hourglass, a cluster of eyes
bigBoss('w_spider', ['#102010', '#a8d63a', '#6ea02a', '#d8f070', '#ff5a50', '#801010'], (P, f) => {
  const s = f ? 1 : -1;
  for (let k = 0; k < 4; k++) {
    const y = 15 + k * 3, sw = (k % 2 ? s : -s);
    P.line(11, y, 4, y - 5 + sw, '3', 2); P.line(4, y - 5 + sw, 1, y + 6 + sw, '3', 2);   // left legs: up to the knee, down to the foot
    P.line(20, y, 27, y - 5 - sw, '3', 2); P.line(27, y - 5 - sw, 30, y + 6 - sw, '3', 2);
  }
  P.ell(16, 11, 9, 8, '2', 1);                                                         // abdomen
  P.rect(15, 6, 16, 7, '5'); P.rect(14, 8, 17, 8, '5'); P.rect(15, 9, 16, 12, '5'); P.rect(14, 13, 17, 14, '5'); // hourglass
  P.ell(16, 22, 6.5, 5, '2', 1);                                                       // head
  P.line(13, 26, 12, 29, '4', 2); P.line(18, 26, 19, 29, '4', 2);                       // fangs
  P.eye(13, 21); P.eye(15, 20); P.eye(17, 20); P.eye(19, 21); P.eye(14, 23); P.eye(18, 23);
}, [5]);

// King Slime: a wobbling cyan dome with bubbles inside and a gold crown
bigBoss('w_slime', ['#103030', '#4ae8e0', '#2aa8a0', '#c8fff8', '#f0c040', '#801010'], (P, f) => {
  const rx = f ? 15 : 14, ry = f ? 10 : 11, top = 30 - ry * 2;
  P.ell(16, 30 - ry + 1, rx, ry, '2', 1); P.rect(16 - rx + 2, 27, 16 + rx - 2, 30, '2');
  for (const [x, y] of [[8, 24], [22, 26], [12, 27], [24, 21], [9, 20]]) { P.px(x, y + (f ? 1 : 0), '4'); P.px(x + 1, y + (f ? 1 : 0), '4'); }
  P.line(12, 25, 20, 25, '1');                                                         // grin
  const cy = top + 1;
  P.rect(11, cy - 2, 21, cy, '5'); for (const x of [11, 14, 16, 18, 21]) P.px(x, cy - 3, '5'); P.px(16, cy - 1, '4');
  P.eye(11, 19 + (f ? 1 : 0)); P.eye(12, 19 + (f ? 1 : 0)); P.eye(20, 19 + (f ? 1 : 0)); P.eye(21, 19 + (f ? 1 : 0));
}, [5]);

// Ghost Lord: a towering sheet ghost with grasping arms, a howling mouth and wisps
bigBoss('w_ghost', ['#202040', '#e8f0ff', '#a8b8e0', '#ffffff', '#7af0ff', '#801010'], (P, f) => {
  const s = f ? 1 : 0;
  P.ell(16, 12, 10, 10, '2', 1); P.rect(6, 12, 26, 25, '2');
  for (let x = 6; x <= 26; x++) { const h = ((x + s * 2) % 4 < 2) ? 28 : 26; P.rect(x, 25, x, h, x < 10 ? '3' : '2'); } // ragged hem
  P.rect(22, 13, 26, 25, '3');
  P.ell(3, 15 + s, 3, 2, '2', 1); P.line(5, 15 + s, 8, 17, '2', 2); P.ell(29, 14 - s, 3, 2, '2', 1); P.line(24, 17, 27, 14 - s, '2', 2); // arms
  P.ell(16, 17, 3, 3.5, '1');                                                           // howling mouth
  for (const [x, y] of [[2, 6], [29, 5], [1, 24], [30, 22], [16, 0]]) P.px(x, y + (s ? -1 : 0), '5');
  P.eye(12, 10); P.eye(13, 10); P.eye(19, 10); P.eye(20, 10);
}, [5]);

// Elder Dragon: the cyan dragon grown huge, wings spread, horns back, fire in its jaws
bigBoss('w_dragon', ['#102030', '#4ae8e0', '#2a9aa8', '#c8fff8', '#ff7a2a', '#801010'], (P, f) => {
  const s = f ? 3 : 0;
  for (let k = 0; k < 5; k++) P.line(13, 15, 2 + k * 3, 1 + s + Math.abs(k - 2), '3');  // wing membrane
  P.line(13, 15, 2, 1 + s + 2, '2', 2); P.line(2, 3 + s, 14, 3 + s, '2');               // wing bones
  P.line(10, 22, 1, 28, '2', 2); P.line(1, 28, 0, 25, '2');                             // tail
  P.ell(14, 20, 9, 6, '2', 1); P.ell(15, 22, 6, 3, '4');                                // body and belly
  P.rect(9, 25, 11, 30, '3'); P.rect(17, 25, 19, 30, '3');
  P.line(19, 17, 23, 10, '2', 2);                                                       // neck
  P.ell(25, 8, 5, 4, '2', 1); P.rect(28, 9, 31, 11, '2');                               // head, snout
  P.line(22, 5, 19, 1, '4'); P.line(24, 4, 22, 0, '4');                                 // horns
  P.rect(29, 12, 31, 12, '5'); P.px(31, 13, '5');                                       // fire in the jaws
  P.eye(26, 7); P.eye(27, 7);
}, [5]);

// Garbage Titan: a bulging bin bag, tied with yellow, junk poking out, a jagged grin
bigBoss('w_trash', ['#0e0e14', '#3a3a4a', '#24242e', '#5a5a6a', '#f0c030', '#801010'], (P, f) => {
  const s = f ? 1 : 0;
  P.ell(16, 20 + s, 13, 10 - s, '2', 1);
  P.ell(16, 8, 4, 3, '2', 1); P.line(12, 6, 9, 2 + s, '2', 2); P.line(20, 6, 23, 2 + s, '2', 2); // knot and flaps
  P.rect(13, 10, 19, 10, '5');                                                          // tie
  P.line(4, 14, 1, 11, '4', 2); P.px(1, 10, '5');                                       // a broom handle
  P.rect(25, 13, 27, 16, '5'); P.px(26, 12, '3');                                       // a crushed can
  P.line(8, 23 + s, 24, 23 + s, '1');
  for (let x = 9; x < 24; x += 3) P.px(x, 22 + s, '4');                                  // jagged teeth
  P.px(7, 28, '3'); P.px(24, 27, '3'); P.px(20, 15, '4');
  P.eye(11, 17 + s); P.eye(12, 17 + s); P.eye(20, 17 + s); P.eye(21, 17 + s);
}, [5]);

// --- crystals ------------------------------------------------------------------------
const CRYSTALS = [
  { name: 'GRAVE CRYSTAL', col: '#7aff6a', hi: '#e0ffd8' },
  { name: 'PRISM CRYSTAL', col: '#c08aff', hi: '#f4e8ff' },
  { name: 'FROST CRYSTAL', col: '#4ae8f0', hi: '#e8ffff' },
  { name: 'EMBER CRYSTAL', col: '#ff7a2a', hi: '#ffe0a0' },
  { name: 'CHROME CRYSTAL', col: '#f0c040', hi: '#fff4c0' },
];
const CRYSTAL_SLOTS = 7;
CRYSTALS.forEach((c, i) => {
  c.g = defGlyph('crystal_' + i, ['...1....', '..121...', '.12321..', '.12321..', '.12321..', '..121...', '...1....', '........'],
    [c.col, c.hi, '#ffffff'], { emit: true });
  c.rgb = hexToRgb(c.col);
});

// --- the five --------------------------------------------------------------------------
const WORLD_BOSSES = [
  { g: 'w_spider', name: 'MOTHER SPIDER', hp: 230, dmg: 2, spd: 1.1, col: '#ff5a50', summon: 'c_spider', biomes: [B.SPOOKY, B.FOREST, B.AUTUMN],
    moves: ['roots', 'summon', 'volley', 'roots', 'gapRing'], ring: 'deadTreeDark', light: 'torchGreen' },
  { g: 'w_slime', name: 'KING SLIME', hp: 240, dmg: 2, spd: 0.9, col: '#4ae8e0', summon: 'c_slime', biomes: [B.MUSH, B.MARSH, B.PINK],
    moves: ['leap', 'lob', 'gapRing', 'leap', 'summon'], ring: 'mushSmall', light: 'glowShroom' },
  { g: 'w_ghost', name: 'GHOST LORD', hp: 220, dmg: 2, spd: 0.8, col: '#7af0ff', summon: 'c_ghost', biomes: [B.SNOW, B.CRYSTAL, B.TAIGA],
    moves: ['spiral', 'wall', 'gapRing', 'rain', 'summon'], ring: 'grave', light: 'lanternBlue' },
  { g: 'w_dragon', name: 'ELDER DRAGON', hp: 260, dmg: 2, spd: 1.0, col: '#ff7a2a', summon: 'c_dragon', biomes: [B.VOLCANO, B.MOUNT, B.DUNES],
    moves: ['rain', 'volley', 'gapRing', 'rain', 'spiral'], ring: 'peakBasalt', light: 'brazier' },
  { g: 'w_trash', name: 'GARBAGE TITAN', hp: 250, dmg: 2, spd: 1.0, col: '#f0c030', summon: 'c_trash', biomes: [B.PLAINS, B.GRASS],
    moves: ['lob', 'wall', 'summon', 'rain', 'gapRing'], ring: 'rock', light: 'lantern' },
];
WORLD_BOSSES.forEach((b, i) => {
  b.i = i; b.world = true;
  ENEMY_DEF[b.g] = { hp: b.hp, dmg: b.dmg, beh: 'boss' };
  SHOTS['wb' + i] = { spd: 68, dmg: 1, cd: 0, range: 20, col: b.col };
  SHOTS['wl' + i] = { lob: true, dmg: 2, cd: 0, range: 12, col: b.col };
});

// Each lair is a themed building out in the boss's biome. Inside are two
// dreamlike floors of that biome (see LAIR_THEMES in js/dreams.js), then the
// boss's hall.
const LAIR_GATE_COLS = [
  ['#2a3a30', '#14201a', '#05080a', '#ff5a50'], ['#5a7a2a', '#3a2a4a', '#05080a', '#4ae8e0'], ['#8ccaf0', '#5a94c0', '#0a1420', '#7af0ff'],
  ['#4a3434', '#2a1a1a', '#0a0404', '#ff7a1a'], ['#3a3a4a', '#24242e', '#05050a', '#f0c030'],
];
LAIR_GATE_COLS.forEach((cols, k) => {
  defGlyph('lairGate' + k, rowsFrom(16, 16, (x, y) => {
    if (y < 4) return ((x === 3 || x === 12) && y >= 2) || ((x === 7 || x === 8) && y >= 0) ? '1' : '';
    if (x < 1 || x > 14) return '';
    if ((y >= 9 && x >= 5 && x <= 10) || (y === 8 && x >= 6 && x <= 9)) return '3';  // the dark doorway
    if ((y === 5 || y === 6) && (x === 7 || x === 8)) return '4';                     // a glowing sigil
    if (x === 1 || x === 14 || y === 4) return '2';
    return (y % 3 === 0 && (x + y) % 4 === 0) ? '2' : '1';
  }), cols, { emit: [4], light: { c: cols[3], r: 40, i: 0.9, f: 0.2, ox: 8, oy: -2 } });
});
function genLairArena(seed, ent) {
  const k = ent.poi.lair, B = WORLD_BOSSES[k], T = LAIR_THEMES[k][1];
  const { m, cx, cy, R } = arenaRoom(seed, { floor: T.floor.slice(0, 3), wallBg: T.wallBg, wall: T.wall[0], torch: B.light, amb: T.amb }, 52, 42);
  if (!Combat.worldDown.has(k)) {
    const c = makeCreature(B.g, cx, cy - 4, -1, R);
    c.boss = B; c.r = 15; c.home = { x: cx, y: cy - 4 }; c.aggro = 60; c.atkCd = 2.5; c.mi = 0; c.wait = 1;
    m.creatures.push(c);
  }
  m.dream = { name: 'lair', parts: T.parts, fx: T.fx, light: 1.1 };
  m.finalize();
  return m;
}

const WorldBosses = {
  marks: [], drops: [],
  AGGRO: 15, // tiles from the lair within which the boss fights you

  // --- per boss (only where we run the enemies) ----------------------------------------
  tick(c, dt) {
    const B = c.boss, cx = c.px + 4, cy = c.py + 4, p = game.player;
    const near = Math.abs(p.x - c.home.x) + Math.abs(p.y - c.home.y) <= (c.aggro || this.AGGRO) + 4;
    // the queue runs the steps of a pattern already started
    if (c.q && c.q.length) {
      for (const s of c.q) s.t -= dt;
      while (c.q.length && c.q[0].t <= 0) c.q.shift().f();
    }
    if (!near) {
      // you left: it wanders home and slowly heals
      c.hp = Math.min(c.maxhp, c.hp + c.maxhp * 0.05 * dt); c.enraged = false; c.q = [];
      return;
    }
    const enraged = c.hp < c.maxhp * 0.5;
    if (enraged && !c.enraged) { c.enraged = true; Powers.rings.push({ x: cx, y: cy, r: 6, vr: 140, life: 0.7, max: 0.7, k: 'ember' }); Powers.shake = 3; }
    if (c.q && c.q.length) return;
    c.atkCd -= dt * (enraged ? 1.35 : 1);
    if (c.atkCd > 0) return;
    c.atkCd = 2.4 + Math.random() * 0.6;
    this.act(c, B.moves[c.mi++ % B.moves.length], enraged);
  },
  later(c, t, f) { c.q = c.q || []; c.q.push({ t, f }); c.q.sort((a, b) => a.t - b.t); },
  bolt(c, a, fast) {
    const cx = c.px + 4, cy = c.py + 4;
    Combat.enemyShot(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a) * 200, cy + Math.sin(a) * 200, 'wb' + c.boss.i, true);
  },
  aimAt(c) { const p = game.player; return Math.atan2(p.py + 4 - c.py - 4, p.px + 4 - c.px - 4); },
  act(c, move, enraged) {
    const B = c.boss, m = game.map, p = game.player;
    switch (move) {
      case 'gapRing': {
        // rings of slow bolts, each with an opening to slip through; the opening drifts
        let gap = this.aimAt(c) + (Math.random() - 0.5) * 1.2;
        const waves = enraged ? 4 : 3, n = 30;
        for (let w = 0; w < waves; w++) this.later(c, w * 0.7, () => {
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            let d = Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap)));
            if (d < 0.42) continue;
            this.bolt(c, a);
          }
          gap += (Math.random() < 0.5 ? -1 : 1) * 0.5;
        });
        break;
      }
      case 'spiral': {
        // two (three when enraged) arms turning slowly
        const arms = enraged ? 3 : 2, a0 = Math.random() * 6;
        for (let k = 0; k < 28; k++) this.later(c, k * 0.09, () => {
          for (let j = 0; j < arms; j++) this.bolt(c, a0 + k * 0.24 + j * Math.PI * 2 / arms);
        });
        break;
      }
      case 'wall': {
        // a broad wall of bolts sweeps toward you with one opening
        for (let w = 0; w < (enraged ? 4 : 3); w++) this.later(c, w * 0.85, () => {
          const a = this.aimAt(c), cx = c.px + 4, cy = c.py + 4, nx = -Math.sin(a), ny = Math.cos(a);
          const gap = Math.floor(Math.random() * 13) - 6;
          for (let k = -9; k <= 9; k++) {
            if (Math.abs(k - gap) <= 1) continue;
            const sx = cx + nx * k * 6, sy = cy + ny * k * 6;
            Combat.enemyShot(sx, sy, sx + Math.cos(a) * 200, sy + Math.sin(a) * 200, 'wb' + B.i, true);
          }
        });
        break;
      }
      case 'rain': {
        // ground marks: one on you, the rest scattered; they erupt a moment later
        const n = enraged ? 9 : 6;
        for (let k = 0; k < n; k++) this.later(c, k * 0.12, () => {
          const r = k ? 12 + Math.random() * 40 : 0, a = Math.random() * Math.PI * 2;
          this.mark(p.px + 4 + Math.cos(a) * r, p.py + 4 + Math.sin(a) * r, 13, 1.05, B);
        });
        break;
      }
      case 'roots': {
        // eruptions racing along the ground toward you (and to the sides when enraged)
        const a = this.aimAt(c), spread = enraged ? [-0.45, 0, 0.45] : [0];
        for (const da of spread) for (let k = 1; k <= 14; k++) this.later(c, k * 0.08, () => {
          this.mark(c.px + 4 + Math.cos(a + da) * k * 11, c.py + 4 + Math.sin(a + da) * k * 11, 8, 0.55, B);
        });
        break;
      }
      case 'volley': {
        // aimed fans that lead your movement a little
        for (let w = 0; w < 3; w++) this.later(c, w * 0.5, () => {
          const lead = p.moving ? 14 : 0, [fx, fy] = DIRS[p.face];
          const a = Math.atan2(p.py + 4 + fy * lead - c.py - 4, p.px + 4 + fx * lead - c.px - 4), n = enraged ? 7 : 5;
          for (let k = 0; k < n; k++) Combat.enemyShot(c.px + 4, c.py + 4, c.px + 4 + Math.cos(a + (k - (n - 1) / 2) * 0.22) * 200,
            c.py + 4 + Math.sin(a + (k - (n - 1) / 2) * 0.22) * 200, 'wb' + B.i, true);
        });
        break;
      }
      case 'leap': {
        // marks where you stand, then lands there with a shockwave ring
        const tx = p.x, ty = p.y;
        this.mark(tx * TS + 4, ty * TS + 4, 24, 1.2, B);
        c.flash = 1.2;
        this.later(c, 1.2, () => {
          if (!m.blocked(tx, ty)) { c.x = c.fx = tx; c.y = c.fy = ty; c.t = 1; c.moving = false; c.px = tx * TS; c.py = ty * TS; }
          Powers.shake = Math.max(Powers.shake, 4);
          for (let k = 0; k < (enraged ? 20 : 14); k++) this.bolt(c, (k / (enraged ? 20 : 14)) * Math.PI * 2);
        });
        break;
      }
      case 'lob': {
        for (let k = 0; k < (enraged ? 10 : 7); k++) this.later(c, k * 0.1, () => {
          Combat.enemyShot(c.px + 4, c.py + 4, p.px + 4 + (Math.random() - 0.5) * 60, p.py + 4 + (Math.random() - 0.5) * 60, 'wl' + B.i, true);
        });
        break;
      }
      case 'summon': {
        const minions = m.creatures.filter((q) => q.minion && !q.dead).length;
        for (let k = 0; k < (enraged ? 3 : 2) && minions + k < 5; k++) {
          for (let t = 0; t < 12; t++) {
            const x = c.x + Math.round((Math.random() - 0.5) * 8), y = c.y + Math.round((Math.random() - 0.5) * 8);
            if (m.blocked(x, y) || m.entr.has(y * m.w + x)) continue;
            const q = makeCreature(B.summon, x, y, -1, Math.random);
            q.id = m.nextId = (m.nextId || 100000) + 1; q.minion = true;
            m.creatures.push(q);
            for (let n = 0; n < 8; n++) spawnParticle('beamSpark', x * TS + 4, y * TS + 4, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, 0.4, B.col);
            break;
          }
        }
        break;
      }
    }
  },
  mark(x, y, r, t, B) { this.marks.push({ x, y, r, t, max: t, dmg: B.dmg, col: B.col, rgb: hexToRgb(B.col), map: game.map }); },

  // --- every frame: marks erupt, crystals wait to be picked up --------------------------
  update(dt) {
    const p = game.player, px = p.px + 4, py = p.py + 4;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const k = this.marks[i];
      if (k.map !== game.map) { this.marks.splice(i, 1); continue; }
      if ((k.t -= dt) > 0) continue;
      if (Math.hypot(px - k.x, py - k.y) < k.r) Combat.hurt(k.dmg);
      for (let n = 0; n < 12; n++) { const a = Math.random() * Math.PI * 2; spawnParticle('beamSpark', k.x, k.y, Math.cos(a) * 50, Math.sin(a) * 50 - 25, 0.45, n % 3 ? k.col : '#ffffff'); }
      Powers.rings.push({ x: k.x, y: k.y, r: 2, vr: k.r * 3, life: 0.3, max: 0.3, k: 'ember' });
      Powers.shake = Math.max(Powers.shake, 1.2);
      Sound.sfx('impact', 0.3);
      this.marks.splice(i, 1);
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.map !== game.map || d.t < 1.2) continue;
      // after a moment the crystal floats over to you, wherever you are
      const dx = px - d.x, dy = py - d.y, dd = Math.hypot(dx, dy), sp = Math.min(dd, (60 + d.t * 60) * dt);
      if (dd < 6) { this.drops.splice(i, 1); this.gain(d.k); continue; }
      d.x += dx / dd * sp; d.y += dy / dd * sp;
    }
  },
  gain(k) {
    const C = CRYSTALS[k];
    if (Combat.crystals.indexOf(k) < 0) Combat.crystals.push(k);
    Combat.hp = Combat.maxHp(); Combat.showHearts();
    Combat.say('', C.g);
    const p = game.player;
    Powers.rings.push({ x: p.px + 4, y: p.py + 4, r: 2, vr: 110, life: 0.8, max: 0.8, k: 'prism' });
    for (let n = 0; n < 40; n++) { const a = Math.random() * Math.PI * 2; spawnParticle('beamSpark', p.px + 4, p.py + 4, Math.cos(a) * 80, Math.sin(a) * 80, 0.7, n % 2 ? C.col : '#ffffff'); }
    Sound.sfx('absorb', 523); Sound.sfx('levelup');
    Combat.save();
  },
  defeated(c) {
    const B = c.boss, m = game.map;
    Combat.worldDown.add(B.i);
    for (const q of m.creatures) if (q.minion && !q.dead) Combat.kill(q);
    this.marks.length = 0;
    this.drops.push({ x: c.px + 4, y: c.py + 4, k: B.i, map: m, t: 0 });
    m.items = m.items || [];
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !m.blocked(c.x + dx, c.y + dy));
    if (spot) m.items.push({ x: c.x + spot[0], y: c.y + spot[1], id: pickItem([], Math.random()), pop: 0.8 });
    Powers.rings.push({ x: c.px + 4, y: c.py + 4, r: 6, vr: 160, life: 1, max: 1, k: 'prism' });
    Powers.shake = Math.max(Powers.shake, 5);
    Sound.sfx('levelup');
    Combat.save();
  },

  render(S, E, ox, oy, W, H, t, L) {
    const dot = (x, y, col, a) => {
      x = Math.round(x - ox); y = Math.round(y - oy);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      S.globalAlpha = a; S.fillStyle = col; S.fillRect(x, y, 1, 1);
      E.globalAlpha = a; E.fillStyle = col; E.fillRect(x, y, 1, 1);
    };
    for (const k of this.marks) {
      if (k.map !== game.map) continue;
      // a ring that fills in as the eruption nears
      const f = 1 - k.t / k.max, n = Math.max(12, Math.round(k.r * 2.2));
      for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; dot(k.x + Math.cos(a) * k.r, k.y + Math.sin(a) * k.r * 0.8, k.col, 0.5 + f * 0.5); }
      const ir = k.r * f;
      for (let j = 0; j < n; j += 2) { const a = (j / n) * Math.PI * 2 + t * 4; dot(k.x + Math.cos(a) * ir, k.y + Math.sin(a) * ir * 0.8, '#ffffff', 0.6); }
      L.push({ x: k.x, y: k.y, rgb: k.rgb, r: k.r + 8, i: 0.4 + f * 0.8 });
    }
    for (const d of this.drops) {
      if (d.map !== game.map) continue;
      const C = CRYSTALS[d.k], x = Math.round(d.x - 4 - ox), y = Math.round(d.y - 10 - oy + Math.sin(t * 2.5) * 2);
      S.globalAlpha = 1; E.globalAlpha = 1;
      S.drawImage(spr(C.g, 0, false), x, y); E.drawImage(spr(C.g, 0, false), x, y);
      L.push({ x: d.x, y: d.y - 4, rgb: C.rgb, r: 40, i: 1.2 + Math.sin(t * 4) * 0.3 });
      if (Math.random() < 0.3) spawnParticle('beamSpark', d.x + (Math.random() - 0.5) * 8, d.y - 2, 0, -15, 0.6, C.col);
    }
    S.globalAlpha = 1; E.globalAlpha = 1;
  },
};
