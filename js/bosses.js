'use strict';
// ---------------------------------------------------------------------------
// Bosses: seven big foes, one per arena out in the world. Arena gates take
// two keys. Each boss cycles through a short list of moves (bolt rings,
// spirals, aimed fans, lobbed volleys, dashes, ground slams, summons,
// blinks) and speeds up below half health. Beating one is remembered, and
// drops keys, a weapon and a full heal.
// ---------------------------------------------------------------------------

defGlyph('b_golem', bob([
  '....11111111....', '...1111111111...', '...1133113311...', '...1111111111...', '....12222221....', '.11111111111111.',
  '1111111111111111', '11.1111441111.11', '11.1111111111.11', '11.1112222111.11', '111.11111111.111', '.11.11111111.11.',
  '....111..111....', '....111..111....', '...1111..1111...', '...2222..2222...']), ['#8a8aa0', '#5a5a70', '#1a1a22', '#4aa040']);
defGlyph('b_wyrm', bob([
  '..........11....', '.........1111...', '...1....113114..', '..111..1111111..', '.11.1111111.....', '.1..11111111....',
  '...111122111.1..', '..11112222111.1.', '.111112222111.11', '.11111222211111.', '1111.1122111111.', '11...111111..11.',
  '1....11..11...1.', '.....11..11.....', '....111..111....', '....33...33.....']), ['#c8401a', '#ffb040', '#3a1008', '#1a0a04']);
defGlyph('b_frost', bob([
  '...1..1..1..1...', '...11.11.11.11..', '....11111111....', '.....122221.....', '.....133331.....', '.....122221.....',
  '......1221......', '....11111111....', '...1144444411...', '..114444444411..', '..1.44444444.1..', '....44444444....',
  '...4444444444...', '..444444444444..', '.44444444444444.', '4444444444444444']), ['#bff4ff', '#e8fcff', '#2a4a7a', '#5ab8e8']);
defGlyph('b_queen', bob([
  '1..............1', '.1....1111....1.', '..1..111111..1..', '...1.122221.1...', '1...11111111...1', '.1.1111111111.1.',
  '..111111111111..', '1.111144441111.1', '.11114444441111.', '..111144441111..', '.1.1111111111.1.', '1...11111111...1',
  '...1..1111..1...', '..1....11....1..', '.1............1.', '1..............1']), ['#3a5a2a', '#8ad84a', '#1a1a1a', '#c8302a']);
defGlyph('b_titan', bob([
  '......1111......', '.....111111.....', '.....122221.....', '.....111111.....', '..33333333333...', '.3343334333433..',
  '.3333333333333..', '.3355555555533..', '..33333333333...', '...333...333....', '...333...333....', '..4444...4444...',
  '..4..4...4..4...', '..4444...4444...', '................', '................']), ['#ff7a1a', '#1a1a1a', '#e8e0d0', '#2a2a30', '#ffd84a']);
defGlyph('b_eye', bob([
  '.....111111.....', '...1111111111...', '..111111111111..', '.11112222221111.', '.11122333322111.', '1112233443322111',
  '1112234444322111', '1112234444322111', '1112233443322111', '.11122333322111.', '.11112222221111.', '..111111111111..',
  '...1111111111...', '..5.5.5..5.5.5..', '.5..5..55..5..5.', '5...5...5...5..5']), ['#f2eee8', '#7a3ad8', '#2a0a3a', '#0a0010', '#a86ae8']);
defGlyph('b_knight', bob([
  '.......11.......', '......1111......', '.....111111.....', '.....122221.....', '.....111111.....', '..3..111111..3..',
  '.333111111111333', '.3.1111441111.3.', '...1114444111...', '...1114444111...', '...1111441111...', '....11111111....',
  '....111..111....', '....111..111....', '...1111..1111...', '...3333..3333...']), ['#4a4a66', '#14141e', '#a88aff', '#e8e4d8']);

// eyes for each boss sprite (red and glowing, like every enemy)
addRedEyes('b_golem', [[5, 2], [6, 2], [9, 2], [10, 2]]);
addRedEyes('b_wyrm', [[11, 2]]);
addRedEyes('b_frost', [[7, 4], [8, 4]]);
addRedEyes('b_queen', [[6, 3], [9, 3]]);
addRedEyes('b_titan', [[6, 2], [9, 2]]);
addRedEyes('b_eye', [[7, 6], [8, 6], [7, 7], [8, 7]]);
addRedEyes('b_knight', [[6, 3], [9, 3]]);

