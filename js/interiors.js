'use strict';
// ---------------------------------------------------------------------------
// Interior generation: caves (cellular automata), dungeons/crypts (rooms and
// corridors), and hand-shaped rooms for houses, hollow trees, temples and
// towers. Each returns a TileMap with .spawn and an exit entrance.
// ---------------------------------------------------------------------------

const EXIT = { exit: true };
// the golden ladder in a trophy room climbs straight back to the surface
const EXIT_SURFACE = { exit: true, surface: true };

variant('stairsGold', 'stairsDown', ['#ffd84a'], { light: { c: '#ffc040', r: 30, i: 0.9, f: 0.1, ox: 4, oy: 4 } });
variant('ladderGold', 'ladder', ['#ffd84a'], { light: { c: '#ffd060', r: 40, i: 1.1, f: 0.1, ox: 4, oy: 4 } });
// a shaft of daylight: a rare way out that comes up somewhere else entirely
defGlyph('caveLight', [
  ['.1.11.1.', '11111111', '12222221', '12222221', '.122221.', '.122221.', '..1221..', '...11...'],
  ['1.11.1.1', '11111111', '12222221', '12222221', '.122221.', '.122221.', '..1221..', '...11...'],
], ['#8ad8ff', '#ffffff'], { anim: 2, emit: true, light: { c: '#cfefff', r: 44, i: 1.1, f: 0.15, ox: 4, oy: 4 } });

// Interiors that keep going down: each level has a glowing stairway to the
// next, up to DEEP_MAX levels below the surface.
const DEEP = { cave: 1, icecave: 1, dungeon: 1, crypt: 1, mine: 1 };
const DEEP_MAX = 3;

function genInterior(ent) {
  const depth = ent.depth || 0;
  const seed = (ent.seed + depth * 91733) >>> 0;
  let m;
  switch (ent.type) {
    case 'cave': m = genCave(seed, false, null, depth); break;
    case 'icecave': m = genCave(seed, true, null, depth); break;
    case 'mine': m = genCave(seed, false, 'mine', depth); break;
    case 'dungeon': m = genDungeon(seed, false); break;
    case 'crypt': m = genDungeon(seed, true); break;
    case 'house': case 'hollow': case 'temple': case 'tower': case 'castle': case 'lighthouse':
    case 'firetemple': case 'worldtree': case 'wreck': case 'witch':
      m = genRoom(seed, ent.type); break;
    case 'arena': m = genArena(seed, ent); break;
    case 'trophy': m = genTrophy(seed, ent); break;
    default: m = genCave(seed, false, null, depth);
  }
  markWalls(m);
  const plain = ent.type === 'arena' || ent.type === 'trophy'; // these keep their own look
  if (!plain) applyDream(m, ent, seed);
  seedInteriorOrb(m, m.dream.name, seed);
  if (ent.type !== 'arena') seedInteriorItems(m, ent.type === 'trophy' ? { type: ent.parent } : ent, seed);
  if (HOMEY[ent.type]) {
    // homes are safe: no enemies, and about half have a special trader
    m.creatures = m.creatures.filter((c) => !ENEMY_DEF[GLYPHS[c.g].name]);
    if (hash2(ent.id | 0, 41, ent.seed) < 0.5) addTrader(m, seed);
  }
  Combat.number(m);
  m.finalize();
  if (depth && !plain) m.ambient = m.ambient.map((a) => a * Math.pow(0.8, depth));
  // every level leads on: down a stairway, and from the deepest one into a trophy room
  if (DEEP[ent.type]) addStairsDown(m, ent, depth, seed, depth >= DEEP_MAX);
  if (DEEP[ent.type] && hash2(String(ent.id).length * 97 + depth, 61, ent.seed) < 0.1) addCaveExit(m, ent, seed);
  return m;
}

// Homely interiors: never any enemies inside.
const HOMEY = { house: 1, hollow: 1, witch: 1, lighthouse: 1 };

// Wall cells (before any dream re-skin) so the baker can rim them with a
// light edge where they meet the floor; dark rooms stay readable.
function markWalls(m) {
  if (m.wall) return;
  m.wall = new Uint8Array(m.w * m.h);
  for (let i = 0; i < m.w * m.h; i++) m.wall[i] = m.bg[i] !== 0 && !m.water[i] && !m.entr.has(i) ? 1 : 0;
}

// A trader stands somewhere roomy (all eight neighbours open) away from the door.
function addTrader(m, seed) {
  const R = mulberry32(seed ^ 0x2b7e1516), W = m.w, cand = [];
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (Math.abs(x - m.spawn.x) + Math.abs(y - m.spawn.y) < 3) continue;
    let ok = true;
    for (let j = -1; j <= 1 && ok; j++) for (let k = -1; k <= 1; k++) {
      const i = (y + j) * W + x + k;
      if (m.solid[i] || m.entr.has(i) || m.water[i] || m.wall[i]) { ok = false; break; }
    }
    if (ok && !m.creatures.some((c) => c.x === x && c.y === y)) cand.push(y * W + x);
  }
  if (!cand.length) return;
  const i = cand[Math.floor(R() * cand.length)], x = i % W, y = (i / W) | 0;
  const c = makeCreature('c_trader', x, y, -1, R);
  c.npc = true; c.flip = x > m.spawn.x;
  m.creatures.push(c);
  m.solid[i] = 1;
}

