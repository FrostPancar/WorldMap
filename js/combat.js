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
defGlyph('emoteBang', ['...11...', '...11...', '...11...', '...11...', '...11...', '........', '...11...', '........'], ['#ffe84a'], { emit: true });
defGlyph('lockIcon', ['..111...', '.1...1..', '.1...1..', '1111111.', '1112111.', '1112111.', '1111111.', '........'], [P.gold, '#3a2408'], { emit: [1] });
defGlyph('icon_up', ['...1....', '..111...', '.11111..', '1111111.', '..111...', '..111...', '..111...', '........'], ['#ffe84a'], { emit: true });
defGlyph('icon_beam', ['........', '1.......', '.1......', '..111111', '.1......', '1.......', '........', '........'], ['#9ad8ff'], { emit: true });
defGlyph('icon_vortex', ['..1111..', '.1....1.', '1..11..1', '1.1..1.1', '1.1.11.1', '1..1...1', '.1....1.', '..111...'], ['#c08aff'], { emit: true });
defGlyph('icon_shadow', ['....11..', '...1111.', '1..1111.', '.1..11..', '1..1111.', '.1.1111.', '1...11..', '...1..1.'], ['#9a7ae8'], { emit: true });
defGlyph('icon_star', ['1.......', '.1..1...', '..1111..', '.111111.', '..1111..', '.11.11..', '.1...1..', '........'], ['#ffd84a'], { emit: true });
// the special trader: a hooded wanderer with a lantern
defGlyph('c_trader', [
  ['..111...', '.11111..', '.14341..', '.13331..', '..111...', '.111112.', '1112112.', '1112115.',
    '1112155.', '.111255.', '.111212.', '.11121..', '.11121..', '111121..', '1111211.', '.222222.'],
  ['..111...', '.11111..', '.13331..', '.13331..', '..111...', '.111112.', '1112112.', '1112112.',
    '1112115.', '.111255.', '.111255.', '.11121..', '.11121..', '111121..', '1111211.', '.222222.'],
], ['#5a3a8a', '#f0c040', '#e0b890', '#1a1024', '#ffd890'], { emit: [5] });