// moves: ring (burst of bolts all round), spiral (rotating stream), spread
// (aimed fan), lob (volley of arcing shots), dash (charge at you), slam
// (telegraphed shockwave), summon (minions), blink (teleport next to you)
const BOSSES = [
  { g: 'b_golem', name: 'STONE COLOSSUS', hp: 70, dmg: 2, spd: 2.2, col: '#c8c8d8', moves: ['slam', 'ring', 'lob', 'slam', 'spread'],
    arena: { floor: ['#2a2a32', '#23232a', '#383844'], wallBg: '#121218', wall: 'brickStone', torch: 'torch', amb: [0.5, 0.48, 0.52], parts: ['dust'] } },
  { g: 'b_wyrm', name: 'CINDER WYRM', hp: 80, dmg: 2, spd: 2.6, col: '#ff7a2a', moves: ['spread', 'dash', 'lob', 'ring'],
    arena: { floor: ['#2a1410', '#22100c', '#4a1a0c'], wallBg: '#140806', wall: 'brickRed', torch: 'brazier', amb: [0.55, 0.38, 0.32], parts: ['ember'] } },
  { g: 'b_frost', name: 'FROST MATRIARCH', hp: 85, dmg: 2, spd: 1.8, col: '#8ae8ff', summon: 'c_slime', moves: ['spiral', 'ring', 'summon', 'spread'],
    arena: { floor: ['#16263a', '#122030', '#2a4a6a'], wallBg: '#08101a', wall: 'brickIce', torch: 'torchBlue', amb: [0.42, 0.5, 0.62], parts: ['snow'] } },
  { g: 'b_queen', name: 'BROOD QUEEN', hp: 90, dmg: 2, spd: 2.4, col: '#8ad84a', summon: 'c_spider', moves: ['summon', 'spread', 'dash', 'lob'],
    arena: { floor: ['#1a2214', '#141a10', '#2a3a1a'], wallBg: '#0a0e08', wall: 'caveRockBrown', torch: 'torchGreen', amb: [0.44, 0.5, 0.4], parts: ['spore'] } },
  { g: 'b_titan', name: 'GRIDLOCK TITAN', hp: 95, dmg: 2, spd: 2.4, col: '#ffd84a', summon: 'c_cone', moves: ['dash', 'lob', 'ring', 'summon', 'dash'],
    arena: { floor: ['#26262c', '#1e1e24', '#3a3a20'], wallBg: '#0e0e12', wall: 'brickDark', torch: 'lantern', amb: [0.52, 0.5, 0.46], parts: ['dust'] } },
  { g: 'b_eye', name: 'THE WATCHER', hp: 100, dmg: 2, spd: 1.6, col: '#c86aff', moves: ['spiral', 'blink', 'spread', 'ring', 'blink'],
    arena: { floor: ['#1e1230', '#180e26', '#3a1a5a'], wallBg: '#0a0612', wall: 'brickPurple', torch: 'torchBlue', amb: [0.46, 0.4, 0.58], parts: ['mote'] } },
  { g: 'b_knight', name: 'HOLLOW KING', hp: 120, dmg: 3, spd: 2.6, col: '#a88aff', summon: 'c_ghost', moves: ['dash', 'ring', 'slam', 'summon', 'spiral'],
    arena: { floor: ['#1a1a24', '#14141c', '#2a2440'], wallBg: '#08080e', wall: 'brickStone', torch: 'torchGreen', amb: [0.44, 0.42, 0.52], parts: ['wisp'] } },
];
BOSSES.forEach((b, i) => {
  ENEMY_DEF[b.g] = { hp: b.hp, dmg: b.dmg, beh: 'boss' };
  SHOTS['bb' + i] = { spd: 100, dmg: b.dmg - 1 || 1, cd: 0, range: 16, col: b.col };
  SHOTS['bl' + i] = { lob: true, dmg: b.dmg, cd: 0, range: 12, col: b.col };
  b.i = i;
});