function addStairsDown(m, ent, depth, seed, trophy) {
  const R = mulberry32(seed + 5);
  const d = bfsFrom(m, m.spawn.x, m.spawn.y);
  let max = 0;
  for (const v of d) if (v > max) max = v;
  const cand = [];
  for (let i = 0; i < d.length; i++) if (d[i] > max * 0.55 && !m.glyph[i] && !m.solid[i] && !m.entr.has(i)) cand.push(i);
  if (!cand.length) return;
  const i = cand[Math.floor(R() * cand.length)];
  const x = i % m.w, y = (i / m.w) | 0;
  if (trophy) m.entr.set(i, { id: ent.id + '>T', type: 'trophy', parent: ent.type, seed: ent.seed, depth: depth + 1 });
  else m.entr.set(i, { id: ent.id + '>' + (depth + 1), type: ent.type, seed: ent.seed, depth: depth + 1, locked: hash2(depth, 3, seed) < 0.4 });
  Combat.placeLive(m, x, y, trophy ? 'stairsGold' : 'stairsDown');
}

// A rare shaft of daylight: leaving through it brings you up on a road in a
// different biome, far from where you went in.
function addCaveExit(m, ent, seed) {
  const R = mulberry32(seed ^ 0x6c8e9cf5), W = m.w, cand = [];
  const d = bfsFrom(m, m.spawn.x, m.spawn.y);
  for (let i = W; i < d.length - W; i++) {
    if (d[i] < 8 || m.solid[i] || m.glyph[i] || m.entr.has(i) || m.water[i]) continue;
    if (m.solid[i - W] && !m.water[i - W]) cand.push(i);
  }
  if (!cand.length || !game.world) return;
  const w = game.world.map, from = ent.ret || game.stack[0] || game.world.start;
  const fromB = w.biome[from.y * w.w + from.x];
  let warp = null;
  for (let t = 0; t < 4000 && !warp; t++) {
    const x = 2 + Math.floor(R() * (w.w - 4)), y = 2 + Math.floor(R() * (w.h - 4)), j = y * w.w + x;
    if (!w.road[j] || (w.road[j] & R_DOT) || w.solid[j] || w.water[j] || w.entr.has(j)) continue;
    if (w.biome[j] === fromB || Math.abs(x - from.x) + Math.abs(y - from.y) < 120) continue;
    warp = { x, y };
  }
  if (!warp) return;
  const i = cand[Math.floor(R() * cand.length)];
  m.entr.set(i, { exit: true, warp });
  Combat.placeLive(m, i % W, (i / W) | 0, 'caveLight');
  const ck = m.chunks[((((i / W) | 0) / CH) | 0) * m.cw + (((i % W) / CH) | 0)];
  ck.emit = ck.emit.filter((k) => k !== i); ck.anim.push(i); // animated, so it is drawn each frame instead
}

// The end of a deep dungeon: a gilded hall of chests, pedestals, keys and an
// orb, with the way you came in and a golden ladder straight to the surface.
function genTrophy(seed, ent) {
  const W = 25, H = 19, R = mulberry32(seed ^ 0x7a0f11e5);
  const m = new TileMap(W, H, { kind: 'interior', voidColor: '#000000', bgPal: ['#3a2a10', '#2e2008', '#140e06', '#5a4214'], ambient: [0.62, 0.55, 0.42] });
  const floor = new Uint8Array(W * H), cx = W >> 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, f = x >= 1 && x < W - 1 && y >= 2 && y < H - 1;
    floor[i] = f ? 1 : 0;
    if (f) { m.bg[i] = Math.abs(x - cx) <= 1 ? 3 : (x + y) % 2; continue; }
    m.solid[i] = 1; m.bg[i] = 2;
    if (wallEdge(floor, W, H, x, y) || floor[i + W] || floor[i + 2 * W]) m.glyph[i] = G.wallStone;
  }
  // in by a plain ladder at the bottom, out by the golden one at the top
  const di = (H - 1) * W + cx;
  m.glyph[di] = G.ladder; m.solid[di] = 0; m.entr.set(di, EXIT);
  m.spawn = { x: cx, y: H - 2 };
  const ti = W + cx;
  m.glyph[ti] = G.ladderGold; m.solid[ti] = 0; m.entr.set(ti, EXIT_SURFACE);
  const put = (x, y, name, sol) => { const i = y * W + x; m.glyph[i] = G[name]; m.solid[i] = sol ? 1 : 0; };
  for (const x of [3, 7, W - 8, W - 4]) put(x, 1, 'banner', 1);
  for (const x of [2, 9, W - 10, W - 3]) put(x, 1, 'torch', 1);
  for (const [x, y] of [[2, 3], [W - 3, 3], [2, H - 3], [W - 3, H - 3]]) put(x, y, 'brazier', 1);
  for (let y = 5; y < H - 3; y += 4) { put(5, y, 'pillar', 1); put(W - 6, y, 'pillar', 1); }
  for (const [x, y] of [[cx - 4, 5], [cx + 4, 5], [cx - 4, 10], [cx + 4, 10]]) put(x, y, 'chest', 1);
  put(cx - 2, 7, 'key', 0); put(cx + 2, 7, 'key', 0);
  m.items = [];
  const tags = [ent.parent || 'dungeon', 'cave'];
  for (const [x, y] of [[cx - 7, 8], [cx + 7, 8]]) { put(x, y, 'pedestal', 0); m.items.push({ x, y, id: pickItem(tags, R()) }); }
  m.dream = { name: 'trophy', parts: ['gold'], fx: {}, light: 0.8 };
  m.finalize();
  return m;
}

