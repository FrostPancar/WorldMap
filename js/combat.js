'use strict';
// ---------------------------------------------------------------------------
// Combat: equippable weapons (click to attack), enemies with HP that chase
// and drop XP gems, friendly animals that you befriend by bumping into them
// (they follow you and auto-attack enemies), chests and pedestals that hold
// items, levels, and a small pixel HUD.
// ---------------------------------------------------------------------------

// --- element effects -----------------------------------------------------------
// ember burns over time, frost slows, void pierces, bloom splits on impact,
// prism bounces to another enemy, spark is plain but quick.
const ELEMENTS = {
  spark: { col: '#bfe8ff', core: '#ffffff' }, ember: { col: '#ff7a2a', core: '#fff0c0' },
  frost: { col: '#5ae8f0', core: '#f0ffff' }, void: { col: '#a86ae8', core: '#f4e8ff' },
  bloom: { col: '#6aff6a', core: '#f0ffd0' }, prism: { col: '#ff6ad8', core: '#ffffff' },
};
for (const k in ELEMENTS) ELEMENTS[k].rgb = hexToRgb(ELEMENTS[k].col);

// --- item icons --------------------------------------------------------------------
const ICONS = {
  sling: ['.1...1..', '.1...1..', '..1.1...', '...1....', '...2....', '...2....', '...2....', '........'],
  sword: ['.......1', '......1.', '.....1..', '....1...', '.2.1....', '..2.....', '.3.2....', '3.......'],
  bow: ['...11...', '..1..2..', '.1...2..', '.1...2..', '.1...2..', '.1...2..', '..1..2..', '...11...'],
  gun: ['........', '.1111111', '.1111...', '..21....', '..2.....', '.22.....', '........', '........'],
  shotgun: ['........', '11111111', '111111..', '.22.....', '.2......', '.2......', '........', '........'],
  wand: ['.....1..', '....111.', '.....1..', '....2...', '...2....', '..2.....', '.2......', '2.......'],
  watch: ['...1....', '..111...', '.1...1..', '1..2..1.', '1..22.1.', '1.....1.', '.1...1..', '..111...'],
  hammer: ['.111111.', '.111111.', '.111111.', '...2....', '...2....', '...2....', '...2....', '...2....'],
  rod: ['......11', '.....1.1', '....2...', '...2....', '..2.....', '.2......', '2.......', '........'],
};
const ITEMS = {
  sling: { name: 'PEBBLE SLING', kind: 'sling', el: 'spark', dmg: 1, cd: 0.28, icon: 'sling', cols: ['#c8a060', '#8a5a2a'], tags: [] },
  emberSling: { name: 'CINDER SLING', kind: 'sling', el: 'ember', dmg: 1.5, cd: 0.3, icon: 'sling', cols: ['#ff7a2a', '#5a2a14'], tags: ['volcano', 'scream', 'giza', 'cave'] },
  frostBow: { name: 'GLACIER BOW', kind: 'bow', el: 'frost', dmg: 2, cd: 0.4, icon: 'bow', cols: ['#5ae8f0', '#f0ffff'], tags: ['icecave', 'snow', 'aquarium', 'numbers'] },
  longbow: { name: 'YEW LONGBOW', kind: 'bow', el: 'spark', dmg: 2, cd: 0.38, icon: 'bow', cols: ['#8a5a2a', '#e8e0c8'], tags: ['castle', 'forest', 'dungeon', 'cave'] },
  voidBow: { name: 'HOLLOW BOW', kind: 'bow', el: 'void', dmg: 2, cd: 0.42, icon: 'bow', cols: ['#a86ae8', '#f4e8ff'], tags: ['crypt', 'eyes', 'spooky'] },
  lanternBow: { name: 'LANTERN BOW', kind: 'bow', el: 'ember', dmg: 2, cd: 0.4, icon: 'bow', cols: ['#e8302a', '#ffd080'], tags: ['wave', 'nightcity'] },
  rustySword: { name: 'RUSTY SWORD', kind: 'sword', el: 'spark', dmg: 3, cd: 0.35, reach: 15, icon: 'sword', cols: ['#a8a0a0', '#c8a040', '#5a3a1a'], tags: ['cave', 'mine', 'dungeon', 'ruins'] },
  flameBlade: { name: 'FLAME BLADE', kind: 'sword', el: 'ember', dmg: 3, cd: 0.35, reach: 16, icon: 'sword', cols: ['#ff8a2a', '#ffd040', '#5a1a0a'], tags: ['volcano', 'firetemple', 'muertos'] },
  glacierEdge: { name: 'GLACIER EDGE', kind: 'sword', el: 'frost', dmg: 3, cd: 0.38, reach: 16, icon: 'sword', cols: ['#bff4ff', '#5ae8f0', '#2a4a6a'], tags: ['icecave', 'snow'] },
  petalSaber: { name: 'PETAL SABER', kind: 'sword', el: 'bloom', dmg: 2.5, cd: 0.3, reach: 15, icon: 'sword', cols: ['#ffb8d0', '#6aff6a', '#3a6a3a'], tags: ['hollow', 'worldtree', 'mush', 'pink'] },
  neonKatana: { name: 'NEON KATANA', kind: 'sword', el: 'prism', dmg: 3, cd: 0.25, reach: 17, icon: 'sword', cols: ['#ff4ad8', '#4ae8f0', '#1a0a2a'], tags: ['nightcity', 'vapor'] },
  moaiHammer: { name: 'MOAI HAMMER', kind: 'sword', el: 'spark', dmg: 6, cd: 0.7, reach: 20, icon: 'hammer', cols: ['#6a6a72', '#8a5a2a'], tags: ['rapanui', 'stones', 'ribs'] },
  flintlock: { name: 'FLINTLOCK', kind: 'gun', el: 'spark', dmg: 2, cd: 0.32, icon: 'gun', cols: ['#5a5a66', '#8a5a2a'], tags: ['wreck', 'lighthouse', 'castle'] },
  prismBlaster: { name: 'PRISM BLASTER', kind: 'gun', el: 'prism', dmg: 1.5, cd: 0.18, icon: 'gun', cols: ['#ff6ad8', '#4ae8f0'], tags: ['vapor', 'klimt', 'crystal', 'gallery'] },
  calaveraBlunder: { name: 'CALAVERA BLUNDERBUSS', kind: 'gun', el: 'ember', dmg: 1.2, cd: 0.55, spread: 5, icon: 'shotgun', cols: ['#f2eee0', '#ff4a8a'], tags: ['muertos'] },
  bowlerBurst: { name: 'BOWLER BURST', kind: 'gun', el: 'void', dmg: 1, cd: 0.5, spread: 3, icon: 'shotgun', cols: ['#1a1a24', '#6ac83a'], tags: ['melting'] },
  starryWand: { name: 'STARRY WAND', kind: 'wand', el: 'void', dmg: 2, cd: 0.45, icon: 'wand', cols: ['#f0d84a', '#1a2a6a'], tags: ['starry', 'tower'] },
  koiRod: { name: 'KOI ROD', kind: 'wand', el: 'bloom', dmg: 2, cd: 0.45, icon: 'rod', cols: ['#ff7a2a', '#8a5a2a'], tags: ['wave', 'aquarium', 'lake'] },
  eyeStaff: { name: 'STAFF OF EYES', kind: 'wand', el: 'void', dmg: 2.5, cd: 0.5, icon: 'wand', cols: ['#f2eee8', '#7a2a3a'], tags: ['eyes', 'witch'] },
  meltWatch: { name: 'MELTING WATCH', kind: 'watch', el: 'void', dmg: 2, cd: 0.6, icon: 'watch', cols: ['#c8a040', '#2a2a2a'], tags: ['melting', 'numbers', 'gallery'] },
  goldWatch: { name: 'GILDED DISC', kind: 'watch', el: 'prism', dmg: 2, cd: 0.55, icon: 'watch', cols: ['#d8a830', '#f0e090'], tags: ['klimt', 'giza', 'temple'] },
  mondrianGun: { name: 'DE STIJL REPEATER', kind: 'gun', el: 'prism', dmg: 1, cd: 0.12, icon: 'gun', cols: ['#d8302a', '#2a4ab8'], tags: ['mondrian', 'chess'] },
};
for (const id in ITEMS) {
  const it = ITEMS[id];
  defGlyph('item_' + id, ICONS[it.icon], it.cols, { emit: true });
}
defGlyph('pedestal', ['........', '........', '.111111.', '..1111..', '..1221..', '..1221..', '.111111.', '11111111'], [P.stone, P.stoneD]);
defGlyph('chestOpen', ['11111111', '1......1', '........', '22222222', '11133111', '11111111', '11111111', '........'], [P.gold, P.goldD, P.white]);
defGlyph('icon_beam', ['........', '1.......', '.1......', '..111111', '.1......', '1.......', '........', '........'], ['#9ad8ff'], { emit: true });

