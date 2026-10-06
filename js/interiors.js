'use strict';
// ---------------------------------------------------------------------------
// Interior generation: caves (cellular automata), dungeons/crypts (rooms and
// corridors), and hand-shaped rooms for houses, hollow trees, temples and
// towers. Each returns a TileMap with .spawn and an exit entrance.
// ---------------------------------------------------------------------------

const EXIT = { exit: true };

function genInterior(ent) {
  switch (ent.type) {
    case 'cave': return genCave(ent.seed, false);
    case 'icecave': return genCave(ent.seed, true);
    case 'dungeon': return genDungeon(ent.seed, false);
    case 'crypt': return genDungeon(ent.seed, true);
    case 'house': return genRoom(ent.seed, 'house');
    case 'hollow': return genRoom(ent.seed, 'hollow');
    case 'temple': return genRoom(ent.seed, 'temple');
    case 'tower': return genRoom(ent.seed, 'tower');
  }
  return genCave(ent.seed, false);
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

function genCave(seed, ice) {
  const W = 72, H = 54, R = mulberry32(seed);
  const floor = caFloor(W, H, R, 0.45, 5);
  const m = new TileMap(W, H, {
    kind: 'interior', voidColor: '#000000',
    bgPal: ice ? ['#0a1220', '#03050a', '#0e2440', '#16263a'] : ['#0b0d16', '#030305', '#0a1630', '#191b2c'],
    ambient: ice ? [0.3, 0.36, 0.5] : [0.22, 0.22, 0.32],
  });
  const crystal = ice ? 'crystalIce' : (R() < 0.5 ? 'crystal' : 'crystalPurple');
  const rock1 = ice ? 'caveRockIce' : 'caveRock', rock2 = ice ? 'caveRock2Ice' : 'caveRock2';
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
    if (fbm(x * 0.09, y * 0.09, seed + 2, 3) > 0.64) {
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
    if (nearWall && r < 0.035) { m.glyph[i] = G[crystal] | fl; m.solid[i] = 1; }
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
  spawnInteriorCreatures(m, R, ice ? ['c_bat', 'c_slime'] : ['c_bat', 'c_bat', 'c_slime', 'c_spider'], 7);
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
      m.bg[i] = 0;
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
  }[kind];
  const W = cfg.W, H = cfg.H;
  const m = new TileMap(W, H, { kind: 'interior', voidColor: '#000000', bgPal: cfg.bg, ambient: cfg.amb });
  const floor = new Uint8Array(W * H);
  const cx = W >> 1, cy = H >> 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let f;
    if (kind === 'house' || kind === 'temple') f = x >= 1 && x < W - 1 && y >= 2 && y < H - 1;
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
      m.glyph[i] = G[kind === 'hollow' && R() < 0.4 ? 'root' : cfg.wall] | (kind === 'hollow' && R() < 0.5 ? FLIP : 0);
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
  if (kind === 'hollow') spawnInteriorCreatures(m, R, ['c_frog', 'c_slime'], 2);
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