// After decorating, make sure every floor cell is reachable from the spawn by
// clearing any decoration that ended up sealing a passage.
function ensureReachable(m, floor) {
  const W = m.w, H = m.h, N = W * H;
  for (let pass = 0; pass < 40; pass++) {
    const seen = new Uint8Array(N), q = new Int32Array(N);
    let qh = 0, qt = 0;
    const s = m.spawn.y * W + m.spawn.x;
    seen[s] = 1; q[qt++] = s;
    while (qh < qt) {
      const i = q[qh++], x = i % W;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const j of nb) if (j >= 0 && j < N && !seen[j] && !m.solid[j]) { seen[j] = 1; q[qt++] = j; }
    }
    // any open floor cell that cannot be reached?
    const lost = new Uint8Array(N);
    let anyLost = false;
    for (let i = 0; i < N; i++) if (floor[i] && !seen[i] && !m.solid[i]) { lost[i] = 1; anyLost = true; }
    if (!anyLost) break;
    const adj = (i, arr) => { const x = i % W; return (x > 0 && arr[i - 1]) || (x < W - 1 && arr[i + 1]) || (i >= W && arr[i - W]) || (i + W < N && arr[i + W]); };
    let fixed = 0;
    // prefer clearing a decoration that sits between the reachable area and a lost pocket
    for (let i = 0; i < N; i++) {
      if (!floor[i] || !m.solid[i] || m.water[i]) continue;
      if (adj(i, seen) && adj(i, lost)) { m.solid[i] = 0; m.glyph[i] = 0; fixed++; }
    }
    if (!fixed) {
      for (let i = 0; i < N; i++) {
        if (!floor[i] || !m.solid[i] || m.water[i] || !adj(i, seen)) continue;
        m.solid[i] = 0; m.glyph[i] = 0; fixed++; break;
      }
    }
    if (!fixed) break;
  }
}

function caFloor(W, H, R, fill, iters) {
  let g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    g[y * W + x] = (x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || R() < fill) ? 1 : 0;
  for (let it = 0; it < iters; it++) {
    const ng = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) { ng[y * W + x] = 1; continue; }
      let c = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c += g[(y + j) * W + x + i];
      ng[y * W + x] = c >= 5 ? 1 : 0;
    }
    g = ng;
  }
  // keep the largest open region
  const comp = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H);
  let best = -1, bestN = 0;
  for (let s = 0; s < W * H; s++) {
    if (g[s] || comp[s] >= 0) continue;
    let qh = 0, qt = 0; q[qt++] = s; comp[s] = s;
    while (qh < qt) {
      const i = q[qh++];
      for (const j of [i - 1, i + 1, i - W, i + W]) if (!g[j] && comp[j] < 0) { comp[j] = s; q[qt++] = j; }
    }
    if (qt > bestN) { bestN = qt; best = s; }
  }
  const floor = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) floor[i] = (!g[i] && comp[i] === best) ? 1 : 0;
  return floor;
}

function wallEdge(floor, W, H, x, y) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const nx = x + i, ny = y + j;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H && floor[ny * W + nx]) return true;
  }
  return false;
}

function bfsFrom(m, sx, sy) {
  const W = m.w, N = W * m.h, d = new Int32Array(N).fill(-1), q = new Int32Array(N);
  let qh = 0, qt = 0;
  d[sy * W + sx] = 0; q[qt++] = sy * W + sx;
  while (qh < qt) {
    const i = q[qh++];
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && d[j] < 0 && !m.solid[j]) { d[j] = d[i] + 1; q[qt++] = j; }
  }
  return d;
}