// --- the arena interior ---------------------------------------------------------------
function genArena(seed, ent) {
  const bi = ((ent.poi && ent.poi.boss) || 0) % BOSSES.length, BD = BOSSES[bi], A = BD.arena;
  const W = 46, H = 38, R = mulberry32(seed);
  const m = new TileMap(W, H, { kind: 'interior', voidColor: '#000000', bgPal: [A.floor[0], A.floor[1], A.wallBg, A.floor[2]], ambient: A.amb });
  const floor = new Uint8Array(W * H), cx = W >> 1, cy = (H >> 1) + 1;
  const rx = W / 2 - 2.5, ry = H / 2 - 3.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry, d = Math.sqrt(dx * dx + dy * dy), i = y * W + x;
    if (d < 1 && y >= 2) {
      floor[i] = 1;
      m.bg[i] = d < 0.16 ? 3 : (Math.floor(d * 7) % 2 ? 1 : 0);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (floor[i]) continue;
    m.solid[i] = 1; m.bg[i] = 2;
    if (wallEdge(floor, W, H, x, y)) {
      const below = y < H - 1 && floor[i + W];
      m.glyph[i] = G[below && R() < 0.16 ? A.torch : A.wall];
    }
  }
  // exit door in the bottom wall
  let dy = H - 1;
  while (dy > 0 && !floor[(dy - 1) * W + cx]) dy--;
  const di = dy * W + cx;
  m.glyph[di] = G.door; m.solid[di] = 0; m.entr.set(di, EXIT);
  m.spawn = { x: cx, y: dy - 1 };
  // a ring of pillars and four braziers, leaving the middle wide open
  const at = (r, a) => [Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r)];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.sin(a) > 0.6 && Math.abs(Math.cos(a)) < 0.5) continue; // keep the approach from the door clear
    const [x, y] = at(0.72, a), i = y * W + x;
    if (floor[i] && !m.entr.has(i)) { m.glyph[i] = G.pillar; m.solid[i] = 1; }
  }
  for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    const [x, y] = at(0.45, a), i = y * W + x;
    if (floor[i]) { m.glyph[i] = G.brazier; m.solid[i] = 1; }
  }
  ensureReachable(m, floor);
  m.wall = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) m.wall[i] = !floor[i] && !m.entr.has(i) ? 1 : 0;
  if (!Combat.bossDown.has(String(ent.id))) {
    const c = makeCreature(BD.g, cx, cy - 4, -1, R);
    c.boss = BD; c.r = 11; c.atkCd = 2.5; c.mi = 0; c.spin = 0; c.wait = 1;
    m.creatures.push(c);
  }
  m.dream = { name: 'arena', parts: A.parts, fx: {}, light: 1.2 };
  m.finalize();
  return m;
}