// --- tiny pixel font for the HUD ---------------------------------------------------------
const FONT = {
  A: '.1.1.11111.11.1', B: '11.1.111.1.111.', C: '.111..1..1...11', D: '11.1.11.11.111.', E: '1111..11.1..111', F: '1111..11.1..1..',
  G: '.111..1.11.1.11', H: '1.11.11111.11.1', I: '111.1..1..1.111', J: '..1..1..11.1.1.', K: '1.11.111.1.11.1', L: '1..1..1..1..111',
  M: '1.11111111.11.1', N: '11.1.11.11.11.1', O: '.1.1.11.11.1.1.', P: '11.1.111.1..1..', Q: '.1.1.11.111..11', R: '11.1.111.1.11.1',
  S: '.111...1...111.', T: '111.1..1..1..1.', U: '1.11.11.11.1111', V: '1.11.11.11.1.1.', W: '1.11.11111111.1', X: '1.11.1.1.1.11.1',
  Y: '1.11.1.1..1..1.', Z: '111..1.1.1..111', '0': '1111.11.11.1111', '1': '.1.11..1..1.111', '2': '111..11111..111',
  '3': '111..1.11..1111', '4': '1.11.1111..1..1', '5': '1111..111..1111', '6': '1111..1111.1111', '7': '111..1.1..1..1.',
  '8': '1111.11111.1111', '9': '1111.1111..1111', '-': '......111......', '/': '..1..1.1.1..1..', '.': '.............1.', ':': '....1.....1....', '!': '.1..1..1.....1.', '?': '11...1.1.....1.',
  '%': '1.1..1.1.1..1.1', ',': '..........1.1..', "'": '.1..1..........', '(': '..1.1..1..1...1', ')': '1...1..1..1.1..',
  '<': '..1.1.1...1...1', '>': '1...1...1.1.1..', '+': '....1.111.1....', ' ': '...............',
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
function baseName(c) { return GLYPHS[c.g].name; }

const Combat = {
  projectiles: [], slashes: [], gems: [], numbers: [], cd: 0, toast: null, hurtT: 0,
  inv: ['sling'], eq: 0, xp: 0, ability: 0, specials: ['beam'], bossDown: new Set(), talkT: -9, crystals: [], worldDown: new Set(),
  hp: 8, invT: 0, deathT: 0, lastHurt: -99, regenT: 0, auth: true, heartsT: 0, keys: 0, unlocked: new Set(),
  hitBuf: [], tameBuf: [], esBuf: [], seq: 1, snapT: 0, atkEvt: null,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('worldmap-combat'));
      if (s && Array.isArray(s.inv)) {
        this.inv = s.inv.filter((id) => ITEMS[id]);
        if (!this.inv.length) this.inv = ['sling'];
        this.eq = clamp(s.eq | 0, 0, this.inv.length - 1); this.xp = Math.max(0, +s.xp || 0);
        this.keys = Math.max(0, s.keys | 0); this.unlocked = new Set(Array.isArray(s.un) ? s.un.map(String) : []);
        if (Array.isArray(s.sp)) this.specials = ['beam'].concat(s.sp.filter((k) => SPECIALS[k] && k !== 'beam'));
        this.ability = clamp(s.ab | 0, 0, this.specials.length - 1);
        this.bossDown = new Set(Array.isArray(s.bd) ? s.bd.map(String) : []);
        if (Array.isArray(s.cr)) this.crystals = s.cr.filter((k) => Number.isInteger(k) && k >= 0 && k < CRYSTAL_SLOTS);
        this.worldDown = new Set(Array.isArray(s.wd) ? s.wd.filter((k) => Number.isInteger(k)) : []);
      }
    } catch (e) { /* fresh start */ }
  },
  save() {
    try {
      localStorage.setItem('worldmap-combat', JSON.stringify({ inv: this.inv, eq: this.eq, xp: this.xp, keys: this.keys, un: [...this.unlocked].slice(-300),
        sp: this.specials, ab: this.ability, bd: [...this.bossDown], cr: this.crystals, wd: [...this.worldDown] }));
    } catch (e) { /* no storage */ }
  },
  special() { return this.specials[this.ability] || 'beam'; },
  item() { return ITEMS[this.inv[this.eq]] || ITEMS.sling; },
  level() { return Math.floor(Math.sqrt(this.xp / 6)) + 1; },
  levelXp(l) { return (l - 1) * (l - 1) * 6; },
  power() { return 1 + (this.level() - 1) * 0.12; },
  // pop-ups are icons, with at most a number beside them (no words)
  say(text, icon) { this.toast = { text: text || '', icon, life: 2.2 }; },
  showHearts() { this.heartsT = 2.6; },

  maxHp() { return 8 + (this.level() - 1) * 2; },
  ensure(c) {
    if (c.maxhp !== undefined) return;
    const def = ENEMY_DEF[baseName(c)];
    c.enemy = !!def; c.def = def; c.beh = def ? def.beh : null;
    const depth = (game.ret && game.ret.depth) || 0;
    c.maxhp = c.enemy ? Math.round(def.hp * (1 + depth * 0.5)) : 0;
    if (c.hp === undefined) c.hp = c.maxhp;
    c.cd = Math.random() * 1.5; c.shotCd = 1 + Math.random() * 2;
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
    if (Powers.possess) { this.bodyAttack(aim, x0, y0); return; }
    if (!aim) {
      const e = this.nearestEnemy(x0, y0, 90);
      aim = e ? { x: e.px + 4, y: e.py + 4 } : null;
    }
    const a = aim ? Math.atan2(aim.y - y0, aim.x - x0) : { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.face];
    if (!p.moving) p.face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
    this.cd = it.cd;
    this.fire(it, x0, y0, a, aim, 'player');
    this.atkEvt = { s: this.seq++, id: this.inv[this.eq], a: Math.round(a * 100) / 100, d: aim ? Math.round(Math.hypot(aim.x - x0, aim.y - y0)) : 56 };
  },
  // while shadow-stepped into a creature you fight with its body: creatures
  // that shoot fire their own kind of shot, everything else lunges and bites
  bodyAttack(aim, x0, y0) {
    const c = Powers.possess.c, p = game.player;
    this.ensure(c);
    if (!aim) { const e = this.nearestEnemy(x0, y0, 90); aim = e ? { x: e.px + 4, y: e.py + 4 } : null; }
    const a = aim ? Math.atan2(aim.y - y0, aim.x - x0) : { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[p.face];
    if (!p.moving) p.face = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');
    const base = (c.def ? c.def.dmg + 1 : 1.5) * this.power(), shot = c.def && c.def.shot && SHOTS[c.def.shot];
    if (shot && !shot.lob) {
      this.cd = 0.4;
      this.projectiles.push({ type: 'bullet', x: x0, y: y0, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 0.6, el: 'void', dmg: base * 1.2,
        owner: 'player', hit: new Set(), bounce: 0, pierce: false });
      Sound.sfx('eshot');
    } else if (shot) {
      this.cd = 0.55;
      const d = aim ? clamp(Math.hypot(aim.x - x0, aim.y - y0), 16, 80) : 56;
      this.projectiles.push({ type: 'arc', x0, y0, x1: x0 + Math.cos(a) * d, y1: y0 + Math.sin(a) * d, x: x0, y: y0, t: 0, dur: 0.2 + d / 240, h: 6 + d * 0.15,
        el: 'void', dmg: base * 1.5, owner: 'player', hit: new Set(), bounce: 0, pierce: false });
      Sound.sfx('shot', 'sling');
    } else {
      this.cd = 0.35;
      this.slashes.push({ x: x0, y: y0, a, reach: 13, life: 0.16, max: 0.16, el: 'void', owner: 'player' });
      for (const e of game.map.creatures) {
        if (!this.isEnemy(e)) continue;
        const dx = e.px + 4 - x0, dy = e.py + 4 - y0, d = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (d < 17 + (e.r ? e.r - 6 : 0) && Math.abs(da) < 1.3) this.damage(e, base * 1.6, 'void', a);
      }
      Sound.sfx('shot', 'sword');
    }
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
        if (owner === 'ghost') break;
        for (const c of game.map.creatures) {
          if (!this.isEnemy(c)) continue;
          const dx = c.px + 4 - x0, dy = c.py + 4 - y0, d = Math.hypot(dx, dy);
          let da = Math.atan2(dy, dx) - a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (d < (it.reach || 15) + 4 + (c.r ? c.r - 6 : 0) && Math.abs(da) < 1.25) this.damage(c, dmg, el, a);
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
  damage(c, dmg, el, a, remote) {
    if (!this.isEnemy(c)) return;
    c.flash = 0.35; c.hitT = 0.3;
    if (!this.auth) {
      // another player runs the enemies here: predict the hit, send it to them
      c.hp = Math.max(0.01, c.hp - dmg);
      if (c.id !== undefined) this.hitBuf.push([c.id, Math.round(dmg * 10), el, Math.round(a * 100)]);
      this.numbers.push({ x: c.px + 4, y: c.py - 2, v: Math.max(1, Math.round(dmg)), life: 0.7, col: ELEMENTS[el].col });
      for (let n = 0; n < 5; n++) spawnParticle('beamSpark', c.px + 4, c.py + 4, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.35, ELEMENTS[el].col);
      Sound.sfx('hit');
      return;
    }
    c.hp -= dmg;
    this.numbers.push({ x: c.px + 4, y: c.py - 2, v: Math.max(1, Math.round(dmg)), life: 0.7, col: ELEMENTS[el].col });
    if (el === 'ember') c.burn = 2.5;
    if (el === 'frost') c.slow = 3;
    const m = game.map, sx = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.sign(Math.cos(a)) : 0, sy = sx ? 0 : Math.sign(Math.sin(a));
    if (!c.moving && !c.boss && !m.blocked(c.x + sx, c.y + sy) && !m.entr.has((c.y + sy) * m.w + c.x + sx)) {
      c.fx = c.x; c.fy = c.y; c.x += sx; c.y += sy; c.t = 0; c.moving = true; c.wait = 0.3;
    }
    for (let n = 0; n < 5; n++) spawnParticle('beamSpark', c.px + 4, c.py + 4, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.35, ELEMENTS[el].col);
    Sound.sfx('hit');
    if (c.hp <= 0) this.kill(c);
  },
  // a friendly creature that gets hit: it flinches, hops aside and looks startled
  poke(c, a) {
    if (c.npc) return;
    c.flash = 0.3; c.hitT = 0.35; c.startle = 1;
    const m = game.map, sx = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? Math.sign(Math.cos(a)) : 0, sy = sx ? 0 : Math.sign(Math.sin(a));
    if (!c.moving && !m.blocked(c.x + sx, c.y + sy) && !m.entr.has((c.y + sy) * m.w + c.x + sx)) {
      c.fx = c.x; c.fy = c.y; c.x += sx; c.y += sy; c.t = 0; c.moving = true; c.wait = 0.6;
    }
    for (let n = 0; n < 4; n++) spawnParticle('beamSpark', c.px + 4, c.py + 4, (Math.random() - 0.5) * 40, -Math.random() * 40, 0.3, '#ffffff');
    Sound.sfx('poke');
  },
  kill(c, net) {
    if (c.dead) return;
    c.dead = true;
    if (!net && c.id !== undefined && !c.pet) { game.map.deadIds = game.map.deadIds || []; game.map.deadIds.push(c.id); }
    if (!net && c.def && c.def.split) {
      for (let k = 0; k < 2; k++) {
        const b = makeCreature(c.def.split, c.x, c.y, -1, Math.random);
        b.id = game.map.nextId = (game.map.nextId || 100000) + 1;
        game.map.creatures.push(b);
      }
    }
    if (Math.random() < 0.18) this.gems.push({ x: c.px + 4, y: c.py + 4, vx: 0, vy: -30, val: 0, heal: 2, map: game.map, t: 0 });
    const m = game.map, i = m.creatures.indexOf(c);
    if (i >= 0) m.creatures.splice(i, 1);
    const x = c.px + 4, y = c.py + 4;
    for (let n = 0; n < 18; n++) spawnParticle('beamSpark', x, y, (Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, 0.5, n % 2 ? '#ffffff' : '#ff5a50');
    if (c.boss) Bosses.defeated(c);
    const n = clamp(Math.ceil(c.maxhp / 2), 1, 24);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.gems.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, val: c.maxhp / n, map: m, t: 0, far: !!c.boss }); // a boss's gems find you anywhere
    }
    Sound.sfx('kill');
  },
  // --- the player's health ------------------------------------------------------------------
  hurt(dmg) {
    if (this.invT > 0 || this.deathT > 0 || game.pending) return;
    if (Powers.possess) Powers.endPossess(true);
    this.hp -= dmg; this.invT = 0.9; this.hurtT = 0.35; this.lastHurt = game.time; this.showHearts(); game.player.hitT = 0.3;
    Powers.shake = Math.max(Powers.shake, 2); Sound.sfx('hurt');
    const p = game.player;
    for (let n = 0; n < 8; n++) spawnParticle('beamSpark', p.px + 4, p.py + 4, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.35, '#ff4a4a');
    if (this.hp <= 0) this.die();
  },
  die() {
    this.hp = 0; this.deathT = 1.4;
    Powers.charging = false; Sound.chargeStop();
    const p = game.player;
    for (let n = 0; n < 40; n++) spawnParticle('beamSpark', p.px + 4, p.py + 4, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0.8, n % 2 ? '#ffffff' : '#ff5a50');
    Powers.rings.push({ x: p.px + 4, y: p.py + 4, r: 2, vr: 60, life: 0.8, max: 0.8, k: 'ember' });
    Sound.sfx('die');
    setTimeout(() => fadeTo(() => {
      // wake up back in the starting village with full health
      Combat.carryPets(game.map, game.world.map, game.world.start.x, game.world.start.y);
      game.map = game.world.map; game.stack = []; game.ret = null;
      game.player.place(game.world.start.x, game.world.start.y); game.player.face = 'down';
      Combat.hp = Combat.maxHp(); Combat.invT = 2; Combat.deathT = 0; Combat.projectiles.length = 0;
      particles.length = 0; snapCamera(); game.irisT = game.time;
    }, 1.6), 900);
  },
  gainXp(v) {
    const before = this.level();
    this.xp += v;
    if (this.level() > before) {
      this.say(String(this.level()), G.icon_up);
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
    this.say('', G['item_' + id]);
    const p = game.player;
    Powers.rings.push({ x: p.px + 4, y: p.py + 4, r: 2, vr: 70, life: 0.5, max: 0.5, k: ITEMS[id].el });
    Sound.sfx('absorb', 523);
    this.save();
  },
  // --- keys and locked doors ------------------------------------------------------------------------
  clearCell(m, x, y) {
    const i = y * m.w + x, ck = m.chunks[((y / CH) | 0) * m.cw + ((x / CH) | 0)];
    m.glyph[i] = 0;
    ck.emit = ck.emit.filter((k) => k !== i); ck.anim = ck.anim.filter((k) => k !== i);
    ck.lights = ck.lights.filter((L) => Math.floor(L.x / TS) !== x || Math.floor(L.y / TS) !== y);
    m.cache.delete(((y / CH) | 0) * m.cw + ((x / CH) | 0));
    if (y + 1 < m.h) m.cache.delete((((y + 1) / CH) | 0) * m.cw + ((x / CH) | 0));
  },
  placeLive(m, x, y, name) {
    const i = y * m.w + x, d = GLYPHS[G[name]], ck = m.chunks[((y / CH) | 0) * m.cw + ((x / CH) | 0)];
    m.glyph[i] = G[name];
    if (d.emit) ck.emit.push(i);
    if (d.light) ck.lights.push({ x: x * TS + d.light.ox, y: y * TS + d.light.oy, rgb: d.light.rgb, r: d.light.r, i: d.light.i, f: d.light.f, ph: hash2(x, y, 9) * 100 });
    m.cache.delete(((y / CH) | 0) * m.cw + ((x / CH) | 0));
  },
  isLocked(e) { return !!(e && e.locked && !this.unlocked.has(String(e.id))); },
  addKey(n) {
    this.keys += n; this.save();
    this.say(String(this.keys), G.key); Sound.sfx('key');
  },
  tryUnlock(e, x, y) {
    const need = e.keyCost || 1;
    if (this.keys >= need) {
      this.keys -= need; this.unlocked.add(String(e.id)); this.save();
      this.say('', G.lockIcon); Sound.sfx('unlock');
      for (let n = 0; n < 14; n++) spawnParticle('beamSpark', x * TS + 4, y * TS + 4, (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 70, 0.5, n % 2 ? '#f0c030' : '#ffffff');
      return true;
    }
    if (!this.lockedSaid || game.time - this.lockedSaid > 1) {
      this.lockedSaid = game.time; Sound.sfx('locked');
      this.say(need > 1 ? this.keys + '/' + need : '', need > 1 ? G.key : G.lockIcon);
    }
    return false;
  },
  cycle(dir) {
    if (this.inv.length < 2) { this.say('', G['item_' + this.inv[this.eq]]); return; }
    this.eq = (this.eq + dir + this.inv.length) % this.inv.length;
    this.say('', G['item_' + this.inv[this.eq]]); Sound.sfx('ui'); this.save();
  },
  cycleAbility() {
    if (Powers.charging) return;
    this.ability = (this.ability + 1) % this.specials.length;
    const S = SPECIALS[this.special()];
    this.say('', G[S.icon]); Sound.sfx('ui'); this.save();
  },
  // --- the special trader: five weapons for one special you don't know yet -------------
  tryTalk(x, y) {
    const c = game.map.creatures.find((q) => q.npc && q.x === x && q.y === y);
    if (!c || game.time - this.talkT < 1.2) return !!c;
    this.talkT = game.time; c.emote = 0; c.talk = 1.5;
    const missing = Object.keys(SPECIALS).filter((k) => this.specials.indexOf(k) < 0);
    if (!missing.length) { Sound.sfx('ui'); return true; }
    if (this.inv.length < 5) { this.say(this.inv.length + '/5', G.item_rustySword); Sound.sfx('locked'); return true; }
    const take = shuffle(this.inv.slice(), Math.random).slice(0, 5);
    this.inv = this.inv.filter((id) => take.indexOf(id) < 0);
    if (!this.inv.length) this.inv = ['sling'];
    this.eq = 0;
    const k = missing[Math.floor(Math.random() * missing.length)];
    this.specials.push(k); this.ability = this.specials.length - 1;
    this.say('', G[SPECIALS[k].icon]);
    const p = game.player;
    for (const id of take) {
      for (let n = 0; n < 4; n++) spawnParticle('beamSpark', p.px + 4, p.py + 4, (c.px - p.px) * 2 + (Math.random() - 0.5) * 30, (c.py - p.py) * 2 + (Math.random() - 0.5) * 30, 0.5, ELEMENTS[ITEMS[id].el].col);
    }
    Powers.rings.push({ x: p.px + 4, y: p.py + 4, r: 2, vr: 80, life: 0.7, max: 0.7, k });
    Sound.sfx('levelup'); this.save();
    return true;
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
    if (hash2(x, y, 123) < 0.4) setTimeout(() => this.addKey(1), 700);
  },

  // --- per frame ------------------------------------------------------------------------------
  update(dt) {
    const m = game.map, p = game.player, px = p.px + 4, py = p.py + 4;
    this.cd = Math.max(0, this.cd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invT = Math.max(0, this.invT - dt);
    if (p.hitT > 0) p.hitT -= dt;
    this.auth = this.amAuth();
    if (this.hp < this.maxHp() && this.deathT <= 0 && game.time - this.lastHurt > 6) {
      this.regenT -= dt;
      if (this.regenT <= 0) { this.regenT = 3.5; this.hp = Math.min(this.maxHp(), this.hp + 1); this.showHearts(); }
    }
    if (this.toast && (this.toast.life -= dt) <= 0) this.toast = null;
    // creatures: befriending, pets, enemies
    for (const c of m.creatures.slice()) {
      this.ensure(c);
      if (c.hitT > 0) c.hitT -= dt;
      if (c.startle > 0) c.startle -= dt;
      const cx = c.px + 4, cy = c.py + 4, d = Math.hypot(cx - px, cy - py);
      if (c.emote > 0) c.emote -= dt;
      if (c.burn > 0 && this.auth) { c.burn -= dt; c.burnT = (c.burnT || 0) - dt; if (c.burnT <= 0) { c.burnT = 0.6; this.damage(c, 0.5, 'ember', 0); } }
      if (c.slow > 0) c.slow -= dt;
      if (c.dead) continue;
      if (!c.enemy) {
        c.heartCd = (c.heartCd || 0) - dt;
        if (c.npc) { if (c.talk > 0) c.talk -= dt; continue; }
        if (!c.pet && d < 7 && this.deathT <= 0 && c.heartCd <= 0) {
          c.emote = 1.6; c.heartCd = 3; Sound.sfx('heart');
        }
        if (!c.pet && d < 7 && this.deathT <= 0 && !m.creatures.some((q) => q.pet && !q.dead)) {
          c.pet = true; c.emote = 1.6; c.biome = -1;
          if (c.id !== undefined) { if (this.auth) { m.tamedIds = m.tamedIds || []; m.tamedIds.push(c.id); } else this.tameBuf.push(c.id); }
        }
        // pets are companions only: they follow you around but stay out of fights
        if (c.pet && Math.random() < dt * 0.15) c.emote = 1;
      } else {
        c.cd -= dt;
        // a possessed body fools ordinary enemies, but not bosses
        if (d < (c.r ? c.r + 4 : 10) && c.cd <= 0 && c.hp > 0.05 && (!Powers.possess || c.boss)) { c.cd = 1; this.hurt(c.def.dmg); }
        // ranged attackers fire at the nearest player (only where we run the enemies)
        if (this.auth && c.def.shot) {
          c.shotCd -= dt;
          const S = SHOTS[c.def.shot], tgt = this.nearestPlayer(cx, cy, S.range * TS);
          if (tgt && c.shotCd <= 0) { c.shotCd = S.cd * (0.8 + Math.random() * 0.4); this.enemyShot(cx, cy, tgt[0], tgt[1], c.def.shot, true); }
        }
      }
    }
    if (this.auth) Bosses.update(dt, m);
    WorldBosses.update(dt);
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
      if (g.t > 0.35 && (d < 70 || g.far)) { const s = 220 / Math.max(d, 8); g.vx += dx * s * dt; g.vy += dy * s * dt; }
      g.vx *= 0.9; g.vy *= 0.9; g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 5 && g.t > 0.3) { this.gems.splice(i, 1); if (g.heal) { this.hp = Math.min(this.maxHp(), this.hp + g.heal); this.showHearts(); Sound.sfx('heart'); } else this.gainXp(g.val); }
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
    if (pr.owner === 'enemy') return this.stepEnemyShot(pr, dt, m);
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
    // hit enemies (an arcing pellet only hits as it comes down); a friend's shots are just for show
    if (pr.owner === 'ghost' || (pr.type === 'arc' && pr.t < 0.55)) return false;
    for (const c of m.creatures) {
      if (pr.hit.has(c) || c.dead || c.pet || c.npc) continue;
      if (Math.hypot(c.px + 4 - pr.x, c.py + 4 - pr.y) > (c.r || 6)) continue;
      pr.hit.add(c);
      if (!this.isEnemy(c)) {
        if (pr.owner === 'pet' || pr.owner === 'seed') continue;
        this.poke(c, Math.atan2(pr.vy || (pr.y1 - pr.y0), pr.vx || (pr.x1 - pr.x0)));
        if (pr.type === 'arc') { this.splash(pr); return true; }
        if (!pr.pierce) return true;
        continue;
      }
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
  // --- enemy shots ---------------------------------------------------------------------------------
  nearestPlayer(x, y, range, seeThrough) {
    const pl = Powers.possess && !seeThrough ? [] : [[game.player.px + 4, game.player.py + 4]];
    for (const f of Coop.here()) pl.push([f.px + 4, f.py + 4]);
    let best = null, bd = range * range;
    for (const q of pl) { const d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < bd) { bd = d; best = q; } }
    return best;
  },
  enemyShot(x, y, tx, ty, kind, broadcast) {
    const S = SHOTS[kind];
    if (!S) return;
    const n = S.n || 1;
    for (let k = 0; k < n; k++) {
      const jx = tx + (n > 1 ? (Math.random() - 0.5) * 20 : 0), jy = ty + (n > 1 ? (Math.random() - 0.5) * 20 : 0);
      if (S.lob) {
        const dist = Math.hypot(jx - x, jy - y);
        this.projectiles.push({ owner: 'enemy', kind, type: 'arc', x0: x, y0: y, x1: jx, y1: jy, x, y, t: 0, dur: 0.35 + dist / 140, h: 8 + dist * 0.2, dmg: S.dmg, col: S.col });
      } else {
        const a = Math.atan2(jy - y, jx - x);
        this.projectiles.push({ owner: 'enemy', kind, type: 'bolt', x, y, vx: Math.cos(a) * S.spd, vy: Math.sin(a) * S.spd, life: S.range * TS / S.spd, dmg: S.dmg, col: S.col });
      }
    }
    if (broadcast && Coop.room) this.esBuf.push([Math.round(x), Math.round(y), Math.round(tx), Math.round(ty), kind]);
    Sound.sfx(kind === 'flash' ? 'flash' : 'eshot');
  },
  stepEnemyShot(pr, dt, m) {
    const p = game.player, px = p.px + 4, py = p.py + 4;
    if (pr.type === 'arc') {
      pr.t += dt / pr.dur;
      const t = Math.min(1, pr.t);
      pr.x = lerp(pr.x0, pr.x1, t); pr.y = lerp(pr.y0, pr.y1, t); pr.z = Math.sin(t * Math.PI) * pr.h;
      if (pr.t >= 1) {
        if (Math.hypot(pr.x - px, pr.y - py) < 8) this.hurt(pr.dmg);
        for (let n = 0; n < 5; n++) spawnParticle('beamSpark', pr.x, pr.y, (Math.random() - 0.5) * 40, -Math.random() * 30, 0.3, pr.col);
        return true;
      }
      return false;
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if ((pr.life -= dt) <= 0) return true;
    const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS), ti = ty * m.w + tx;
    if (!m.inb(tx, ty) || (m.solid[ti] && !m.water[ti])) return true;
    if (Math.hypot(pr.x - px, pr.y - py) < 5) { this.hurt(pr.dmg); return true; }
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
    const pets = from.creatures.filter((c) => c.pet && !c.dead).slice(0, 1);
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
    // padlocks on doors that need a key
    for (const [i, e] of m.entr) {
      if (!this.isLocked(e)) continue;
      const x = (i % m.w) * TS - ox, y = ((i / m.w) | 0) * TS - oy;
      if (x < -8 || y < -8 || x > W || y > H) continue;
      const bobY = Math.round(y + Math.sin(t * 3) * 0.6);
      S.drawImage(spr(G.lockIcon, 0, false), Math.round(x), bobY); E.drawImage(spr(G.lockIcon, 0, false), Math.round(x), bobY);
    }
    // creature overlays: hearts above pets, health bars on hurt enemies
    for (const c of m.creatures) {
      const gd = GLYPHS[c.g], x = Math.round(c.px - ox) - ((gd.w - TS) >> 1), y = Math.round(c.py - oy) - (gd.tags.includes('center') ? (gd.h - TS) >> 1 : gd.h - TS);
      if (x < -gd.w || y < -gd.h || x > W || y > H) continue;
      // red eyes cast a little light of their own
      if (c.enemy && !c.dead) L.push({ x: c.px + 4, y: y + oy + 2, rgb: [255, 40, 30], r: c.boss ? 22 : 10, i: c.boss ? 0.8 : 0.4 });
      // the special trader: a lantern glow and a bobbing sword sign above the hood
      if (c.npc) {
        L.push({ x: c.px + 6, y: c.py - 2, rgb: [255, 216, 144], r: 34, i: 0.9 });
        const sy = y - 10 + Math.round(Math.sin(t * 3) * 1.5), g = G.item_rustySword;
        S.drawImage(spr(g, 0, false), x, sy); E.globalAlpha = 0.7; E.drawImage(spr(g, 0, false), x, sy); E.globalAlpha = 1;
        continue;
      }
      if (c.startle > 0 && !(c.emote > 0)) {
        const hy = y - 9 - Math.round((1 - c.startle) * 2);
        S.drawImage(spr(G.emoteBang, 0, false), x, hy); E.drawImage(spr(G.emoteBang, 0, false), x, hy);
      }
      if (c.emote > 0) {
        const hy = y - 9 - Math.round((1.6 - Math.min(1.6, c.emote)) * 3);
        S.drawImage(spr(G.heartFill, 0, false), x, hy); E.drawImage(spr(G.heartFill, 0, false), x, hy);
      }
      if (c.enemy && !c.boss && c.hp < c.maxhp) {
        const w = 8, f = Math.max(0, c.hp / c.maxhp);
        S.globalAlpha = 1; S.fillStyle = '#300'; S.fillRect(x, y - 3, w, 1);
        S.fillStyle = '#ff4a4a'; S.fillRect(x, y - 3, Math.ceil(w * f), 1);
        E.fillStyle = '#802020'; E.fillRect(x, y - 3, Math.ceil(w * f), 1);
      }
    }
    // projectiles
    for (const pr of this.projectiles) {
      if (pr.owner === 'enemy') {
        const rgb = hexToRgb(pr.col);
        if (pr.type === 'arc') {
          dot(pr.x, pr.y, '#000000', 0.5);
          const y = pr.y - pr.z;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dot(pr.x + dx, y + dy, pr.col, 1);
          L.push({ x: pr.x, y, rgb, r: 12, i: 0.6 });
        } else {
          const sp = Math.hypot(pr.vx, pr.vy);
          for (let k = 0; k < (pr.kind === 'flash' ? 2 : 4); k++) dot(pr.x - pr.vx / sp * k, pr.y - pr.vy / sp * k, k ? pr.col : '#ffffff', 1 - k * 0.2);
          if (pr.kind === 'flash') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(pr.x + dx, pr.y + dy, pr.col, 0.8);
          L.push({ x: pr.x, y: pr.y, rgb, r: pr.kind === 'flash' ? 26 : 14, i: pr.kind === 'flash' ? 1.4 : 0.8 });
        }
        continue;
      }
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
    // XP gems (and the odd heart that heals)
    for (const g of this.gems) {
      if (g.heal) {
        const x = Math.round(g.x - ox) - 3, y = Math.round(g.y - oy) - 3;
        S.drawImage(spr(G.heartFill, 0, false), x, y); E.drawImage(spr(G.heartFill, 0, false), x, y);
        continue;
      }
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
    WorldBosses.render(S, E, ox, oy, W, H, t, L);
  },
  // --- co-op: one player runs the enemies on each map -----------------------------------------------
  // The player with the smallest id on a map is its authority: it simulates
  // enemies and wildlife there and broadcasts positions, HP, deaths and enemy
  // shots. Everyone else renders those, sends their hits to the authority, and
  // checks enemy shots only against themselves. Kills give XP to everyone there.
  amAuth() {
    if (!Coop.room || !Coop.self) return true;
    const w = Coop.where();
    for (const [id, e] of Coop.peers) if (e.where === w && id < Coop.self) return false;
    return true;
  },
  authId() {
    const w = Coop.where();
    let best = Coop.self;
    for (const [id, e] of Coop.peers) if (e.where === w && id < best) best = id;
    return best;
  },
  number(m) { m.creatures.forEach((c, i) => { c.id = i; }); m.nextId = 100000; },
  netPayload(now) {
    const out = {}, m = game.map;
    let force = false;
    const p = game.player;
    out.hp = Math.max(0, Math.round(this.hp)); out.mh = this.maxHp();
    out.pt = m.creatures.filter((c) => c.pet && !c.dead).slice(0, 6).map((c) => [c.g, Math.round(c.px), Math.round(c.py), c.flip ? 1 : 0]);
    if (this.atkEvt) { out.atk = this.atkEvt; this.atkEvt = null; force = true; }
    if (this.hitBuf.length) { out.ht = { s: this.seq++, l: this.hitBuf.splice(0, 40) }; force = true; }
    if (this.tameBuf.length) { out.tm = { s: this.seq++, l: this.tameBuf.splice(0, 10) }; force = true; }
    if (this.esBuf.length) { out.es = { s: this.seq++, l: this.esBuf.splice(0, 12) }; force = true; }
    if (this.auth && Coop.here().length && now - this.snapT > 110) {
      this.snapT = now;
      const centres = [[p.px, p.py]].concat(Coop.here().map((f) => [f.px, f.py])), R2 = (26 * TS) ** 2;
      const list = [];
      for (const c of m.creatures) {
        if (c.pet || c.dead || c.id === undefined) continue;
        if (!centres.some((q) => (q[0] - c.px) ** 2 + (q[1] - c.py) ** 2 < R2)) continue;
        this.ensure(c);
        list.push([c.id, Math.round(c.px), Math.round(c.py), Math.round(c.hp * 10), (c.flip ? 1 : 0) | (c.moving ? 2 : 0) | (c.flash > 0 ? 4 : 0), c.id >= 100000 ? c.g : 0]);
        if (list.length >= 48) break;
      }
      out.sn = { w: Coop.where(), c: list, dd: (m.deadIds || []).slice(-120), tm: (m.tamedIds || []).slice(-40) };
      force = true;
    }
    return { out, force };
  },
  netReceive(id, s, e) {
    const here = e.where === Coop.where();
    e.hp = typeof s.hp === 'number' ? s.hp : e.hp; e.mh = typeof s.mh === 'number' ? s.mh : e.mh;
    e.pets = Array.isArray(s.pt) ? s.pt.slice(0, 6).filter((q) => Array.isArray(q) && GLYPHS[q[0]] && GLYPHS[q[0]].name.startsWith('c_')) : [];
    const fresh = (key, obj) => obj && typeof obj.s === 'number' && obj.s !== e[key] && ((e[key] = obj.s), true);
    if (fresh('atkS', s.atk) && here && ITEMS[s.atk.id] && typeof s.atk.a === 'number') {
      const a = s.atk.a, d = clamp(+s.atk.d || 56, 8, 90), x0 = e.px + 4, y0 = e.py + 4;
      this.fire(ITEMS[s.atk.id], x0, y0, a, { x: x0 + Math.cos(a) * d, y: y0 + Math.sin(a) * d }, 'ghost');
    }
    if (fresh('htS', s.ht) && here && this.auth && Array.isArray(s.ht.l)) {
      const idx = this.index();
      for (const h of s.ht.l) {
        const c = idx.get(h[0]);
        if (c && ELEMENTS[h[2]]) this.damage(c, clamp(h[1] / 10, 0, 50), h[2], (h[3] || 0) / 100, true);
      }
    }
    if (fresh('tmS', s.tm) && here && this.auth && Array.isArray(s.tm.l)) {
      const idx = this.index(), m = game.map;
      for (const tid of s.tm.l) {
        const c = idx.get(tid);
        if (c && !c.enemy) { m.creatures.splice(m.creatures.indexOf(c), 1); m.tamedIds = m.tamedIds || []; m.tamedIds.push(tid); }
      }
    }
    if (fresh('esS', s.es) && here && !this.auth && Array.isArray(s.es.l)) {
      for (const q of s.es.l) if (SHOTS[q[4]]) this.enemyShot(q[0], q[1], q[2], q[3], q[4], false);
    }
    if (s.sn && s.sn.w === Coop.where() && !this.auth && id === this.authId()) this.applySnapshot(s.sn);
  },
  index() {
    const idx = new Map();
    for (const c of game.map.creatures) if (!c.pet && !c.dead && c.id !== undefined) idx.set(c.id, c);
    return idx;
  },
  applySnapshot(sn) {
    const m = game.map, idx = this.index(), now = performance.now();
    if (Array.isArray(sn.c)) for (const q of sn.c) {
      if (!Array.isArray(q) || q.length < 5) continue;
      let c = idx.get(q[0]);
      if (!c) {
        const g = q[5];
        if (!g || !GLYPHS[g] || !GLYPHS[g].name.startsWith('c_')) continue;
        c = makeCreature(GLYPHS[g].name, Math.round(q[1] / TS), Math.round(q[2] / TS), -1, Math.random);
        c.id = q[0]; m.creatures.push(c);
      }
      this.ensure(c);
      c.netX = q[1]; c.netY = q[2]; c.hp = q[3] / 10; c.flip = !!(q[4] & 1); c.netMove = !!(q[4] & 2); c.netT = now;
      if (q[4] & 4) c.flash = Math.max(c.flash || 0, 0.2);
    }
    if (Array.isArray(sn.dd)) for (const did of sn.dd) { const c = idx.get(did); if (c) this.kill(c, true); }
    if (Array.isArray(sn.tm)) for (const tid of sn.tm) {
      const c = idx.get(tid);
      if (c && !c.pet) m.creatures.splice(m.creatures.indexOf(c), 1);
    }
  },
  // followers glide toward the positions the authority reports
  netUpdate(dt) {
    const k = 1 - Math.exp(-dt * 14);
    for (const c of game.map.creatures) {
      if (c.pet || c.netT === undefined) continue;
      c.px += (c.netX - c.px) * k; c.py += (c.netY - c.py) * k;
      c.x = Math.round(c.px / TS); c.y = Math.round(c.py / TS);
      c.moving = c.netMove; c.t = (game.time * 3) % 1;
      if (c.flash) c.flash = Math.max(0, c.flash - dt);
    }
  },

  // screen-space HUD: equipped item, ability, level and XP bar, and a toast line
  hud(S, E, VW, VH) {
    // boss health bar along the bottom while one is alive here
    const p = game.player;
    const boss = game.map && game.map.creatures.find((c) => c.boss && !c.dead && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) < 22);
    if (boss && boss.maxhp) {
      const w = Math.min(160, Math.round(VW * 0.6)), x = Math.round(VW / 2 - w / 2), y = Math.round(VH) - 14, f = clamp(boss.hp / boss.maxhp, 0, 1);
      S.globalAlpha = 0.75; S.fillStyle = '#0b0b10'; S.fillRect(x - 3, y - 3, w + 6, 9); S.globalAlpha = 1;
      S.fillStyle = boss.enraged ? '#5a1010' : '#3a1a20'; S.fillRect(x, y, w, 3);
      S.fillStyle = boss.flash > 0 ? '#ffffff' : '#ff3a3a'; S.fillRect(x, y, Math.ceil(w * f), 3);
    }
    // nothing permanent on screen: health appears when it changes, names when you switch or pick up
    if (this.heartsT > 0) this.heartsT -= 1 / 60;
    if (this.heartsT > 0 || this.deathT > 0) {
      const a = Math.min(1, Math.max(this.heartsT, this.deathT > 0 ? 1 : 0) * 1.5);
      const mh = this.maxHp(), hearts = Math.ceil(mh / 2), hx0 = Math.round(VW / 2) - hearts * 3, y = 6;
      S.globalAlpha = a * 0.6; S.fillStyle = '#0b0b10'; S.fillRect(hx0 - 3, y - 2, hearts * 6 + 5, 9); S.globalAlpha = a;
      const shape = ['11.11', '11111', '11111', '.111.', '..1..'];
      for (let k = 0; k < hearts; k++) {
        const v = clamp(this.hp - k * 2, 0, 2), x = hx0 + k * 6;
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
          if (shape[j][i] !== '1') continue;
          const full = v >= 2 || (v >= 1 && i < 3);
          S.fillStyle = full ? (this.invT > 0 && Math.floor(game.time * 20) % 2 ? '#ffffff' : '#ff4a5a') : '#3a1a20';
          S.fillRect(x + i, y + j, 1, 1);
        }
      }
      S.globalAlpha = 1;
    }
    if (this.toast) {
      const s = this.toast.text, icon = this.toast.icon, w = Math.max(0, s.length * 4 - 1) + (icon ? 8 + (s ? 3 : 0) : 0);
      const x = Math.round(VW / 2 - w / 2), y = 20;
      S.globalAlpha = Math.min(1, this.toast.life * 2);
      S.fillStyle = '#0b0b10'; S.fillRect(x - 4, y - 3, w + 7, icon ? 14 : 11);
      if (icon) S.drawImage(spr(icon, 0, false), x, y);
      drawText(S, s, x + (icon ? 11 : 0), y + (icon ? 2 : 0), '#f2f0e8');
      S.globalAlpha = 1;
    }
    if (this.hurtT > 0) {
      S.globalAlpha = this.hurtT; S.fillStyle = '#c01818';
      S.fillRect(0, 0, VW + 2, 2); S.fillRect(0, 0, 2, 999); S.fillRect(VW - 2, 0, 3, 999); S.globalAlpha = 1;
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
// Some doors are locked. Keys lie around camps, villages and ruins outdoors,
// inside caves and dungeons, and in chests.
const LOCKABLE = { crypt: 0.6, castle: 0.5, tower: 0.5, dungeon: 0.4, temple: 0.5, firetemple: 0.5, witch: 0.5, lighthouse: 0.4, mine: 0.35,
  worldtree: 0.5, wreck: 0.35, cave: 0.2, icecave: 0.3, hollow: 0.25, house: 0.08 };
function lockEntrances(world, seed) {
  for (const e of world.entrances) {
    // boss arenas are always sealed and take two keys
    if (e.type === 'arena') { e.locked = true; e.keyCost = 2; continue; }
    const p = LOCKABLE[e.type] || 0;
    if (p && hash2(e.id, 7, seed) < p && Math.abs(e.ret.x - world.start.x) + Math.abs(e.ret.y - world.start.y) > 20) e.locked = true;
  }
}
function seedOverworldKeys(world, seed) {
  const m = world.map, R = mulberry32(seed ^ 0x51ed270b);
  for (const p of world.pois) {
    if (['camp', 'village', 'ruins', 'stones', 'oasis'].indexOf(p.type) < 0 || R() > 0.75) continue;
    for (let k = 0; k < 30; k++) {
      const x = p.hub.x + Math.round((R() - 0.5) * 8), y = p.hub.y + Math.round((R() - 0.5) * 6), i = y * m.w + x;
      if (!m.inb(x, y) || m.solid[i] || m.water[i] || m.road[i] || m.entr.has(i) || m.glyph[i]) continue;
      Combat.placeLive(m, x, y, 'key');
      break;
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
  if (e.repeat || game.mode !== 'world' || CoopUI.isOpen() || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.code === 'KeyQ') Combat.cycle(1);
  if (e.code === 'KeyE') Combat.cycleAbility();
  if (e.code === 'KeyF' || e.code === 'KeyJ') Combat.attack(null);
});