function genCave(seed, ice, kind, depth) {
  const mine = kind === 'mine';
  depth = depth || 0;
  const W = 72, H = 54, R = mulberry32(seed);
  const floor = caFloor(W, H, R, 0.45, 5);
  const m = new TileMap(W, H, {
    kind: 'interior', voidColor: '#000000',
    bgPal: ice ? ['#0a1220', '#03050a', '#0e2440', '#16263a'] : mine ? ['#110d0a', '#040302', '#0a1630', '#221a14'] : ['#0b0d16', '#030305', '#0a1630', '#191b2c'],
    ambient: ice ? [0.3, 0.36, 0.5] : mine ? [0.26, 0.22, 0.2] : [0.22, 0.22, 0.32],
  });
  const crystal = ice ? 'crystalIce' : (R() < 0.5 ? 'crystal' : 'crystalPurple');
  const rock1 = ice ? 'caveRockIce' : 'caveRock', rock2 = ice ? 'caveRock2Ice' : mine ? 'caveRockOre' : 'caveRock2';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!floor[i]) {
      m.solid[i] = 1;
      if (wallEdge(floor, W, H, x, y)) { m.bg[i] = 3; m.glyph[i] = G[R() < 0.6 ? rock1 : rock2] | (R() < 0.5 ? FLIP : 0); }
      else m.bg[i] = 1;
    }
  }
  // exit ladder: a floor cell whose north neighbour is wall
  const cand = [];
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const i = y * W + x;
    if (floor[i] && floor[i + W] && floor[i + 2 * W] && !floor[i - W]) cand.push(i);
  }
  const ex = cand.length ? cand[Math.floor(R() * cand.length)] : floor.indexOf(1);
  const exX = ex % W, exY = (ex / W) | 0;
  m.spawn = { x: exX, y: exY + 1 };
  // pools of water
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!floor[i] || Math.abs(x - exX) + Math.abs(y - exY) < 6) continue;
    if (fbm(x * 0.09, y * 0.09, seed + 2, 3) > (mine ? 0.7 : 0.64)) {
      m.water[i] = 1; m.solid[i] = 1; m.bg[i] = 2;
      if (R() < 0.5) m.glyph[i] = G[ice ? 'waveIce' : 'waveCave'];
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!floor[i] || m.water[i] || Math.abs(x - exX) + Math.abs(y - exY) < 3) continue;
    const nearWall = !floor[i - 1] || !floor[i + 1] || !floor[i - W] || !floor[i + W];
    const r = R(), n = fbm(x * 0.12, y * 0.12, seed + 3, 2);
    const fl = R() < 0.5 ? FLIP : 0;
    if (nearWall && r < 0.035 + depth * 0.02) { m.glyph[i] = G[crystal] | fl; m.solid[i] = 1; }
    else if (r < 0.042 && n > 0.45) m.glyph[i] = G[ice ? 'crystalIce' : (R() < 0.6 ? 'glowShroom' : 'glowShroomPurple')] | fl;
    else if (r < 0.06) { m.glyph[i] = G[ice ? 'stalagIce' : 'stalagmite'] | fl; m.solid[i] = 1; }
    else if (n > 0.6 && r < 0.4) m.glyph[i] = G[ice ? 'dotgridIce' : 'grassCave'] | fl;
    else if (r < 0.09) m.glyph[i] = G.bone | fl;
    else if (r < 0.15) m.glyph[i] = G[ice ? 'speckSnow' : 'speckCave'];
  }
  m.glyph[ex] = G.ladder; m.solid[ex] = 0; m.entr.set(ex, EXIT);
  m.glyph[ex + W] = 0; m.solid[ex + W] = 0;
  ensureReachable(m, floor);
  const d = bfsFrom(m, m.spawn.x, m.spawn.y);
  let far = -1, fd = -1;
  for (let i = 0; i < W * H; i++) if (d[i] > fd && !m.glyph[i]) { fd = d[i]; far = i; }
  if (far >= 0) { m.glyph[far] = G.chest; m.solid[far] = 1; }
  let mid = -1;
  for (let t = 0; t < 400; t++) { const i = Math.floor(R() * W * H); if (d[i] > fd * 0.4 && !m.glyph[i]) { mid = i; break; } }
  if (mid >= 0) m.glyph[mid] = G.key;
  if (mine && far >= 0) {
    // lay rails from the ladder to the treasure, with lanterns along the way
    const path = [];
    let c = far;
    while (d[c] > 0) {
      path.push(c);
      let nxt = -1;
      for (const j of [c - 1, c + 1, c - W, c + W]) if (d[j] === d[c] - 1) { nxt = j; break; }
      if (nxt < 0) break;
      c = nxt;
    }
    path.push(c);
    const onPath = new Set(path);
    path.forEach((i, k) => {
      if (i === far || m.solid[i] || m.entr.has(i)) return;
      const a = path[k - 1], b = path[k + 1];
      const horiz = (a !== undefined && Math.abs(a - i) === 1) || (b !== undefined && Math.abs(b - i) === 1);
      m.glyph[i] = G[horiz ? 'railsH' : 'rails'];
      if (k % 9 === 4) {
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (floor[j] && !m.solid[j] && !onPath.has(j) && !m.glyph[j]) { m.glyph[j] = G[R() < 0.25 ? 'cart' : 'lantern']; m.solid[j] = 1; break; }
        }
      }
    });
    ensureReachable(m, floor);
  }
  spawnInteriorCreatures(m, R, ice ? ['c_bat', 'c_slime'] : mine ? ['c_bat', 'c_spider'] : ['c_bat', 'c_bat', 'c_slime', 'c_spider'], 7 + depth * 2);
  m.finalize();
  return m;
}