// --- boss behaviour (runs where we are the enemy authority) ---------------------------
const Bosses = {
  update(dt, m) {
    for (const c of m.creatures) {
      if (!c.boss || c.dead) continue;
      if (c.boss.world) { WorldBosses.tick(c, dt); continue; }
      const B = c.boss, cx = c.px + 4, cy = c.py + 4;
      const tgt = Combat.nearestPlayer(cx, cy, 30 * TS, true);
      if (c.dash > 0) c.dash -= dt;
      if (c.burst) this.burst(c, dt, cx, cy);
      if (c.slamT > 0) {
        c.slamT -= dt; c.flash = Math.max(c.flash || 0, 0.15);
        if (c.slamT <= 0) this.slam(c, cx, cy);
      }
      if (!tgt) continue;
      const enraged = c.hp < c.maxhp * 0.5;
      if (enraged && !c.enraged) { c.enraged = true; Powers.rings.push({ x: cx, y: cy, r: 4, vr: 120, life: 0.6, max: 0.6, k: 'ember' }); }
      c.atkCd -= dt * (enraged ? 1.5 : 1);
      if (c.atkCd > 0) continue;
      const move = B.moves[c.mi++ % B.moves.length];
      c.atkCd = 1.7 + Math.random() * 0.8;
      this.act(c, move, cx, cy, tgt, enraged);
    }
  },
  shoot(c, cx, cy, a, lob) { Combat.enemyShot(cx, cy, cx + Math.cos(a) * 100, cy + Math.sin(a) * 100, (lob ? 'bl' : 'bb') + c.boss.i, true); },
  act(c, move, cx, cy, tgt, enraged) {
    const B = c.boss, m = game.map, aim = Math.atan2(tgt[1] - cy, tgt[0] - cx);
    switch (move) {
      case 'ring': {
        const n = enraged ? 20 : 14;
        for (let k = 0; k < n; k++) this.shoot(c, cx, cy, (k / n) * Math.PI * 2 + c.spin);
        c.spin += 0.35;
        break;
      }
      case 'spiral': c.burst = { n: enraged ? 22 : 14, t: 0, a: aim }; break;
      case 'spread': {
        const n = enraged ? 7 : 5;
        for (let k = 0; k < n; k++) this.shoot(c, cx, cy, aim + (k - (n - 1) / 2) * 0.2);
        break;
      }
      case 'lob': {
        const n = enraged ? 6 : 4;
        for (let k = 0; k < n; k++) {
          const jx = tgt[0] + (Math.random() - 0.5) * 40, jy = tgt[1] + (Math.random() - 0.5) * 40;
          Combat.enemyShot(cx, cy, jx, jy, 'bl' + B.i, true);
        }
        break;
      }
      case 'dash': c.dash = enraged ? 1.6 : 1.1; c.wait = 0; Sound.sfx('flash'); break;
      case 'slam': c.slamT = 0.7; break;
      case 'summon': {
        if (!B.summon) { this.act(c, 'ring', cx, cy, tgt, enraged); break; }
        const minions = m.creatures.filter((q) => q.minion && !q.dead).length;
        for (let k = 0; k < (enraged ? 3 : 2) && minions + k < 6; k++) {
          for (let t = 0; t < 12; t++) {
            const x = c.x + Math.round((Math.random() - 0.5) * 6), y = c.y + Math.round((Math.random() - 0.5) * 6);
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
      case 'blink': {
        const p = game.player;
        for (let t = 0; t < 30; t++) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 3;
          const x = Math.round(p.x + Math.cos(a) * r), y = Math.round(p.y + Math.sin(a) * r);
          if (m.blocked(x, y) || m.entr.has(y * m.w + x)) continue;
          for (let n = 0; n < 16; n++) spawnParticle('beamSpark', cx, cy, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.5, B.col);
          c.x = c.fx = x; c.y = c.fy = y; c.t = 1; c.moving = false; c.px = x * TS; c.py = y * TS;
          c.atkCd = 0.6; Sound.sfx('flash');
          break;
        }
        break;
      }
    }
  },
  burst(c, dt, cx, cy) {
    const b = c.burst;
    b.t -= dt;
    if (b.t > 0) return;
    b.t = 0.09;
    for (let k = 0; k < 3; k++) this.shoot(c, cx, cy, b.a + k * Math.PI * 2 / 3);
    b.a += 0.32;
    if (--b.n <= 0) c.burst = null;
  },
  slam(c, cx, cy) {
    Powers.rings.push({ x: cx, y: cy, r: 4, vr: 160, life: 0.35, max: 0.35, k: 'spark' });
    Powers.shake = Math.max(Powers.shake, 3); Sound.sfx('impact', 1);
    for (let n = 0; n < 24; n++) { const a = Math.random() * Math.PI * 2; spawnParticle('beamSpark', cx, cy, Math.cos(a) * 110, Math.sin(a) * 110, 0.5, c.boss.col); }
    const p = game.player;
    if (Math.hypot(p.px + 4 - cx, p.py + 4 - cy) < 40) Combat.hurt(c.boss.dmg);
    for (let k = 0; k < 10; k++) this.shoot(c, cx, cy, (k / 10) * Math.PI * 2);
  },
  // a boss falls: remember it, then keys, a weapon and a full heal
  defeated(c) {
    if (c.boss.world) { WorldBosses.defeated(c); return; }
    const m = game.map, B = c.boss;
    if (game.ret) Combat.bossDown.add(String(game.ret.id));
    for (const q of m.creatures) if (q.minion && !q.dead) Combat.kill(q);
    Combat.hp = Combat.maxHp(); Combat.showHearts();
    m.items = m.items || [];
    m.items.push({ x: c.x, y: c.y, id: pickItem([], Math.random()), pop: 0.8 });
    Powers.rings.push({ x: c.px + 4, y: c.py + 4, r: 4, vr: 140, life: 0.9, max: 0.9, k: 'prism' });
    Powers.shake = Math.max(Powers.shake, 4);
    Sound.sfx('levelup');
    setTimeout(() => Combat.addKey(2), 1400);
    Combat.save();
  },
};