// --- tiny pixel font for the HUD ---------------------------------------------------------
const FONT = {
  A: '.1.1.11111.11.1', B: '11.1.111.1.111.', C: '.111..1..1...11', D: '11.1.11.11.111.', E: '1111..11.1..111', F: '1111..11.1..1..',
  G: '.111..1.11.1.11', H: '1.11.11111.11.1', I: '111.1..1..1.111', J: '..1..1..11.1.1.', K: '1.11.111.1.11.1', L: '1..1..1..1..111',
  M: '1.11111111.11.1', N: '11.1.11.11.11.1', O: '.1.1.11.11.1.1.', P: '11.1.111.1..1..', Q: '.1.1.11.111..11', R: '11.1.111.1.11.1',
  S: '.111...1...111.', T: '111.1..1..1..1.', U: '1.11.11.11.1111', V: '1.11.11.11.1.1.', W: '1.11.11111111.1', X: '1.11.1.1.1.11.1',
  Y: '1.11.1.1..1..1.', Z: '111..1.1.1..111', '0': '1111.11.11.1111', '1': '.1.11..1..1.111', '2': '111..1111..1111',
  '3': '111..1.11..1111', '4': '1.11.1111..1..1', '5': '1111..111..1111', '6': '1111..1111.1111', '7': '111..1.1..1..1.',
  '8': '1111.11111.1111', '9': '1111.1111..1111', '-': '......111......', '+': '....1.111.1....', ' ': '...............',
};
function drawText(ctx, str, x, y, col) {
  ctx.fillStyle = col;
  for (const ch of str) {
    const g = FONT[ch] || FONT[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') ctx.fillRect(x + i, y + j, 1, 1);
    x += 4;
  }
}

// --- creature roles ---------------------------------------------------------------------
const ENEMY_HP = { c_spider: 3, c_bat: 2, c_ghost: 4, c_slime: 3, c_eyeball: 3, c_shadow: 5, c_tvhead: 4, c_knight: 6, c_knightW: 6, c_dragon: 8 };
function baseName(c) { return GLYPHS[c.g].name; }

const Combat = {
  projectiles: [], slashes: [], gems: [], numbers: [], cd: 0, toast: null, hurtT: 0,
  inv: ['sling'], eq: 0, xp: 0, ability: 0,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('worldmap-combat'));
      if (s && Array.isArray(s.inv)) {
        this.inv = s.inv.filter((id) => ITEMS[id]);
        if (!this.inv.length) this.inv = ['sling'];
        this.eq = clamp(s.eq | 0, 0, this.inv.length - 1); this.xp = Math.max(0, +s.xp || 0);
      }
    } catch (e) { /* fresh start */ }
  },
  save() { try { localStorage.setItem('worldmap-combat', JSON.stringify({ inv: this.inv, eq: this.eq, xp: this.xp })); } catch (e) { /* no storage */ } },
  item() { return ITEMS[this.inv[this.eq]] || ITEMS.sling; },
  level() { return Math.floor(Math.sqrt(this.xp / 6)) + 1; },
  levelXp(l) { return (l - 1) * (l - 1) * 6; },
  power() { return 1 + (this.level() - 1) * 0.12; },
  say(text) { this.toast = { text, life: 2.2 }; },

  ensure(c) {
    if (c.hp !== undefined) return;
    const n = baseName(c);
    c.enemy = !!ENEMY_HP[n];
    const depth = (game.ret && game.ret.depth) || 0;
    c.maxhp = c.hp = c.enemy ? Math.round(ENEMY_HP[n] * (1 + depth * 0.5)) : 0;
    c.cd = Math.random() * 1.5;
  },
  isEnemy(c) { this.ensure(c); return c.enemy && !c.dead; },

  // --- the player's attack ------------------------------------------------------------------
  nearestEnemy(x, y, range) {
    let best = null, bd = range * range;
    for (const c of game.map.creatures) {
      if (!this.isEnemy(c)) continue;
      const dx = c.px + 4 - x, dy = c.py + 4 - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },
  attack(aim) {
    if (game.mode !== 'world' || game.pending || this.cd > 0) return;
    const it = this.item(), p = game.player, x0 = p.px + 4, y0 = p.py + 4;
    if (!aim) {
      const e = this.nearestEnemy(x0, y0, 90);
      aim = e ? { x: e.px + 4, y: e.py + 4 } : null;
    }
    const a = aim ? Math.atan2(aim.y - y0, aim.x - x0) : { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.face];
    if (!p.moving) p.face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
    this.cd = it.cd;
    this.fire(it, x0, y0, a, aim, 'player');
  },
  fire(it, x0, y0, a, aim, owner) {
    const dmg = it.dmg * (owner === 'player' ? this.power() : 0.6), el = it.el, ca = Math.cos(a), sa = Math.sin(a);
    const base = { el, dmg, owner, hit: new Set(), bounce: el === 'prism' ? 2 : 0, pierce: el === 'void' };
    Sound.sfx('shot', it.kind);
    switch (it.kind) {
      case 'sling': {
        const dist = aim ? clamp(Math.hypot(aim.x - x0, aim.y - y0), 16, 80) : 56;
        this.projectiles.push(Object.assign({}, base, { type: 'arc', x0, y0, x1: x0 + ca * dist, y1: y0 + sa * dist, t: 0, dur: 0.18 + dist / 260, h: 5 + dist * 0.14, x: x0, y: y0 }));
        break;
      }
      case 'bow':
        this.projectiles.push(Object.assign({}, base, { type: 'arrow', x: x0, y: y0, vx: ca * 260, vy: sa * 260, life: 0.55 })); break;
      case 'gun': {
        const n = it.spread || 1;
        for (let k = 0; k < n; k++) {
          const aa = a + (n > 1 ? (k - (n - 1) / 2) * 0.16 : 0);
          this.projectiles.push(Object.assign({}, base, { hit: new Set(), type: 'bullet', x: x0, y: y0, vx: Math.cos(aa) * 340, vy: Math.sin(aa) * 340, life: n > 1 ? 0.22 : 0.35 }));
        }
        for (let k = 0; k < 4; k++) spawnParticle('beamSpark', x0 + ca * 5, y0 + sa * 5, ca * 40 + (Math.random() - 0.5) * 30, sa * 40 + (Math.random() - 0.5) * 30, 0.15, ELEMENTS[el].core);
        break;
      }
      case 'sword': {
        this.slashes.push({ x: x0, y: y0, a, reach: it.reach || 15, life: 0.18, max: 0.18, el, owner });
        for (const c of game.map.creatures) {
          if (!this.isEnemy(c)) continue;
          const dx = c.px + 4 - x0, dy = c.py + 4 - y0, d = Math.hypot(dx, dy);
          let da = Math.atan2(dy, dx) - a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (d < (it.reach || 15) + 4 && Math.abs(da) < 1.25) this.damage(c, dmg, el, a);
        }
        break;
      }
      case 'wand':
        this.projectiles.push(Object.assign({}, base, { type: 'orb', x: x0, y: y0, vx: ca * 110, vy: sa * 110, life: 2.2, home: true })); break;
      case 'watch':
        this.projectiles.push(Object.assign({}, base, { type: 'boom', x: x0, y: y0, vx: ca * 200, vy: sa * 200, life: 1.6, out: 0.4, pierce: true })); break;
    }
  },

  // --- damage, death, XP ---------------------------------------------------------------------
  damage(c, dmg, el, a) {
    if (!this.isEnemy(c)) return;
    c.hp -= dmg; c.flash = 0.35;
    this.numbers.push({ x: c.px + 4, y: c.py - 2, v: Math.max(1, Math.round(dmg)), life: 0.7, col: ELEMENTS[el].col });
    if (el === 'ember') c.burn = 2.5;
    if (el === 'frost') c.slow = 3;
    const m = game.map, sx = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.sign(Math.cos(a)) : 0, sy = sx ? 0 : Math.sign(Math.sin(a));
    if (!c.moving && !m.blocked(c.x + sx, c.y + sy) && !m.entr.has((c.y + sy) * m.w + c.x + sx)) {
      c.fx = c.x; c.fy = c.y; c.x += sx; c.y += sy; c.t = 0; c.moving = true; c.wait = 0.3;
    }
    for (let n = 0; n < 5; n++) spawnParticle('beamSpark', c.px + 4, c.py + 4, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.35, ELEMENTS[el].col);
    Sound.sfx('hit');
    if (c.hp <= 0) this.kill(c);
  },
  kill(c) {
    c.dead = true;
    const m = game.map, i = m.creatures.indexOf(c);
    if (i >= 0) m.creatures.splice(i, 1);
    const x = c.px + 4, y = c.py + 4;
    for (let n = 0; n < 18; n++) spawnParticle('beamSpark', x, y, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 0.5, n % 2 ? '#ffffff' : '#ff5a50');
    const n = Math.max(1, Math.ceil(c.maxhp / 2));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.gems.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, val: c.maxhp / n, map: m, t: 0 });
    }
    Sound.sfx('kill');
  },
  gainXp(v) {
    const before = this.level();
    this.xp += v;
    if (this.level() > before) {
      this.say('LEVEL ' + this.level());
      const p = game.player;
      Powers.rings.push({ x: p.px + 4, y: p.py + 4, r: 2, vr: 90, life: 0.6, max: 0.6, k: 'prism' });
      Sound.sfx('levelup');
    } else Sound.sfx('gem');
    this.save();
  },

  // --- items in the world -------------------------------------------------------------------
  pickup(id) {
    if (!ITEMS[id]) return;
    let k = this.inv.indexOf(id);
    if (k < 0) { this.inv.push(id); k = this.inv.length - 1; }
    this.eq = k;
    this.say(ITEMS[id].name);
    const p = game.player;
    Powers.rings.push({ x: p.px + 4, y: p.py + 4, r: 2, vr: 70, life: 0.5, max: 0.5, k: ITEMS[id].el });
    Sound.sfx('absorb', 523);
    this.save();
  },
  cycle(dir) {
    if (this.inv.length < 2) { this.say(this.item().name); return; }
    this.eq = (this.eq + dir + this.inv.length) % this.inv.length;
    this.say(this.item().name); Sound.sfx('ui'); this.save();
  },
  cycleAbility() {
    const list = ['BEAM'];
    this.ability = (this.ability + 1) % list.length;
    this.say(list[this.ability]); Sound.sfx('ui');
  },
  // bump into a closed chest to open it: its item pops out next to it
  tryOpen(x, y) {
    const m = game.map, i = y * m.w + x;
    if ((m.glyph[i] & 0x7fff) !== G.chest) return;
    m.glyph[i] = G.chestOpen; m.cache.clear();
    const id = (m.loot && m.loot.get(i)) || pickItem(['cave', 'dungeon'], hash2(x, y, 99));
    const p = game.player;
    m.items = m.items || [];
    m.items.push({ x: p.x, y: p.y, id, pop: 0.5 });
    for (let n = 0; n < 16; n++) spawnParticle('beamSpark', x * TS + 4, y * TS + 4, (Math.random() - 0.5) * 70, -Math.random() * 70, 0.6, n % 2 ? P.gold : '#ffffff');
    Sound.sfx('chest');
  },

  // --- per frame ------------------------------------------------------------------------------
  update(dt) {
    const m = game.map, p = game.player, px = p.px + 4, py = p.py + 4;
    this.cd = Math.max(0, this.cd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.toast && (this.toast.life -= dt) <= 0) this.toast = null;
    // creatures: befriending, pets, enemies
    for (const c of m.creatures.slice()) {
      this.ensure(c);
      const cx = c.px + 4, cy = c.py + 4, d = Math.hypot(cx - px, cy - py);
      if (c.emote > 0) c.emote -= dt;
      if (c.burn > 0) { c.burn -= dt; c.burnT = (c.burnT || 0) - dt; if (c.burnT <= 0) { c.burnT = 0.6; this.damage(c, 0.5, 'ember', 0); } }
      if (c.slow > 0) c.slow -= dt;
      if (c.dead) continue;
      if (!c.enemy) {
        if (!c.pet && d < 7) { c.pet = true; c.emote = 1.6; c.biome = -1; Sound.sfx('heart'); }
        if (c.pet) {
          c.cd -= dt;
          if (Math.random() < dt * 0.15) c.emote = 1;
          if (c.cd <= 0) {
            const e = this.nearestEnemy(cx, cy, 64);
            if (e) {
              c.cd = 1.1;
              const it = this.item();
              this.projectiles.push({ type: 'heart', x: cx, y: cy - 2, vx: 0, vy: 0, life: 2, home: true, el: it.el, dmg: Math.max(1, it.dmg * 0.6) * this.power(),
                owner: 'pet', hit: new Set(), bounce: 0, pierce: false, spd: 140, tgt: e });
              c.emote = 0.5;
            } else c.cd = 0.4;
          }
        }
      } else {
        c.cd -= dt;
        if (d < 11 && c.cd <= 0) {
          c.cd = 1.2; this.hurtT = 0.3; Powers.shake = Math.max(Powers.shake, 1.5); Sound.sfx('hurt');
          for (let n = 0; n < 6; n++) spawnParticle('beamSpark', px, py, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, 0.3, '#ff4a4a');
        }
      }
    }
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (this.stepProjectile(pr, dt, m)) this.projectiles.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) if ((this.slashes[i].life -= dt) <= 0) this.slashes.splice(i, 1);
    for (let i = this.numbers.length - 1; i >= 0; i--) { const n = this.numbers[i]; n.y -= dt * 14; if ((n.life -= dt) <= 0) this.numbers.splice(i, 1); }
    // XP gems drift, then home in on the player
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      if (g.map !== m) { this.gems.splice(i, 1); continue; }
      g.t += dt;
      const dx = px - g.x, dy = py - g.y, d = Math.hypot(dx, dy);
      if (g.t > 0.35 && d < 70) { const s = 220 / Math.max(d, 8); g.vx += dx * s * dt; g.vy += dy * s * dt; }
      g.vx *= 0.9; g.vy *= 0.9; g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 5 && g.t > 0.3) { this.gems.splice(i, 1); this.gainXp(g.val); }
    }
    // items on the ground / pedestals
    if (m.items && !game.pending) {
      for (const it of m.items) {
        if (it.pop > 0) it.pop -= dt;
        if (!it.taken && !(it.pop > 0) && it.x === p.x && it.y === p.y) { it.taken = true; this.pickup(it.id); }
      }
    }
  },
  stepProjectile(pr, dt, m) {
    const el = ELEMENTS[pr.el];
    if (pr.type === 'arc') {
      pr.t += dt / pr.dur;
      const t = Math.min(1, pr.t);
      pr.x = lerp(pr.x0, pr.x1, t); pr.y = lerp(pr.y0, pr.y1, t); pr.z = Math.sin(t * Math.PI) * pr.h;
      if (pr.t >= 1) { this.splash(pr); return true; }
    } else {
      if (pr.home) {
        const e = (pr.tgt && !pr.tgt.dead) ? pr.tgt : this.nearestEnemy(pr.x, pr.y, 80);
        if (e) {
          const a = Math.atan2(e.py + 4 - pr.y, e.px + 4 - pr.x), sp = pr.spd || Math.hypot(pr.vx, pr.vy) || 110;
          pr.vx += (Math.cos(a) * sp - pr.vx) * Math.min(1, dt * 6); pr.vy += (Math.sin(a) * sp - pr.vy) * Math.min(1, dt * 6);
        } else if (pr.type === 'heart') { pr.vy -= 20 * dt; }
      }
      if (pr.type === 'boom') {
        pr.out -= dt;
        if (pr.out <= 0) {
          const p = game.player, a = Math.atan2(p.py + 4 - pr.y, p.px + 4 - pr.x);
          pr.vx += (Math.cos(a) * 220 - pr.vx) * Math.min(1, dt * 5); pr.vy += (Math.sin(a) * 220 - pr.vy) * Math.min(1, dt * 5);
          if (Math.hypot(p.px + 4 - pr.x, p.py + 4 - pr.y) < 6) return true;
          if (pr.out > -0.05 && pr.out <= 0) pr.hit = new Set();
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if ((pr.life -= dt) <= 0) return true;
      const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS), ti = ty * m.w + tx;
      if (pr.type !== 'boom' && pr.type !== 'heart' && (!m.inb(tx, ty) || (m.solid[ti] && !m.water[ti]))) {
        for (let n = 0; n < 4; n++) spawnParticle('beamSpark', pr.x, pr.y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.25, el.col);
        return true;
      }
    }
    // hit enemies (an arcing pellet only hits as it comes down)
    if (pr.type === 'arc' && pr.t < 0.55) return false;
    for (const c of m.creatures) {
      if (!this.isEnemy(c) || pr.hit.has(c)) continue;
      if (Math.hypot(c.px + 4 - pr.x, c.py + 4 - pr.y) > 6) continue;
      pr.hit.add(c);
      this.damage(c, pr.dmg, pr.el, Math.atan2(pr.vy || (pr.y1 - pr.y0), pr.vx || (pr.x1 - pr.x0)));
      if (pr.type === 'arc') { this.splash(pr); return true; }
      if (pr.bounce > 0) {
        pr.bounce--;
        const n = this.nearestEnemyExcept(pr.x, pr.y, 60, pr.hit);
        if (n) { const a = Math.atan2(n.py + 4 - pr.y, n.px + 4 - pr.x), sp = Math.hypot(pr.vx, pr.vy) || 200; pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp; pr.life = 0.6; continue; }
      }
      if (pr.el === 'bloom' && pr.owner === 'player') this.seeds(pr);
      if (!pr.pierce) return true;
    }
    return false;
  },
  nearestEnemyExcept(x, y, range, skip) {
    let best = null, bd = range * range;
    for (const c of game.map.creatures) {
      if (!this.isEnemy(c) || skip.has(c)) continue;
      const d = (c.px + 4 - x) ** 2 + (c.py + 4 - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },
  splash(pr) {
    const el = ELEMENTS[pr.el];
    for (let n = 0; n < 6; n++) spawnParticle('beamSpark', pr.x, pr.y, (Math.random() - 0.5) * 50, -Math.random() * 40, 0.3, el.col);
    if (pr.el === 'bloom') this.seeds(pr);
  },
  seeds(pr) {
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      this.projectiles.push({ type: 'bullet', x: pr.x, y: pr.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.25, el: 'bloom', dmg: pr.dmg * 0.4,
        owner: 'seed', hit: new Set(pr.hit), bounce: 0, pierce: false });
    }
  },

  // --- carrying pets between places -----------------------------------------------------------------
  carryPets(from, to, x, y) {
    if (from === to) return;
    const pets = from.creatures.filter((c) => c.pet && !c.dead).slice(0, 6);
    for (const c of pets) {
      from.creatures.splice(from.creatures.indexOf(c), 1);
      let tx = x, ty = y;
      for (let k = 0; k < 20; k++) {
        const nx = x + Math.round((Math.random() - 0.5) * 4), ny = y + Math.round((Math.random() - 0.5) * 4);
        if (!to.blocked(nx, ny) && !to.entr.has(ny * to.w + nx)) { tx = nx; ty = ny; break; }
      }
      c.x = c.fx = tx; c.y = c.fy = ty; c.t = 1; c.moving = false; c.px = tx * TS; c.py = ty * TS;
      to.creatures.push(c);
    }
  },

  // --- drawing ----------------------------------------------------------------------------------------
  render(S, E, ox, oy, W, H, t, L) {
    const m = game.map;
    const dot = (x, y, col, a) => {
      x = Math.round(x - ox); y = Math.round(y - oy);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      S.globalAlpha = a; S.fillStyle = col; S.fillRect(x, y, 1, 1);
      E.globalAlpha = a; E.fillStyle = col; E.fillRect(x, y, 1, 1);
    };
    // items lying around (on pedestals they float a little higher)
    if (m.items) for (const it of m.items) {
      if (it.taken) continue;
      const g = G['item_' + it.id];
      if (!g) continue;
      const x = Math.round(it.x * TS - ox), y = Math.round(it.y * TS - oy - 5 + Math.sin(t * 2.5 + it.x) * 1.5 - (it.pop > 0 ? it.pop * 16 : 0));
      if (x < -8 || y < -8 || x > W || y > H) continue;
      S.drawImage(spr(g, 0, false), x, y); E.drawImage(spr(g, 0, false), x, y);
      L.push({ x: it.x * TS + 4, y: it.y * TS, rgb: ELEMENTS[ITEMS[it.id].el].rgb, r: 22, i: 0.8 + Math.sin(t * 4) * 0.2 });
    }
    // creature overlays: hearts above pets, health bars on hurt enemies
    for (const c of m.creatures) {
      const x = Math.round(c.px - ox), y = Math.round(c.py - oy) - (GLYPHS[c.g].h - TS);
      if (x < -8 || y < -16 || x > W || y > H) continue;
      if (c.emote > 0) {
        const hy = y - 9 - Math.round((1.6 - Math.min(1.6, c.emote)) * 3);
        S.drawImage(spr(G.heartFill, 0, false), x, hy); E.drawImage(spr(G.heartFill, 0, false), x, hy);
      }
      if (c.enemy && c.hp < c.maxhp) {
        const w = 8, f = Math.max(0, c.hp / c.maxhp);
        S.globalAlpha = 1; S.fillStyle = '#300'; S.fillRect(x, y - 3, w, 1);
        S.fillStyle = '#ff4a4a'; S.fillRect(x, y - 3, Math.ceil(w * f), 1);
        E.fillStyle = '#802020'; E.fillRect(x, y - 3, Math.ceil(w * f), 1);
      }
    }
    // projectiles
    for (const pr of this.projectiles) {
      const el = ELEMENTS[pr.el];
      if (pr.type === 'arc') {
        dot(pr.x, pr.y, '#000000', 0.5);
        const y = pr.y - pr.z;
        dot(pr.x, y, el.core, 1); dot(pr.x + 1, y, el.col, 1); dot(pr.x, y + 1, el.col, 1); dot(pr.x + 1, y + 1, el.col, 0.8);
        L.push({ x: pr.x, y, rgb: el.rgb, r: 14, i: 0.8 });
      } else if (pr.type === 'arrow') {
        const sp = Math.hypot(pr.vx, pr.vy), ux = pr.vx / sp, uy = pr.vy / sp;
        for (let k = 0; k < 5; k++) dot(pr.x - ux * k, pr.y - uy * k, k === 0 ? el.core : el.col, 1 - k * 0.15);
        L.push({ x: pr.x, y: pr.y, rgb: el.rgb, r: 12, i: 0.6 });
      } else if (pr.type === 'bullet') {
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        dot(pr.x, pr.y, el.core, 1); dot(pr.x - pr.vx / sp, pr.y - pr.vy / sp, el.col, 0.8);
        L.push({ x: pr.x, y: pr.y, rgb: el.rgb, r: 10, i: 0.6 });
      } else if (pr.type === 'orb' || pr.type === 'heart') {
        const col = pr.type === 'heart' ? '#ff6a9a' : el.col;
        dot(pr.x, pr.y, el.core, 1);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(pr.x + dx, pr.y + dy, col, 0.9);
        if (pr.type === 'heart') { dot(pr.x - 1, pr.y - 1, col, 0.9); dot(pr.x + 1, pr.y - 1, col, 0.9); }
        if (Math.random() < 0.3) spawnParticle('beamSpark', pr.x, pr.y, 0, 0, 0.25, col);
        L.push({ x: pr.x, y: pr.y, rgb: pr.type === 'heart' ? [255, 106, 154] : el.rgb, r: 16, i: 0.7 });
      } else if (pr.type === 'boom') {
        const a = t * 20;
        for (let k = 0; k < 4; k++) dot(pr.x + Math.cos(a + k * 1.57) * 2, pr.y + Math.sin(a + k * 1.57) * 2, k % 2 ? el.col : el.core, 1);
        dot(pr.x, pr.y, el.core, 1);
        L.push({ x: pr.x, y: pr.y, rgb: el.rgb, r: 16, i: 0.7 });
      }
    }
    // sword slashes: a sweeping arc of light
    for (const s of this.slashes) {
      const f = s.life / s.max, el = ELEMENTS[s.el], sweep = (1 - f) * 2.4 - 1.2;
      for (let k = 0; k < 14; k++) {
        const aa = s.a - 1.2 + (k / 13) * 2.4;
        if (aa > s.a + sweep + 0.2) continue;
        for (const r of [s.reach - 3, s.reach]) dot(s.x + Math.cos(aa) * r, s.y + Math.sin(aa) * r, r === s.reach ? el.core : el.col, f);
      }
      L.push({ x: s.x + Math.cos(s.a) * s.reach * 0.7, y: s.y + Math.sin(s.a) * s.reach * 0.7, rgb: el.rgb, r: 22, i: f * 1.2 });
    }
    // XP gems
    for (const g of this.gems) {
      const tw = (Math.sin(t * 10 + g.x) > 0) ? '#b8ff6a' : '#ffffff';
      dot(g.x, g.y, tw, 1); dot(g.x + 1, g.y, '#6ae84a', 1); dot(g.x, g.y + 1, '#6ae84a', 1);
      L.push({ x: g.x, y: g.y, rgb: [106, 232, 74], r: 8, i: 0.5 });
    }
    // damage numbers
    for (const n of this.numbers) {
      const s = String(n.v), x = Math.round(n.x - ox - s.length * 2), y = Math.round(n.y - oy);
      S.globalAlpha = Math.min(1, n.life * 3); E.globalAlpha = S.globalAlpha;
      drawText(S, s, x, y, n.col); drawText(E, s, x, y, n.col);
    }
    S.globalAlpha = 1; E.globalAlpha = 1;
  },
  // screen-space HUD: equipped item, ability, level and XP bar, and a toast line
  hud(S, E, VW) {
    const x0 = Math.round(VW / 2) - 34, y0 = 4;
    S.globalAlpha = 0.75; S.fillStyle = '#0b0b10'; S.fillRect(x0, y0, 68, 15); S.globalAlpha = 1;
    const box = (x, g, col) => {
      for (const c of [S, E]) { c.fillStyle = c === S ? col : '#222230'; c.fillRect(x, y0 + 1, 12, 1); c.fillRect(x, y0 + 12, 12, 1); c.fillRect(x, y0 + 1, 1, 12); c.fillRect(x + 11, y0 + 1, 1, 12); }
      S.drawImage(spr(g, 0, false), x + 2, y0 + 3); E.drawImage(spr(g, 0, false), x + 2, y0 + 3);
    };
    const it = this.item();
    box(x0 + 2, G['item_' + this.inv[this.eq]], ELEMENTS[it.el].col);
    box(x0 + 16, G.icon_beam, '#9ad8ff');
    const lv = this.level(), lo = this.levelXp(lv), hi = this.levelXp(lv + 1);
    drawText(S, 'LV' + lv, x0 + 31, y0 + 2, '#f2f0e8'); drawText(E, 'LV' + lv, x0 + 31, y0 + 2, '#5a5a56');
    const f = clamp((this.xp - lo) / (hi - lo), 0, 1);
    S.fillStyle = '#1e2a1a'; S.fillRect(x0 + 31, y0 + 10, 34, 2);
    for (const c of [S, E]) { c.fillStyle = '#6ae84a'; c.fillRect(x0 + 31, y0 + 10, Math.round(34 * f), 2); }
    if (this.inv.length > 1) { drawText(S, String(this.eq + 1), x0 + 58, y0 + 2, '#8a8a96'); }
    if (this.toast) {
      const s = this.toast.text, w = s.length * 4, x = Math.round(VW / 2 - w / 2), y = y0 + 19;
      S.globalAlpha = Math.min(1, this.toast.life * 2); E.globalAlpha = S.globalAlpha * 0.6;
      S.fillStyle = '#0b0b10'; S.fillRect(x - 3, y - 2, w + 5, 9);
      drawText(S, s, x, y, '#f2f0e8'); drawText(E, s, x, y, '#f2f0e8');
      S.globalAlpha = 1; E.globalAlpha = 1;
    }
    if (this.hurtT > 0) {
      E.globalAlpha = this.hurtT; E.fillStyle = '#801010';
      E.fillRect(0, 0, VW + 2, 2); E.fillRect(0, 0, 2, 999); E.fillRect(VW - 1, 0, 3, 999); E.globalAlpha = 1;
    }
  },
};

// pick an item for a place: prefer items tagged for it, otherwise anything but the starter
function pickItem(tags, r) {
  const ids = Object.keys(ITEMS).filter((id) => id !== 'sling');
  const tagged = ids.filter((id) => ITEMS[id].tags.some((t) => tags.indexOf(t) >= 0));
  const pool = tagged.length ? tagged : ids;
  return pool[Math.floor(r * pool.length) % pool.length];
}

// --- placing items -------------------------------------------------------------------------------
// interiors: every chest gets loot; some dreams also hold an item on a pedestal
function seedInteriorItems(m, ent, seed) {
  const R = mulberry32(seed ^ 0x1b873593);
  m.items = m.items || [];
  m.loot = new Map();
  const tags = [ent.type, m.dream ? m.dream.name : ''];
  for (let i = 0; i < m.w * m.h; i++) if ((m.glyph[i] & 0x7fff) === G.chest) m.loot.set(i, pickItem(tags, R()));
  if (R() < 0.45) {
    const d = bfsFrom(m, m.spawn.x, m.spawn.y);
    let max = 0;
    for (const v of d) if (v > max) max = v;
    const cand = [];
    for (let i = 0; i < d.length; i++) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (d[i] > max * 0.4 && !m.glyph[i] && !m.solid[i] && !m.entr.has(i) && !(m.pickups || []).some((p) => p.x === x && p.y === y)) cand.push(i);
    }
    if (cand.length) {
      const i = cand[Math.floor(R() * cand.length)];
      m.glyph[i] = G.pedestal;
      m.items.push({ x: i % m.w, y: (i / m.w) | 0, id: pickItem(tags, R()) });
    }
  }
}
// overworld: pedestals at ruins, stone circles, giant skeletons and the like
function seedOverworldItems(world, seed) {
  const m = world.map, R = mulberry32(seed ^ 0x68e31da4);
  m.items = [];
  const biomeTag = { [B.VOLCANO]: 'volcano', [B.SNOW]: 'snow', [B.SPOOKY]: 'spooky', [B.MUSH]: 'mush', [B.PINK]: 'pink', [B.CRYSTAL]: 'crystal',
    [B.FOREST]: 'forest', [B.LAKE]: 'lake' };
  for (const p of world.pois) {
    if (['ruins', 'stones', 'ribs', 'tower', 'lighthouse', 'temple'].indexOf(p.type) < 0 || R() > 0.6) continue;
    for (let k = 0; k < 30; k++) {
      const x = p.hub.x + Math.round((R() - 0.5) * 6), y = p.hub.y + Math.round((R() - 0.5) * 4), i = y * m.w + x;
      if (!m.inb(x, y) || m.solid[i] || m.water[i] || m.road[i] || m.entr.has(i) || m.pickups.some((q) => q.x === x && q.y === y)) continue;
      m.glyph[i] = G.pedestal;
      m.items.push({ x, y, id: pickItem([p.type, biomeTag[m.biome[i]] || ''], R()) });
      break;
    }
  }
  m.cache.clear();
}

Combat.load();

// --- input --------------------------------------------------------------------------------------------
cvs.addEventListener('pointerdown', (e) => {
  if (game.mode !== 'world') return;
  if (e.button === 2) { Powers.startCharge(Powers.aimFromEvent(e)); return; }
  if (e.button === 0) Combat.attack(Powers.aimFromEvent(e));
});
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.repeat || game.mode !== 'world' || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.code === 'KeyQ') Combat.cycle(1);
  if (e.code === 'KeyE') Combat.cycleAbility();
  if (e.code === 'KeyF' || e.code === 'KeyJ') Combat.attack(null);
});