function genDungeon(seed, crypt) {
  const W = 64, H = 48, R = mulberry32(seed);
  const floor = new Uint8Array(W * H);
  const rooms = [];
  for (let t = 0; t < 300 && rooms.length < 12; t++) {
    const w = 5 + Math.floor(R() * 7), h = 4 + Math.floor(R() * 5);
    const x = 2 + Math.floor(R() * (W - w - 4)), y = 3 + Math.floor(R() * (H - h - 5));
    if (rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) floor[y * W + x] = 1;
  // chain rooms by nearest neighbour, plus a couple of loops
  const order = [rooms[0]], left = rooms.slice(1);
  while (left.length) {
    const last = order[order.length - 1];
    let bi = 0, bd = Infinity;
    left.forEach((r, k) => { const d = Math.abs(r.cx - last.cx) + Math.abs(r.cy - last.cy); if (d < bd) { bd = d; bi = k; } });
    order.push(left.splice(bi, 1)[0]);
  }
  const corridor = (a, b) => {
    let x = a.cx, y = a.cy;
    const horizFirst = R() < 0.5;
    const stepX = () => { while (x !== b.cx) { floor[y * W + x] = 1; x += Math.sign(b.cx - x); } };
    const stepY = () => { while (y !== b.cy) { floor[y * W + x] = 1; y += Math.sign(b.cy - y); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    floor[y * W + x] = 1;
  };
  for (let k = 1; k < order.length; k++) corridor(order[k - 1], order[k]);
  for (let k = 0; k < 2 && order.length > 3; k++) corridor(order[Math.floor(R() * order.length)], order[Math.floor(R() * order.length)]);
  const inRoom = (x, y) => rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

  const m = new TileMap(W, H, {
    kind: 'interior', voidColor: crypt ? '#0a0a12' : '#0f0f2a',
    bgPal: crypt ? ['#15151f', '#0a0a12'] : ['#1b1b45', '#10102c'],
    ambient: crypt ? [0.26, 0.28, 0.33] : [0.36, 0.36, 0.56],
  });
  const brick = crypt ? 'brickStone' : 'brick';
  const torch = crypt ? 'torchGreen' : 'torch';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (floor[i]) continue;
    m.solid[i] = 1;
    if (wallEdge(floor, W, H, x, y)) {
      m.bg[i] = 1;
      const below = y < H - 1 && floor[i + W];
      if (below && R() < 0.12) m.glyph[i] = G[torch];
      else m.glyph[i] = G[R() < 0.82 ? brick : 'caveRockDungeon'];
    } else m.bg[i] = 1;
  }
  const first = order[0], last = order[order.length - 1];
  // ladder in the top wall of the first room
  const lx = first.x + 1 + Math.floor(R() * (first.w - 2)), ly = first.y - 1;
  const li = ly * W + lx;
  m.glyph[li] = G.ladder; m.solid[li] = 0; m.entr.set(li, EXIT);
  m.spawn = { x: lx, y: ly + 1 };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!floor[i] || m.glyph[i] || (x === m.spawn.x && y === m.spawn.y)) continue;
    const r = R(), fl = R() < 0.5 ? FLIP : 0;
    const wallsN = !floor[i - W], wallsS = !floor[i + W], wallsW = !floor[i - 1], wallsE = !floor[i + 1];
    const corner = (wallsN || wallsS) && (wallsW || wallsE) && inRoom(x, y);
    const n = fbm(x * 0.15, y * 0.15, seed + 5, 2);
    if (corner && r < 0.55) m.glyph[i] = G.cobweb | fl;
    else if (n > 0.62 && r < 0.5) m.glyph[i] = G[crypt ? 'grassDark' : 'grassCave'] | fl;
    else if (r < 0.02) m.glyph[i] = G.bone | fl;
    else if (r < 0.03) m.glyph[i] = G[crypt ? 'skullBone' : 'skull'];
    else if (r < 0.036) m.glyph[i] = G.potion;
    else if (crypt && r < 0.05 && inRoom(x, y)) { m.glyph[i] = G[R() < 0.5 ? 'grave' : 'cross']; m.solid[i] = 1; }
    else if (r < 0.065 && inRoom(x, y)) { m.glyph[i] = G.caveRockDungeon | fl; m.solid[i] = 1; }
    else if (r < 0.13) m.glyph[i] = G.speckNavy;
  }
  // treasure room: chest flanked by braziers
  const cxi = last.cy * W + last.cx;
  m.glyph[cxi] = G.chest; m.solid[cxi] = 1;
  if (last.w >= 5) {
    m.glyph[cxi - 2] = G.brazier; m.solid[cxi - 2] = 1;
    m.glyph[cxi + 2] = G.brazier; m.solid[cxi + 2] = 1;
    m.glyph[cxi - 1] = 0; m.solid[cxi - 1] = 0; m.glyph[cxi + 1] = 0; m.solid[cxi + 1] = 0;
  }
  const kr = order[Math.min(order.length - 1, 1 + Math.floor(R() * (order.length - 1)))];
  const ki = (kr.y + Math.floor(R() * kr.h)) * W + kr.x + Math.floor(R() * kr.w);
  if (!m.solid[ki]) m.glyph[ki] = G.key;
  // doors where corridors meet rooms
  for (const r of rooms) {
    for (let x = r.x; x < r.x + r.w; x++) for (const y of [r.y - 1, r.y + r.h]) {
      const i = y * W + x;
      if (floor[i] && !inRoom(x, y) && !floor[i - 1] && !floor[i + 1] && R() < 0.6) m.glyph[i] = G.door;
    }
  }
  ensureReachable(m, floor);
  spawnInteriorCreatures(m, R, crypt ? ['c_ghost', 'c_ghost', 'c_spider', 'c_bat'] : ['c_spider', 'c_spider', 'c_slime', 'c_bat'], 7);
  m.finalize();
  return m;
}

// Single-room interiors drawn from a footprint mask.
function genRoom(seed, kind) {
  const R = mulberry32(seed);
  const cfg = {
    house: { W: 15, H: 11, bg: ['#24170f', '#140c08'], amb: [0.45, 0.36, 0.3], wall: 'wallWood' },
    hollow: { W: 21, H: 17, bg: ['#1a1209', '#0a0604'], amb: [0.32, 0.3, 0.26], wall: 'caveRockBrown' },
    temple: { W: 23, H: 19, bg: ['#1a0b0e', '#0a0405'], amb: [0.34, 0.2, 0.22], wall: 'brickRed' },
    tower: { W: 17, H: 15, bg: ['#141424', '#06060c'], amb: [0.32, 0.3, 0.42], wall: 'brickStone' },
    castle: { W: 27, H: 21, bg: ['#15131c', '#08070c'], amb: [0.36, 0.3, 0.3], wall: 'brickStone' },
    lighthouse: { W: 13, H: 13, bg: ['#16141a', '#08070a'], amb: [0.3, 0.3, 0.34], wall: 'brickStone' },
    firetemple: { W: 23, H: 19, bg: ['#160806', '#080302', '#2a0a04'], amb: [0.3, 0.16, 0.12], wall: 'brickRed' },
    worldtree: { W: 29, H: 23, bg: ['#1a1209', '#0a0604'], amb: [0.3, 0.3, 0.24], wall: 'caveRockBrown' },
    wreck: { W: 19, H: 11, bg: ['#1a120c', '#0a0604'], amb: [0.3, 0.3, 0.36], wall: 'wallWood' },
    witch: { W: 15, H: 11, bg: ['#120c18', '#08060c'], amb: [0.24, 0.2, 0.3], wall: 'wallWood' },
  }[kind];
  const ROUND = { hollow: 1, tower: 1, lighthouse: 1, worldtree: 1 };
  const W = cfg.W, H = cfg.H;
  const m = new TileMap(W, H, { kind: 'interior', voidColor: '#000000', bgPal: cfg.bg, ambient: cfg.amb });
  const floor = new Uint8Array(W * H);
  const cx = W >> 1, cy = H >> 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let f;
    if (!ROUND[kind]) f = x >= 1 && x < W - 1 && y >= 2 && y < H - 1;
    else {
      const dx = (x - cx) / (W / 2 - 1.2), dy = (y - cy) / (H / 2 - 1.2);
      f = dx * dx + dy * dy < 1 && y >= 2;
    }
    floor[y * W + x] = f ? 1 : 0;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (floor[i]) {
      m.bg[i] = 0;
      if (kind === 'house' && y % 2 === 0) m.glyph[i] = G.plank;
      continue;
    }
    m.solid[i] = 1;
    if (wallEdge(floor, W, H, x, y) || (y < H - 1 && floor[i + W]) || (y < H - 2 && floor[i + 2 * W])) {
      m.bg[i] = 1;
      const tree = kind === 'hollow' || kind === 'worldtree';
      m.glyph[i] = G[tree && R() < 0.4 ? 'root' : cfg.wall] | (tree && R() < 0.5 ? FLIP : 0);
    } else m.bg[i] = 1;
  }
  // exit door in the bottom wall
  let dy = H - 1;
  while (dy > 0 && !floor[(dy - 1) * W + cx]) dy--;
  const di = dy * W + cx;
  m.glyph[di] = G.door; m.solid[di] = 0; m.entr.set(di, EXIT);
  m.spawn = { x: cx, y: dy - 1 };
  const free = (x, y) => floor[y * W + x] && !m.solid[y * W + x] && !(Math.abs(x - cx) <= 1 && y >= dy - 2);
  const place = (x, y, name, sol) => { if (x > 0 && y > 0 && x < W && y < H && free(x, y)) { m.glyph[y * W + x] = G[name]; m.solid[y * W + x] = sol ? 1 : 0; return true; } return false; };
  const top = 2;
  const wallTop = (x, name) => { const i = (top - 1) * W + x; if (!floor[i]) { m.glyph[i] = G[name]; } };
  if (kind === 'house') {
    wallTop(cx, 'hearth');
    wallTop(2, 'shelf'); wallTop(W - 3, 'shelf');
    place(1, top, 'bed', 1); place(1, top + 1, 'bed', 1);
    place(W - 4, 5, 'table', 1); place(W - 3, 5, 'table', 1); place(W - 4, 4, 'candle', 1);
    place(W - 2, H - 2, 'barrel', 1); place(1, H - 2, 'barrel', 1); place(W - 2, top, 'pot', 1);
    for (let y = 4; y <= 6; y++) for (let x = cx - 2; x <= cx; x++) if (free(x, y)) m.glyph[y * W + x] = G.rug;
  } else if (kind === 'worldtree') {
    for (let t = 0; t < 30; t++) place(1 + Math.floor(R() * (W - 2)), 2 + Math.floor(R() * (H - 3)), R() < 0.5 ? 'glowShroom' : R() < 0.5 ? 'glowShroomPurple' : 'rootDark', 0);
    for (const [ox, oy] of [[-7, -5], [7, -5], [-9, 2], [9, 2], [-4, 6], [4, 6]]) place(cx + ox, cy + oy, 'lanternBlue', 1);
    place(cx, cy - 2, 'crystalBigLit', 1); place(cx - 2, cy - 1, 'crystalDim', 1); place(cx + 2, cy - 1, 'crystalDim', 1);
    place(cx - 6, cy, 'bookshelf', 1); place(cx + 6, cy, 'bookshelf', 1);
    place(cx + 5, cy + 3, 'table', 1); place(cx + 4, cy + 3, 'candle', 1); place(cx - 5, cy + 3, 'pot', 1);
    place(cx + 8, cy - 3, 'stairs', 1); place(cx - 1, cy + 4, 'chest', 1);
  } else if (kind === 'castle') {
    for (let x = 2; x < W - 2; x += 3) wallTop(x, x === cx ? 'banner' : (x % 2 ? 'torch' : 'banner'));
    place(cx, 3, 'throne', 1); place(cx - 2, 3, 'brazier', 1); place(cx + 2, 3, 'brazier', 1);
    place(cx + 4, 3, 'chest', 1); place(cx - 4, 3, 'chest', 1);
    for (let y = 4; y < H - 1; y++) if (free(cx, y) || (y >= dy - 2 && floor[y * W + cx])) m.glyph[y * W + cx] = G.rug;
    for (let y = 6; y < H - 3; y += 3) { place(cx - 4, y, 'pillar', 1); place(cx + 4, y, 'pillar', 1); }
    for (const sx of [3, W - 4]) { place(sx, 7, 'table', 1); place(sx, 6, 'candle', 1); place(sx, 12, 'table', 1); place(sx, 11, 'candle', 1); }
    place(1, H - 2, 'barrel', 1); place(W - 2, H - 2, 'barrel', 1); place(2, H - 2, 'barrel', 1);
  } else if (kind === 'lighthouse') {
    place(cx, cy - 1, 'lantern', 1); place(cx - 3, cy - 2, 'stairs', 1);
    place(cx + 3, cy - 1, 'table', 1); place(cx + 3, cy - 2, 'candle', 1);
    place(cx - 3, cy + 2, 'barrel', 1); place(cx + 3, cy + 2, 'anchor', 0); place(cx - 2, cy + 3, 'barrel', 1);
    for (let t = 0; t < 3; t++) place(1 + Math.floor(R() * (W - 2)), 3 + Math.floor(R() * (H - 4)), 'cobweb', 0);
  } else if (kind === 'firetemple') {
    for (const lx of [4, W - 5]) for (let y = 3; y < H - 2; y++) {
      const i = y * W + lx;
      if (!floor[i]) continue;
      m.glyph[i] = G[y % 4 === 1 ? 'lavaLit' : 'lava']; m.solid[i] = 1; m.water[i] = 1; m.bg[i] = 2;
    }
    place(cx, 3, 'altar', 1); place(cx - 2, 3, 'brazier', 1); place(cx + 2, 3, 'brazier', 1);
    for (let y = 6; y < H - 3; y += 4) { place(cx - 3, y, 'pillar', 1); place(cx + 3, y, 'pillar', 1); }
    for (let y = 5; y < H - 1; y++) if (free(cx, y) || (y >= dy - 2 && floor[y * W + cx])) m.glyph[y * W + cx] = G.runeFloor;
    place(2, 3, 'vent', 1); place(W - 3, 3, 'vent', 1); place(cx + 1, 4, 'chest', 1);
    for (let t = 0; t < 6; t++) place(1 + Math.floor(R() * (W - 2)), 4 + Math.floor(R() * (H - 5)), R() < 0.5 ? 'skullBone' : 'rockObsidian', 0);
  } else if (kind === 'wreck') {
    for (let x = 2; x < W - 2; x += 4) wallTop(x, 'lantern');
    for (let t = 0; t < 7; t++) place(1 + Math.floor(R() * (W - 2)), 3 + Math.floor(R() * (H - 4)), 'puddle', 0);
    place(W - 3, 3, 'chest', 1); place(2, 3, 'barrel', 1); place(3, 3, 'barrel', 1); place(2, 4, 'barrel', 1);
    place(W - 4, H - 3, 'anchor', 0); place(cx, 4, 'table', 1); place(cx + 1, 4, 'candle', 1);
    for (let t = 0; t < 4; t++) place(1 + Math.floor(R() * (W - 2)), 3 + Math.floor(R() * (H - 4)), R() < 0.5 ? 'cobweb' : 'bone', 0);
  } else if (kind === 'witch') {
    wallTop(2, 'shelf'); wallTop(W - 3, 'bookshelf'); wallTop(cx, 'shelf');
    place(cx, 5, 'cauldron', 1);
    for (const [x, y] of [[2, 3], [W - 3, 3], [2, H - 3], [W - 3, H - 3]]) place(x, y, R() < 0.5 ? 'pumpkin' : 'candle', 1);
    for (let t = 0; t < 6; t++) place(1 + Math.floor(R() * (W - 2)), 3 + Math.floor(R() * (H - 4)), R() < 0.5 ? 'potion' : 'skull', 0);
    place(W - 4, 6, 'table', 1); place(W - 4, 5, 'orb', 1);
  } else if (kind === 'hollow') {
    for (let t = 0; t < 14; t++) place(1 + Math.floor(R() * (W - 2)), 2 + Math.floor(R() * (H - 3)), R() < 0.6 ? 'glowShroom' : 'mushBrown', 0);
    for (let t = 0; t < 10; t++) place(1 + Math.floor(R() * (W - 2)), 2 + Math.floor(R() * (H - 3)), 'rootDark', 0);
    place(cx, cy, 'table', 1); place(cx - 1, cy, 'candle', 1);
    place(cx - 4, 3, 'lanternBlue', 1); place(cx + 4, 3, 'lanternBlue', 1);
    place(cx + 3, cy + 2, 'pot', 1); place(cx - 3, cy + 2, 'barrel', 1);
  } else if (kind === 'temple') {
    for (let y = 4; y < H - 3; y += 3) { place(4, y, 'pillar', 1); place(W - 5, y, 'pillar', 1); }
    for (let y = 4; y < H - 2; y += 3) { place(2, y, 'brazier', 1); place(W - 3, y, 'brazier', 1); }
    place(cx, 3, 'altar', 1); place(cx - 2, 3, 'candle', 1); place(cx + 2, 3, 'candle', 1);
    for (let y = 5; y < H - 1; y++) if (free(cx, y) || (y >= dy - 2 && floor[y * W + cx])) m.glyph[y * W + cx] = G.runeFloor;
    for (let t = 0; t < 8; t++) place(1 + Math.floor(R() * (W - 2)), 3 + Math.floor(R() * (H - 4)), 'skullBone', 0);
  } else if (kind === 'tower') {
    for (let x = 2; x < W - 2; x++) if (!floor[(top - 1) * W + x] && R() < 0.8) m.glyph[(top - 1) * W + x] = G.bookshelf;
    place(cx, cy - 1, 'orb', 1);
    place(cx - 3, cy - 2, 'candle', 1); place(cx + 3, cy - 2, 'candle', 1);
    place(cx + 4, cy + 2, 'stairs', 1); place(cx - 4, cy + 1, 'table', 1); place(cx - 4, cy, 'potion', 0);
    for (let y = cy; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 1; x++) if (free(x, y)) m.glyph[y * W + x] = G.runeBlue;
    for (let t = 0; t < 4; t++) place(2 + Math.floor(R() * (W - 4)), 3 + Math.floor(R() * (H - 5)), 'cobweb', 0);
  }
  ensureReachable(m, floor);
  if (kind === 'house' && R() < 0.8) spawnInteriorCreatures(m, R, ['c_cat'], 1);
  if (kind === 'hollow' || kind === 'worldtree') spawnInteriorCreatures(m, R, ['c_frog', 'c_slime', 'c_rabbit'], kind === 'hollow' ? 2 : 5);
  if (kind === 'witch') spawnInteriorCreatures(m, R, ['c_cat', 'c_bat'], 2);
  if (kind === 'wreck') spawnInteriorCreatures(m, R, ['c_octo', 'c_frog'], 2);
  if (kind === 'castle') spawnInteriorCreatures(m, R, ['c_cat', 'c_ghost'], 2);
  m.finalize();
  return m;
}

function spawnInteriorCreatures(m, R, list, n) {
  for (let t = 0; t < 400 && n > 0; t++) {
    const x = Math.floor(R() * m.w), y = Math.floor(R() * m.h), i = y * m.w + x;
    if (m.solid[i] || m.entr.has(i) || Math.abs(x - m.spawn.x) + Math.abs(y - m.spawn.y) < 5) continue;
    m.creatures.push(makeCreature(list[Math.floor(R() * list.length)], x, y, -1, R));
    n--;
  }
}
