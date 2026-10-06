'use strict';
// ---------------------------------------------------------------------------
// Overworld generation: continent mask -> warped Voronoi biome regions ->
// rivers -> per-biome glyph fill -> points of interest -> A* road network.
// ---------------------------------------------------------------------------

const B = { OCEAN: 0, PLAINS: 1, GRASS: 2, FOREST: 3, TAIGA: 4, LAKE: 5, DUNES: 6, MOUNT: 7, SNOW: 8, SPOOKY: 9, MUSH: 10, MARSH: 11, PINK: 12,
  VOLCANO: 13, CRYSTAL: 14, AUTUMN: 15 };
const BG_LAKE = 16, BG_RIVER = 17, BG_VOID = 18, BG_REDWATER = 19, BG_ICE = 20, BG_PLAZA = 21, BG_LAVA = 22;
const OW_BG = ['#030710', '#060708', '#060b07', '#050b07', '#0b1310', '#04080f', '#0d0805', '#08080a', '#0b0e13', '#03070a',
  '#090c05', '#0c0507', '#0e070b', '#0e0605', '#09071a', '#0c0805',
  '#061226', '#061328', '#000000', '#1c0609', '#0d1828', '#0b0a08', '#2a0a04'];

// Ambient multiplier per biome (spooky forests are darker, etc.)
const BIOME_AMB = [1, 1, 1, 0.95, 0.9, 1, 1.05, 0.97, 1.05, 0.7, 0.93, 0.86, 1, 0.86, 0.78, 0.97];

const CREATURE_TABLE = {
  [B.PLAINS]: ['c_rabbit', 'c_bird', 'c_cat'], [B.GRASS]: ['c_rabbit', 'c_deer', 'c_bird'],
  [B.FOREST]: ['c_deer', 'c_fox', 'c_bear'], [B.TAIGA]: ['c_deer', 'c_fox', 'c_bird'],
  [B.LAKE]: ['c_frog', 'c_octo'], [B.DUNES]: ['c_lizard', 'c_dragon'], [B.MOUNT]: ['c_dragon', 'c_bird'],
  [B.SNOW]: ['c_rabbit', 'c_bear'], [B.SPOOKY]: ['c_ghost', 'c_bat', 'c_spider'], [B.MUSH]: ['c_frog', 'c_slime'],
  [B.MARSH]: ['c_frog', 'c_bird'], [B.PINK]: ['c_octo', 'c_cat', 'c_rabbit'],
  [B.VOLCANO]: ['c_lizard', 'c_dragon', 'c_bat'], [B.CRYSTAL]: ['c_slime', 'c_ghost', 'c_rabbit'],
  [B.AUTUMN]: ['c_deer', 'c_fox', 'c_bear', 'c_cat'],
};

function bfsDist(W, H, isSource, passable, cap) {
  const N = W * H, d = new Uint8Array(N).fill(255), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (isSource(i)) { d[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], nd = d[i] + 1;
    if (nd > cap) continue;
    const x = i % W, y = (i / W) | 0;
    if (x > 0 && d[i - 1] > nd && passable(i - 1)) { d[i - 1] = nd; q[qt++] = i - 1; }
    if (x < W - 1 && d[i + 1] > nd && passable(i + 1)) { d[i + 1] = nd; q[qt++] = i + 1; }
    if (y > 0 && d[i - W] > nd && passable(i - W)) { d[i - W] = nd; q[qt++] = i - W; }
    if (y < H - 1 && d[i + W] > nd && passable(i + W)) { d[i + W] = nd; q[qt++] = i + W; }
  }
  return d;
}

function genOverworld(seed) {
  const W = 800, H = 800, N = W * H;
  const R = mulberry32(seed);
  const m = new TileMap(W, H, { bgPal: OW_BG, kind: 'over' });
  const rnd = (x, y, k) => hash2(x, y, seed * 31 + k);

  // 1. Continent ----------------------------------------------------------
  const land = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1;
    const d = Math.sqrt(nx * nx * 1.05 + ny * ny);
    const e = fbm(x * 0.008, y * 0.008, seed + 1, 6);
    const isl = fbm(x * 0.02, y * 0.02, seed + 2, 3);
    const border = smoothstep(0.86, 0.98, Math.max(Math.abs(nx), Math.abs(ny)));
    // a main continent plus outlying islands
    const v = Math.max(e + (1 - d) * 0.85 - 0.76, (isl - 0.66) * 1.4 + (1 - d) * 0.12 - 0.02);
    land[y * W + x] = (v - border * 0.6) > 0 ? 1 : 0;
  }
  // keep the main landmass + reasonably sized islands
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  {
    const q = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (!land[s] || comp[s] >= 0) continue;
      const id = sizes.length; let qh = 0, qt = 0; q[qt++] = s; comp[s] = id;
      while (qh < qt) {
        const i = q[qh++], x = i % W, y = (i / W) | 0;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const j of nb) if (j >= 0 && land[j] && comp[j] < 0) { comp[j] = id; q[qt++] = j; }
      }
      sizes.push(qt);
    }
  }
  let mainId = 0;
  for (let k = 1; k < sizes.length; k++) if (sizes[k] > sizes[mainId]) mainId = k;
  for (let i = 0; i < N; i++) if (land[i] && sizes[comp[i]] < 40) land[i] = 0;
  // the main continent and any island big enough to hold places
  const mainland = (i) => land[i] && (comp[i] === mainId || sizes[comp[i]] >= 1200);

  const dOcean = bfsDist(W, H, (i) => !land[i], () => true, 120);
  const dLand = bfsDist(W, H, (i) => land[i] === 1, () => true, 30);

  // 2. Biome regions ------------------------------------------------------
  const RS = 34;
  const gw = Math.ceil(W / RS) + 1, gh = Math.ceil(H / RS) + 1, nR = gw * gh;
  const sx = new Float32Array(nR), sy = new Float32Array(nR);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    sx[gy * gw + gx] = (gx + 0.15 + R() * 0.7) * RS;
    sy[gy * gw + gx] = (gy + 0.15 + R() * 0.7) * RS;
  }
  const region = new Int16Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x + (fbm(x * 0.022, y * 0.022, seed + 3, 3) - 0.5) * 52;
    const wy = y + (fbm(x * 0.022, y * 0.022, seed + 4, 3) - 0.5) * 52;
    const gx = Math.floor(wx / RS), gy = Math.floor(wy / RS);
    let best = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) continue;
      const k = cy * gw + cx, dx = sx[k] - wx, dy = sy[k] - wy, dd = dx * dx + dy * dy;
      if (dd < best) { best = dd; id = k; }
    }
    region[y * W + x] = id;
  }
  const rank = (arr) => {
    const idx = Array.from(arr.keys()).sort((a, b) => arr[a] - arr[b]);
    const out = new Float32Array(arr.length);
    idx.forEach((k, r) => { out[k] = r / (arr.length - 1); });
    return out;
  };
  const tRaw = new Float32Array(nR), mRaw = new Float32Array(nR), eRaw = new Float32Array(nR);
  for (let k = 0; k < nR; k++) {
    tRaw[k] = (sy[k] / H) * 0.75 + fbm(sx[k] * 0.01, sy[k] * 0.01, seed + 5, 2) * 0.5;
    mRaw[k] = fbm(sx[k] * 0.014, sy[k] * 0.014, seed + 6, 3);
    eRaw[k] = fbm(sx[k] * 0.02, sy[k] * 0.02, seed + 7, 3);
  }
  const tR = rank(tRaw), mR = rank(mRaw), eR = rank(eRaw);
  const regB = new Uint8Array(nR);
  for (let k = 0; k < nR; k++) {
    const t = tR[k], mo = mR[k], el = eR[k];
    let b;
    if (el > 0.83) b = t < 0.3 ? B.SNOW : (t > 0.85 ? B.DUNES : B.MOUNT);
    else if (t < 0.14) b = B.SNOW;
    else if (t < 0.33) b = mo > 0.55 ? B.TAIGA : (mo > 0.3 ? B.FOREST : B.MOUNT);
    else if (t > 0.84) b = mo < 0.55 ? B.DUNES : B.MARSH;
    else if (t > 0.7 && mo < 0.3) b = B.DUNES;
    else if (mo > 0.85) b = B.LAKE;
    else if (mo > 0.64) b = B.FOREST;
    else if (mo > 0.52) b = B.MUSH;
    else if (mo < 0.2) b = B.GRASS;
    else b = hash2(k, 7, seed) < 0.5 ? B.PLAINS : B.GRASS;
    regB[k] = b;
  }
  // Count land cells per region, then sprinkle the rare biomes.
  const regLand = new Int32Array(nR);
  for (let i = 0; i < N; i++) if (land[i]) regLand[region[i]]++;
  const landRegs = shuffle(Array.from(regLand.keys()).filter((k) => regLand[k] > 500), R);
  const convert = (to, from, count) => {
    let n = 0;
    for (const k of landRegs) {
      if (n >= count) break;
      if (from.indexOf(regB[k]) >= 0 && tR[k] > 0.25 && tR[k] < 0.85) { regB[k] = to; n++; }
    }
  };
  const countB = (b) => landRegs.filter((k) => regB[k] === b).length;
  convert(B.SPOOKY, [B.FOREST, B.PLAINS, B.TAIGA], 6);
  convert(B.PINK, [B.PLAINS, B.GRASS, B.MUSH], 4);
  convert(B.VOLCANO, [B.MOUNT, B.DUNES, B.PLAINS, B.GRASS], 4);
  convert(B.CRYSTAL, [B.SNOW, B.TAIGA, B.PLAINS, B.MUSH, B.FOREST], 3);
  convert(B.AUTUMN, [B.FOREST, B.GRASS, B.PLAINS], 6);
  if (countB(B.MUSH) < 3) convert(B.MUSH, [B.PLAINS, B.GRASS, B.FOREST], 3 - countB(B.MUSH));
  if (countB(B.MARSH) < 2) convert(B.MARSH, [B.PLAINS, B.GRASS], 2 - countB(B.MARSH));
  if (countB(B.LAKE) < 3) convert(B.LAKE, [B.PLAINS, B.GRASS, B.FOREST], 3 - countB(B.LAKE));
  if (countB(B.DUNES) < 2) convert(B.DUNES, [B.PLAINS, B.GRASS], 2 - countB(B.DUNES));

  const biome = m.biome;
  for (let i = 0; i < N; i++) biome[i] = land[i] ? regB[region[i]] : B.OCEAN;
  const edge = bfsDist(W, H, (i) => {
    const x = i % W, y = (i / W) | 0, b = biome[i];
    return (x > 0 && biome[i - 1] !== b) || (x < W - 1 && biome[i + 1] !== b) ||
      (y > 0 && biome[i - W] !== b) || (y < H - 1 && biome[i + W] !== b);
  }, () => true, 30);

  const water = m.water, solid = m.solid, bg = m.bg;

  // 3. Rivers -------------------------------------------------------------
  {
    const sources = [];
    for (let t = 0; t < 8000 && sources.length < 11; t++) {
      const x = 20 + Math.floor(R() * (W - 40)), y = 20 + Math.floor(R() * (H - 40)), i = y * W + x;
      if (!mainland(i) || dOcean[i] < 35) continue;
      if (biome[i] !== B.MOUNT && biome[i] !== B.SNOW && biome[i] !== B.TAIGA && biome[i] !== B.VOLCANO) continue;
      if (sources.some((s) => Math.abs(s[0] - x) + Math.abs(s[1] - y) < 60)) continue;
      sources.push([x, y]);
    }
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    for (const [x0, y0] of sources) {
      let x = x0, y = y0, pd = -1;
      for (let step = 0; step < 900; step++) {
        const i = y * W + x;
        if (!land[i]) break;
        if (biome[i] === B.LAKE && edge[i] >= 2) break;
        water[i] = 1;
        if (R() < 0.18) { const sd = (pd + 1) & 3; const j = (y + DY[sd]) * W + (x + DX[sd]); if (land[j]) water[j] = 1; }
        let best = 1e9, bd = -1;
        for (let d = 0; d < 4; d++) {
          if (pd >= 0 && d === ((pd + 2) & 3)) continue;
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
          const j = ny * W + nx;
          if (water[j] && land[j]) continue;
          const s = dOcean[j] + (d === pd ? -0.8 : 0) + (fbm(nx * 0.08, ny * 0.08, seed + 40 + step, 1) - 0.5) * 3 + R() * 0.6;
          if (s < best) { best = s; bd = d; }
        }
        if (bd < 0) break;
        x += DX[bd]; y += DY[bd]; pd = bd;
      }
    }
  }

  // 4. Fill ----------------------------------------------------------------
  const put = (x, y, name, sol, flip) => {
    const i = y * W + x;
    m.glyph[i] = name ? (G[name] | (flip ? FLIP : 0)) : 0;
    solid[i] = sol ? 1 : 0;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = biome[i], e = edge[i];
    const ef = clamp((e - 1) / 5, 0, 1);
    const r = rnd(x, y, 1), r2 = rnd(x, y, 2), fl = r2 < 0.5;
    bg[i] = b;
    if (b === B.OCEAN) {
      water[i] = 1; solid[i] = 1;
      const dl = dLand[i];
      bg[i] = dl < 14 ? B.OCEAN : BG_VOID;
      const p = dl <= 1 ? 0.75 : 0.6 * Math.exp(-(dl - 1) / 4);
      if (r < p) m.glyph[i] = G[dl > 5 ? 'waveDeep' : (r2 < 0.78 ? 'waveOcean' : 'bubbleDim')];
      continue;
    }
    if (water[i] && b === B.VOLCANO) {
      solid[i] = 1; bg[i] = BG_LAVA;
      m.glyph[i] = G[rnd(x, y, 9) < 0.15 ? 'lavaLit' : 'lava'];
      continue;
    }
    if (water[i]) {
      solid[i] = 1; bg[i] = b === B.SNOW ? BG_ICE : BG_RIVER;
      if (r < 0.62) m.glyph[i] = G[b === B.SNOW ? 'waveIce' : 'wave'];
      else if (r < 0.75) m.glyph[i] = G.bubble;
      continue;
    }
    const n = fbm(x * 0.12, y * 0.12, seed + 20, 2);
    const n2 = fbm(x * 0.045, y * 0.045, seed + 21, 3);
    const treeT = n2 + (n - 0.5) * 0.45;
    switch (b) {
      case B.PLAINS:
        if (r < 0.03) put(x, y, r2 < 0.5 ? 'speck' : 'speck2');
        else if (r < 0.055) put(x, y, 'tuft2', 0, fl);
        else if (r < 0.06) put(x, y, 'flower', 0, fl);
        else if (r < 0.064 * ef) put(x, y, 'rock', 1, fl);
        else if (n2 > 0.6 && r < 0.3 * ef) put(x, y, 'roundTree', 1, fl);
        break;
      case B.GRASS:
        if (n2 > 0.57) { if (r < 0.9 * (0.3 + ef)) put(x, y, 'hatch'); }
        else if (n2 < 0.4 && n > 0.52) { if (r < 0.85) put(x, y, 'dotgridLime'); }
        else if (r < 0.12) put(x, y, 'check', 0, fl);
        else if (r < 0.135) put(x, y, 'flower', 0, fl);
        else if (r < 0.145) put(x, y, 'flowerBlue', 0, fl);
        else if (n > 0.66 && r < 0.4 * ef) put(x, y, 'roundTree', 1, fl);
        break;
      case B.FOREST: {
        const tp = smoothstep(0.4, 0.55, treeT) * 0.9 * ef;
        if (r < tp) put(x, y, r2 < 0.5 ? 'pine' : r2 < 0.78 ? 'pineTall' : 'pineDark', 1);
        else if (n > 0.64 && n2 < 0.48 && r < 0.45 * ef) put(x, y, 'fence', 1);
        else if (r < 0.08) put(x, y, 'tuft', 0, fl);
        else if (r < 0.095) put(x, y, 'sprout2');
        else if (r < 0.1) put(x, y, 'mushBrown', 0, fl);
        break;
      }
      case B.TAIGA: {
        const tp = smoothstep(0.38, 0.54, treeT) * 0.92 * Math.min(1, ef + 0.2);
        if (r < tp) {
          const k = Math.floor(rnd(x, y, 3) * 8);
          const names = ef < 0.6 ? ['ditherPineOlive', 'firTallOlive', 'firGreen', 'ditherPineGreen', 'pineTallGreen', 'fir', 'ditherPine', 'firTall']
            : ['fir', 'firTall', 'pineTallBlue', 'ditherPine', 'ditherPineTall', 'firGreen', 'ditherPineGreen', 'pineTallGreen'];
          put(x, y, names[k], 1, fl);
        } else if (r < tp + 0.04) put(x, y, 'shrubY', 0, fl);
        else if (r < tp + 0.07) put(x, y, 'tuftBlue', 0, fl);
        else if (r < tp + 0.08) put(x, y, 'mushSmall', 0, fl);
        else if (r < tp + 0.085) put(x, y, 'rockBlue', 1, fl);
        else if (r < tp + 0.09) put(x, y, 'flowerBlue', 0, fl);
        else if (r < tp + 0.11) put(x, y, 'speckTeal');
        break;
      }
      case B.LAKE:
        if (e >= 2) {
          water[i] = 1; solid[i] = 1; bg[i] = BG_LAKE;
          if (r < 0.5) put(x, y, 'wave', 1); else if (r < 0.68) put(x, y, 'bubble', 1);
        } else if (r < 0.2) put(x, y, 'grass', 0, fl);
        else if (r < 0.26) put(x, y, 'tuft', 0, fl);
        break;
      case B.DUNES:
        if (n2 > 0.66 && n > 0.56) put(x, y, r2 < 0.6 ? 'peakOrange' : 'peakOutlineOrange', 1);
        else if (((y + Math.floor(n * 7)) % 3 === 0) && n2 > 0.36 && r < 0.95 * (0.25 + ef)) put(x, y, 'dune');
        else if (r < 0.05) put(x, y, 'duneSmall');
        else if (r < 0.065) put(x, y, 'speckOrange');
        else if (r < 0.071) put(x, y, 'cactus', 1, fl);
        else if (r < 0.073) put(x, y, 'skullBone');
        else if (r < 0.076) put(x, y, 'bone', 0, fl);
        break;
      case B.MOUNT: {
        const ridge = (1 - Math.abs(2 * fbm(x * 0.06, y * 0.06, seed + 30, 3) - 1)) * (0.55 + 0.45 * ef);
        if (ridge > 0.86) put(x, y, n > 0.6 ? 'peakSnow' : 'peak', 1);
        else if (ridge > 0.75) { if (r < 0.85) put(x, y, r2 < 0.55 ? 'peak' : 'peakOutline', 1); }
        else if (ridge > 0.62) { if (r < 0.6) put(x, y, 'rubble', 0, fl); }
        else if (r < 0.06) put(x, y, 'peakSmall');
        else if (r < 0.11) put(x, y, 'speck');
        else if (r < 0.115) put(x, y, 'rock', 1, fl);
        break;
      }
      case B.SNOW: {
        const tp = smoothstep(0.45, 0.6, treeT) * 0.85 * ef;
        if (r < tp) put(x, y, r2 < 0.4 ? 'pineSnow' : r2 < 0.7 ? 'pineIce' : 'pineTallIce', 1);
        else if (n2 < 0.36 && n > 0.5) put(x, y, 'checkerIce');
        else if (r < tp + 0.05) put(x, y, 'snowflake');
        else if (r < tp + 0.1) put(x, y, 'speckSnow');
        else if (r < tp + 0.11) put(x, y, 'iceBlock', 1);
        else if (r < tp + 0.12) put(x, y, 'rubbleSnow');
        break;
      }
      case B.SPOOKY: {
        const tp = smoothstep(0.36, 0.5, treeT) * 0.9 * Math.min(1, ef + 0.3);
        if (r < tp) put(x, y, r2 < 0.4 ? 'ditherPineDark' : r2 < 0.75 ? 'ditherPineTallDark' : 'deadTreeDark', 1, fl);
        else if (n2 < 0.34) { if (r < 0.75) put(x, y, 'checkerDark'); }
        else if (r < tp + 0.3) put(x, y, r2 < 0.5 ? 'speckTeal' : 'speck2Teal');
        else if (r < tp + 0.33) put(x, y, 'dblArrow');
        else if (r < tp + 0.345) put(x, y, 'cross', 1);
        else if (r < tp + 0.35) put(x, y, 'skullDark');
        else if (r < tp + 0.36) put(x, y, 'eyes');
        else if (r < tp + 0.39) put(x, y, 'grassDark', 0, fl);
        break;
      }
      case B.MUSH:
        if (n2 > 0.66) { if (r < 0.8) put(x, y, 'hatchLime'); }
        else if (r < 0.06) put(x, y, 'sprout');
        else if (r < 0.09) put(x, y, 'sprout2');
        else if (r < 0.12) put(x, y, 'tuftLime', 0, fl);
        else if (r < 0.13) put(x, y, 'mushBrown', 0, fl);
        else if (r < 0.137) put(x, y, r2 < 0.7 ? 'glowShroom' : 'glowShroomPurple', 0, fl);
        else if (n2 < 0.42 && r < 0.17) put(x, y, 'dblArrow');
        break;
      case B.MARSH:
        if (n2 > 0.57 && ef > 0.3) {
          water[i] = 1; solid[i] = 1; bg[i] = BG_REDWATER;
          if (r < 0.55) put(x, y, 'waveRed', 1); else if (r < 0.7) put(x, y, 'bubbleRedBright', 1);
        } else if (r < 0.12) put(x, y, 'grassRed', 0, fl);
        else if (r < 0.16) put(x, y, 'tuftRed', 0, fl);
        else if (r < 0.18) put(x, y, 'flowerO');
        else if (r < 0.19) put(x, y, 'flowerRed');
        else if (r < 0.205) put(x, y, 'bubbleRed');
        break;
      case B.PINK:
        if (n2 > 0.56) { if (r < 0.9) put(x, y, 'checker'); }
        else if (n2 < 0.36 && n > 0.5) { if (r < 0.85) put(x, y, 'dotgrid'); }
        else if (r < 0.02) put(x, y, 'heart');
        else if (r < 0.032) put(x, y, 'mushSmall', 0, fl);
        else if (r < 0.036) put(x, y, 'crystalPink', 1, fl);
        else if (r < 0.06) put(x, y, 'speckPink');
        else if (r < 0.064) put(x, y, 'heartFill');
        break;
      case B.VOLCANO: {
        const flow = Math.abs(fbm(x * 0.03, y * 0.03, seed + 50, 3) - 0.5);
        if ((flow < 0.022 || n2 > 0.7) && ef > 0.2) {
          water[i] = 1; solid[i] = 1; bg[i] = BG_LAVA;
          put(x, y, rnd(x, y, 9) < 0.14 ? 'lavaLit' : 'lava', 1);
        } else if (n > 0.66 && r < 0.75 * ef) put(x, y, r2 < 0.6 ? 'peakBasalt' : 'peakOutlineBasalt', 1);
        else if (r < 0.012) put(x, y, 'vent', 1);
        else if (r < 0.03) put(x, y, 'rockObsidian', 1, fl);
        else if (r < 0.14) put(x, y, r2 < 0.5 ? 'speckAsh' : 'speck2Ash');
        else if (r < 0.18) put(x, y, 'rubbleBasalt', 0, fl);
        else if (r < 0.183) put(x, y, 'skullBone');
        break;
      }
      case B.CRYSTAL: {
        const tp = smoothstep(0.45, 0.6, treeT) * 0.7 * ef;
        if (r < tp) {
          const lit = rnd(x, y, 10) < 0.18;
          put(x, y, r2 < 0.5 ? (lit ? 'crystalBigLit' : 'crystalBig') : (lit ? 'crystalBigCyanLit' : 'crystalBigCyan'), 1, fl);
        } else if (n2 < 0.38) { if (r < 0.7) put(x, y, 'checkerViolet'); }
        else if (r < tp + 0.03) put(x, y, 'crystalDim', 1, fl);
        else if (r < tp + 0.1) put(x, y, 'dotgridViolet');
        else if (r < tp + 0.16) put(x, y, 'speckViolet');
        else if (r < tp + 0.17) put(x, y, 'glowShroomPurple', 0, fl);
        break;
      }
      case B.AUTUMN: {
        const tp = smoothstep(0.4, 0.55, treeT) * 0.85 * ef;
        if (r < tp) put(x, y, ['treeOrange', 'treeRed', 'treeYellow', 'pineAutumn', 'treeOrange', 'pineOlive'][Math.floor(rnd(x, y, 3) * 6)], 1, fl);
        else if (r < tp + 0.12) put(x, y, r2 < 0.5 ? 'leaves' : 'leavesRed', 0, fl);
        else if (r < tp + 0.13) put(x, y, 'pumpkin', 1);
        else if (r < tp + 0.145) put(x, y, 'mushBrown', 0, fl);
        else if (n > 0.66 && n2 < 0.45 && r < 0.4 * ef) put(x, y, 'fence', 1);
        else if (r < tp + 0.18) put(x, y, 'tuftOlive', 0, fl);
        break;
      }
    }
  }
  // giant mushrooms (2x2)
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 3; x++) {
    const i = y * W + x;
    if (biome[i] !== B.MUSH || edge[i] < 3) continue;
    if (fbm(x * 0.045, y * 0.045, seed + 21, 3) < 0.46 || rnd(x, y, 5) > 0.05) continue;
    const cells = [i, i + 1, i - W, i - W + 1];
    if (cells.some((c) => water[c] || biome[c] !== B.MUSH || (m.glyph[c] && solid[c]))) continue;
    for (const c of cells) { m.glyph[c] = 0; solid[c] = 1; }
    m.glyph[i] = G.mushroomBig | (rnd(x, y, 6) < 0.5 ? FLIP : 0);
  }

  // thin out lone trees: a tree with at most one tree beside it often just
  // blocks the way, so a little over half of those are cleared
  {
    const TREES = new Set(['pine', 'pineTall', 'pineDark', 'pineOlive', 'pineSnow', 'pineIce', 'pineTallIce', 'pineTallBlue', 'pineTallGreen',
      'roundTree', 'fir', 'firTall', 'firGreen', 'firTallGreen', 'firTallOlive', 'ditherPine', 'ditherPineTall', 'ditherPineGreen',
      'ditherPineOlive', 'ditherPineDark', 'ditherPineTallDark', 'deadTreeDark', 'treeOrange', 'treeRed', 'treeYellow', 'pineAutumn',
      'crystalBig', 'crystalBigLit', 'crystalBigCyan', 'crystalBigCyanLit'].map((n) => G[n]));
    const lone = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!TREES.has(m.glyph[i] & 0x7fff)) continue;
      let n = 0;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if ((j || k) && TREES.has(m.glyph[i + j * W + k] & 0x7fff)) n++;
      if (n <= 1 && rnd(x, y, 13) < 0.55) lone.push(i);
    }
    for (const i of lone) { m.glyph[i] = 0; solid[i] = 0; }
  }

  // 5. Points of interest ------------------------------------------------------
  const reserved = new Uint8Array(N);
  const pois = [];
  const entrances = [];
  const clearArea = (cx, cy, rad) => {
    for (let y = cy - rad - 2; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > rad * rad + 1) continue;
      const i = y * W + x;
      if (reserved[i]) continue;
      m.glyph[i] = 0; solid[i] = 0;
      if (water[i] && land[i]) { water[i] = 0; bg[i] = biome[i]; }
    }
  };
  const structure = (ax, ay, name, wc, hc, flip) => {
    for (let y = ay - hc + 1; y <= ay; y++) for (let x = ax; x < ax + wc; x++) {
      const i = y * W + x; m.glyph[i] = 0; solid[i] = 1; reserved[i] = 1;
    }
    m.glyph[ay * W + ax] = G[name] | (flip ? FLIP : 0);
  };
  const addEntrance = (cells, type, ret, poi) => {
    const e = { id: entrances.length, type, seed: (seed * 7919 + entrances.length * 104729) >>> 0, ret, poi };
    entrances.push(e);
    for (const [x, y] of cells) { const i = y * W + x; m.entr.set(i, e); solid[i] = 0; reserved[i] = 1; }
    return e;
  };
  const deco = (cx, cy, rad, name, count, sol, test) => {
    for (let t = 0; t < count * 6 && count > 0; t++) {
      const a = R() * Math.PI * 2, rr = rad * (0.5 + R() * 0.5);
      const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = y * W + x;
      if (reserved[i] || water[i] || !land[i] || m.glyph[i]) continue;
      if (test && !test(x, y)) continue;
      if (Math.abs(x - cx) <= 1 && y > cy) continue; // keep the approach clear
      put(x, y, name, sol, R() < 0.5);
      if (sol) reserved[i] = 1;
      count--;
    }
  };

  const STAMPS = {
    village(cx, cy, poi) {
      clearArea(cx, cy, 7);
      bg[cy * W + cx] = BG_PLAZA;
      const slots = shuffle([[-5, -2], [2, -3], [-6, 4], [3, 4], [-2, -5], [5, 0], [-5, 1], [0, 5]], R);
      const nh = 3 + Math.floor(R() * 3);
      poi.local = [];
      let placed = 0;
      for (const [ox, oy] of slots) {
        if (placed >= nh) break;
        const ax = cx + ox, ay = cy + oy;
        let ok = true;
        for (let y = ay - 2; y <= ay + 2 && ok; y++) for (let x = ax - 1; x <= ax + 2; x++) {
          if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) { ok = false; break; }
          const i = y * W + x;
          if (reserved[i] || water[i] || !land[i]) { ok = false; break; }
        }
        if (!ok) continue;
        structure(ax, ay, 'house', 2, 2);
        addEntrance([[ax + 1, ay]], 'house', { x: ax + 1, y: ay + 1 }, poi);
        poi.local.push({ x: ax + 1, y: ay + 1 });
        placed++;
      }
      structure(cx + 2, cy - 1, 'campfire', 1, 1);
      put(cx + 3, cy - 1, 'logs'); reserved[(cy - 1) * W + cx + 3] = 1;
      deco(cx, cy, 6, 'lantern', 3, 1);
      deco(cx, cy, 7, 'fence', 5, 1);
      deco(cx, cy, 6, 'flower', 6, 0);
    },
    camp(cx, cy) {
      clearArea(cx, cy, 3);
      structure(cx - 2, cy - 1, 'tent', 2, 1);
      structure(cx + 1, cy, 'campfire', 1, 1);
      put(cx + 2, cy, 'logs');
      deco(cx, cy, 3, 'rock', 2, 1);
    },
    cave(cx, cy, poi, type) {
      const ice = type === 'icecave', bb = biome[cy * W + cx], dunes = bb === B.DUNES;
      const pk = ice ? 'pineIce' : dunes ? 'peakOrange' : bb === B.VOLCANO ? 'peakBasalt' : bb === B.CRYSTAL ? 'crystalBigCyan' : 'peak';
      for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-2, 0], [2, 0]]) {
        const x = cx + dx, y = cy + dy; put(x, y, dy === 0 && Math.abs(dx) === 2 ? 'peakSmall' : pk, 1); reserved[y * W + x] = 1;
      }
      for (let y = cy + 1; y <= cy + 2; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        const i = y * W + x; if (!reserved[i]) { m.glyph[i] = 0; solid[i] = 0; water[i] = 0; bg[i] = biome[i]; }
      }
      put(cx, cy, ice ? 'caveMouthIce' : dunes ? 'caveMouthOrange' : 'caveMouth', 0);
      addEntrance([[cx, cy]], type, { x: cx, y: cy + 1 }, poi);
      put(cx - 1, cy + 1, ice ? 'lanternBlue' : 'torch', 1); reserved[(cy + 1) * W + cx - 1] = 1;
    },
    icecave(cx, cy, poi) { STAMPS.cave(cx, cy, poi, 'icecave'); },
    crypt(cx, cy, poi) {
      clearArea(cx, cy, 5);
      structure(cx, cy, 'crypt', 2, 2);
      addEntrance([[cx, cy], [cx + 1, cy]], 'crypt', { x: cx, y: cy + 1 }, poi);
      deco(cx, cy, 4.5, 'grave', 6, 1);
      deco(cx, cy, 4.5, 'cross', 5, 1);
      deco(cx, cy, 3, 'spirit', 3, 0);
    },
    ruins(cx, cy, poi) {
      clearArea(cx, cy, 4);
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== 3) continue;
        if (x === cx && y > cy) continue;
        const r = R();
        if (r < 0.55) { put(x, y, 'brick', 1); reserved[y * W + x] = 1; } else if (r < 0.75) put(x, y, 'brickHalf');
      }
      put(cx, cy, 'stairs', 0);
      addEntrance([[cx, cy]], 'dungeon', { x: cx, y: cy + 1 }, poi);
      deco(cx, cy, 2.5, 'torchGreen', 1, 1);
      deco(cx, cy, 2.5, 'skull', 1, 0);
      deco(cx, cy, 5, 'rubble', 4, 0);
    },
    hollow(cx, cy, poi) {
      clearArea(cx, cy, 5);
      structure(cx, cy, 'hollow', 2, 2);
      addEntrance([[cx, cy], [cx + 1, cy]], 'hollow', { x: cx, y: cy + 1 }, poi);
      put(cx - 1, cy + 1, 'lanternBlue', 1); reserved[(cy + 1) * W + cx - 1] = 1;
      deco(cx, cy, 4, 'glowShroom', 5, 0);
      deco(cx, cy, 4, 'mushBrown', 4, 0);
    },
    temple(cx, cy, poi) {
      clearArea(cx, cy, 5);
      structure(cx, cy, 'temple', 2, 2);
      addEntrance([[cx, cy], [cx + 1, cy]], 'temple', { x: cx, y: cy + 1 }, poi);
      structure(cx - 1, cy, 'brazier', 1, 1);
      structure(cx + 2, cy, 'brazier', 1, 1);
      deco(cx, cy, 4.5, 'flowerO', 6, 0);
      deco(cx, cy, 4.5, 'runeFloor', 4, 0);
    },
    tower(cx, cy, poi) {
      clearArea(cx, cy, 3);
      structure(cx, cy, 'tower', 1, 3);
      addEntrance([[cx, cy]], 'tower', { x: cx, y: cy + 1 }, poi);
      deco(cx, cy, 3, 'rock', 2, 1);
    },
    shrine(cx, cy) {
      clearArea(cx, cy, 5);
      structure(cx, cy, 'shrine', 2, 2);
      deco(cx, cy, 4.5, 'heartFill', 4, 0);
      deco(cx, cy, 4.5, 'heart', 6, 0);
      deco(cx, cy, 4.5, 'crystalPink', 3, 1);
    },
    stones(cx, cy) {
      clearArea(cx, cy, 5);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 - Math.PI / 2;
        const x = Math.round(cx + Math.cos(a) * 3.4), y = Math.round(cy + Math.sin(a) * 3.0);
        if (y > cy && Math.abs(x - cx) <= 1) continue;
        put(x, y, 'stone', 1); reserved[y * W + x] = 1;
      }
      put(cx, cy, 'rune', 1); reserved[cy * W + cx] = 1;
    },
    castle(cx, cy, poi) {
      clearArea(cx, cy, 8);
      for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 7; x <= cx + 7; x++) {
        if (Math.abs(x - cx) !== 7 && Math.abs(y - cy) !== 6) continue;
        if (x === cx && y === cy + 6) continue;
        const corner = Math.abs(x - cx) === 7 && Math.abs(y - cy) === 6;
        if (corner) structure(x, y, 'tower', 1, 3);
        else { put(x, y, 'wallStone', 1); reserved[y * W + x] = 1; }
      }
      structure(cx - 1, cy, 'keep', 3, 3);
      addEntrance([[cx, cy]], 'castle', { x: cx, y: cy + 1 }, poi);
      structure(cx - 1, cy + 5, 'torch', 1, 1); structure(cx + 1, cy + 5, 'torch', 1, 1);
      for (const [dx, dy] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) { structure(cx + dx, cy + dy, 'lantern', 1, 1); }
      for (let k = 0; k < 10; k++) {
        const x = cx + Math.round((R() - 0.5) * 11), y = cy + Math.round((R() - 0.5) * 9);
        const i = y * W + x;
        if (!reserved[i] && !m.glyph[i] && x !== cx) put(x, y, R() < 0.5 ? 'flower' : 'flowerBlue', 0);
      }
      poi.local = [{ x: cx, y: cy + 1 }];
    },
    lighthouse(cx, cy, poi) {
      clearArea(cx, cy, 2);
      structure(cx, cy, 'lighthouse', 1, 4);
      addEntrance([[cx, cy]], 'lighthouse', { x: cx, y: cy + 1 }, poi);
      deco(cx, cy, 2.5, 'rock', 2, 1);
    },
    wreck(cx, cy, poi) {
      clearArea(cx, cy, 3);
      structure(cx - 1, cy, 'wreck', 3, 2);
      addEntrance([[cx, cy]], 'wreck', { x: cx, y: cy + 1 }, poi);
      deco(cx, cy, 3, 'barrel', 2, 1);
      deco(cx, cy, 3, 'anchor', 1, 0);
      deco(cx, cy, 3, 'bone', 2, 0);
    },
    mine(cx, cy, poi) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-2, 0], [2, 0]]) {
        const x = cx + dx, y = cy + dy; put(x, y, dy === 0 && Math.abs(dx) === 2 ? 'peakSmall' : 'peak', 1); reserved[y * W + x] = 1;
      }
      for (let y = cy + 1; y <= cy + 3; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        const i = y * W + x; if (!reserved[i]) { m.glyph[i] = 0; solid[i] = 0; water[i] = 0; bg[i] = biome[i]; }
      }
      put(cx, cy, 'mineMouth', 0);
      addEntrance([[cx, cy]], 'mine', { x: cx, y: cy + 1 }, poi);
      put(cx, cy + 1, 'rails', 0); put(cx, cy + 2, 'rails', 0);
      structure(cx + 1, cy + 1, 'cart', 1, 1);
      structure(cx - 1, cy + 1, 'lantern', 1, 1);
      poi.local = [{ x: cx, y: cy + 2 }];
    },
    volcano(cx, cy, poi) {
      clearArea(cx, cy, 6);
      for (let y = cy - 6; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 6; x++) {
        const dx = x - cx - 0.5, dy = (y - cy + 0.5) * 1.15, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 4.2 || d > 5.6) continue;
        if (y > cy && x >= cx - 1 && x <= cx + 2) continue;
        const i = y * W + x;
        water[i] = 1; solid[i] = 1; bg[i] = BG_LAVA; reserved[i] = 1;
        m.glyph[i] = G[rnd(x, y, 9) < 0.25 ? 'lavaLit' : 'lava'];
      }
      structure(cx, cy, 'fireShrine', 2, 2);
      addEntrance([[cx, cy], [cx + 1, cy]], 'firetemple', { x: cx, y: cy + 1 }, poi);
      structure(cx - 1, cy + 1, 'brazier', 1, 1); structure(cx + 2, cy + 1, 'brazier', 1, 1);
    },
    worldtree(cx, cy, poi) {
      clearArea(cx, cy - 2, 7);
      structure(cx - 2, cy, 'worldTree', 5, 6);
      addEntrance([[cx, cy]], 'worldtree', { x: cx, y: cy + 1 }, poi);
      deco(cx, cy, 6, 'glowShroom', 8, 0);
      deco(cx, cy, 6, 'lanternBlue', 3, 1);
      deco(cx, cy, 6, 'flower', 6, 0);
    },
    ribs(cx, cy) {
      clearArea(cx, cy, 4);
      structure(cx - 2, cy, 'ribs', 4, 2);
      deco(cx, cy, 4, 'bone', 4, 0);
      deco(cx, cy, 4, 'skullBone', 2, 0);
    },
    witch(cx, cy, poi) {
      clearArea(cx, cy, 4);
      structure(cx, cy, 'witchHut', 2, 2);
      addEntrance([[cx + 1, cy]], 'witch', { x: cx + 1, y: cy + 1 }, poi);
      structure(cx - 1, cy, 'cauldron', 1, 1);
      deco(cx, cy, 3.5, 'pumpkin', 3, 1);
      deco(cx, cy, 3.5, 'skull', 2, 0);
    },
    // boss arena: a colosseum gate on a flagstone plaza, flanked by braziers
    arena(cx, cy, poi) {
      clearArea(cx, cy, 6);
      for (let y = cy - 1; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
        const i = y * W + x;
        if (!reserved[i] && Math.abs(x - cx) + Math.abs(y - cy - 1) <= 4) bg[i] = BG_PLAZA;
      }
      structure(cx - 1, cy, 'arenaGate', 3, 2);
      addEntrance([[cx, cy]], 'arena', { x: cx, y: cy + 1 }, poi);
      structure(cx - 2, cy + 1, 'brazier', 1, 1); structure(cx + 2, cy + 1, 'brazier', 1, 1);
      for (const [dx, dy] of [[-5, -1], [5, -1], [-5, 2], [5, 2]]) { put(cx + dx, cy + dy, 'stone', 1); reserved[(cy + dy) * W + cx + dx] = 1; }
    },
    oasis(cx, cy) {
      clearArea(cx, cy, 5);
      for (let y = cy - 3; y <= cy; y++) for (let x = cx - 2; x <= cx + 2; x++) {
        const dx = x - cx, dy = (y - cy + 1.5) * 1.3;
        if (dx * dx + dy * dy > 5.2) continue;
        const i = y * W + x;
        water[i] = 1; solid[i] = 1; bg[i] = BG_LAKE; reserved[i] = 1;
        m.glyph[i] = rnd(x, y, 8) < 0.6 ? G.wave : 0;
      }
      deco(cx, cy - 1, 4, 'palm', 5, 1);
      deco(cx, cy, 4, 'tuft', 4, 0);
    },
  };
  const POI_DEFS = [
    { type: 'castle', n: 5, biomes: [B.GRASS, B.PLAINS, B.AUTUMN, B.FOREST], dist: 90, rad: 9, hub: [0, 7] },
    { type: 'worldtree', n: 2, biomes: [B.FOREST, B.MUSH, B.AUTUMN, B.TAIGA], dist: 200, rad: 7 },
    { type: 'village', n: 16, biomes: [B.PLAINS, B.GRASS, B.FOREST, B.TAIGA, B.AUTUMN], dist: 50, rad: 8, hub: [0, 0] },
    { type: 'volcano', n: 4, biomes: [B.VOLCANO], dist: 50, rad: 6 },
    { type: 'temple', n: 4, biomes: [B.MARSH], dist: 30, rad: 5 },
    { type: 'shrine', n: 4, biomes: [B.PINK], dist: 30, rad: 5 },
    { type: 'hollow', n: 7, biomes: [B.MUSH], dist: 26, rad: 5 },
    { type: 'crypt', n: 9, biomes: [B.SPOOKY], dist: 22, rad: 5 },
    { type: 'witch', n: 6, biomes: [B.SPOOKY, B.MARSH, B.AUTUMN], dist: 40, rad: 4, hub: [1, 1] },
    { type: 'lighthouse', n: 8, coast: true, dist: 70, hub: [0, 1] },
    { type: 'wreck', n: 7, coast: true, dist: 60, hub: [0, 1] },
    { type: 'mine', n: 10, biomes: [B.MOUNT, B.SNOW, B.VOLCANO], dist: 40, rad: 2, cave: true, hub: [0, 3] },
    { type: 'cave', n: 20, biomes: [B.MOUNT, B.DUNES, B.VOLCANO, B.CRYSTAL], dist: 26, rad: 2, cave: true },
    { type: 'icecave', n: 8, biomes: [B.SNOW], dist: 26, rad: 2, cave: true },
    { type: 'oasis', n: 6, biomes: [B.DUNES], dist: 34, rad: 5, hub: [0, 2] },
    { type: 'ribs', n: 5, biomes: [B.DUNES, B.VOLCANO], dist: 50, rad: 4 },
    { type: 'tower', n: 10, biomes: [B.MOUNT, B.GRASS, B.PLAINS, B.SNOW, B.TAIGA, B.CRYSTAL], dist: 34, rad: 3 },
    { type: 'ruins', n: 18, biomes: [B.PLAINS, B.GRASS, B.DUNES, B.SPOOKY, B.FOREST, B.MARSH, B.SNOW, B.AUTUMN, B.VOLCANO], dist: 28, rad: 4 },
    { type: 'stones', n: 9, biomes: [B.GRASS, B.PLAINS, B.TAIGA, B.MUSH, B.CRYSTAL], dist: 34, rad: 5 },
    { type: 'camp', n: 30, biomes: [B.TAIGA, B.FOREST, B.PLAINS, B.GRASS, B.SNOW, B.DUNES, B.AUTUMN], dist: 24, rad: 4 },
  ];
  for (const def of POI_DEFS) {
    let made = 0;
    for (let t = 0; t < 12000 && made < def.n; t++) {
      const cx = 10 + Math.floor(R() * (W - 20)), cy = 10 + Math.floor(R() * (H - 20));
      const ci = cy * W + cx;
      if (!mainland(ci) || water[ci] || reserved[ci]) continue;
      if (pois.some((p) => Math.hypot(p.x - cx, p.y - cy) < (p.type === def.type ? def.dist : 16))) continue;
      if (def.coast) {
        // on the shore: open sea just below, dry land for the structure
        if (dOcean[ci] < 1 || dOcean[ci] > 2) continue;
        let ok = true;
        for (let y = cy - 4; y <= cy + 1 && ok; y++) for (let x = cx - 1; x <= cx + 1; x++) {
          const i = y * W + x; if (!land[i] || water[i] || reserved[i]) { ok = false; break; }
        }
        if (!ok) continue;
      } else if (def.biomes.indexOf(biome[ci]) < 0 || edge[ci] < (def.cave ? 2 : 4)) continue;
      let ok = true;
      const rr = def.coast ? -99 : def.rad;
      for (let y = cy - rr - 2; y <= cy + rr + 1 && ok; y++) for (let x = cx - rr; x <= cx + rr; x++) {
        const i = y * W + x;
        if (!mainland(i) || reserved[i] || (water[i] && !def.cave)) { ok = false; break; }
      }
      if (def.cave) {
        // a cave needs open ground in front and solid-ish mountain behind
        for (let y = cy + 1; y <= cy + 2 && ok; y++) if (water[y * W + cx] || !land[y * W + cx]) ok = false;
        let rock = 0;
        for (let y = cy - 3; y <= cy - 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (solid[y * W + x]) rock++;
        if (rock < 5) ok = false;
      }
      if (!ok) continue;
      const poi = { type: def.type, x: cx, y: cy, hub: { x: cx, y: cy + 1 } };
      if (def.hub) poi.hub = { x: cx + def.hub[0], y: cy + def.hub[1] };
      pois.push(poi);
      STAMPS[def.type](cx, cy, poi, def.type);
      const hi = poi.hub.y * W + poi.hub.x;
      m.glyph[hi] = 0; solid[hi] = 0;
      made++;
    }
  }
  // seven boss arenas, spread far apart on open ground (their own RNG so the
  // rest of the world keeps its layout); the spacing relaxes if land is tight
  {
    const RA = mulberry32((seed ^ 0xb055a7e5) >>> 0);
    let made = 0;
    for (let t = 0; t < 60000 && made < 7; t++) {
      const relax = t > 30000;
      const cx = 12 + Math.floor(RA() * (W - 24)), cy = 12 + Math.floor(RA() * (H - 24)), ci = cy * W + cx;
      if (!mainland(ci) || water[ci] || reserved[ci] || biome[ci] === B.LAKE) continue;
      if (edge[ci] < (relax ? 1 : 3)) continue;
      if (pois.some((p) => Math.hypot(p.x - cx, p.y - cy) < (p.type === 'arena' ? (relax ? 60 : 120) : 14))) continue;
      let ok = true;
      for (let y = cy - 7; y <= cy + 4 && ok; y++) for (let x = cx - 6; x <= cx + 6; x++) {
        const i = y * W + x;
        if (!mainland(i) || reserved[i] || water[i]) { ok = false; break; }
      }
      if (!ok) continue;
      const poi = { type: 'arena', x: cx, y: cy, hub: { x: cx, y: cy + 2 }, boss: made };
      pois.push(poi);
      STAMPS.arena(cx, cy, poi);
      const hi = poi.hub.y * W + poi.hub.x;
      m.glyph[hi] = 0; solid[hi] = 0;
      made++;
    }
  }

  // five world-boss lairs, each in its boss's home biome: a wide clearing
  // ringed with themed stones and lights, away from the middle of the map
  {
    const RL = mulberry32((seed ^ 0x1a12b055) >>> 0);
    WORLD_BOSSES.forEach((WB, k) => {
      for (let t = 0; t < 50000; t++) {
        const relax = t > 25000;
        const cx = 14 + Math.floor(RL() * (W - 28)), cy = 14 + Math.floor(RL() * (H - 28)), ci = cy * W + cx;
        if (!mainland(ci) || reserved[ci] || (!relax && WB.biomes.indexOf(biome[ci]) < 0) || biome[ci] === B.OCEAN) continue;
        if (edge[ci] < (relax ? 2 : 4) || Math.hypot(cx - W / 2, cy - H / 2) < 90) continue;
        if (pois.some((p) => Math.hypot(p.x - cx, p.y - cy) < (p.type === 'lair' ? 90 : 16))) continue;
        let ok = true;
        for (let y = cy - 9; y <= cy + 9 && ok; y++) for (let x = cx - 9; x <= cx + 9; x++) {
          const i = y * W + x;
          if (!mainland(i) || reserved[i]) { ok = false; break; }
        }
        if (!ok) continue;
        clearArea(cx, cy, 8);
        for (let j = 0; j < 14; j++) {
          const a = (j / 14) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(a) * 8), y = Math.round(cy + Math.sin(a) * 7);
          if (y > cy && Math.abs(x - cx) <= 2) continue; // the way in, from the south
          put(x, y, WB.ring, 1); reserved[y * W + x] = 1;
        }
        for (const a of [0.8, 2.35, 3.9, 5.5]) {
          const x = Math.round(cx + Math.cos(a) * 5), y = Math.round(cy + Math.sin(a) * 4.5);
          put(x, y, WB.light, 1); reserved[y * W + x] = 1;
        }
        const poi = { type: 'lair', x: cx, y: cy, hub: { x: cx, y: cy + 8 }, lair: k };
        pois.push(poi);
        const hi = poi.hub.y * W + poi.hub.x;
        m.glyph[hi] = 0; solid[hi] = 0;
        break;
      }
    });
  }

  // 6. Roads --------------------------------------------------------------------
  const cost = new Float32Array(N);
  const PEAKS = new Set(['peak', 'peakOutline', 'peakSnow', 'peakOrange', 'peakOutlineOrange'].map((n) => G[n]));
  for (let i = 0; i < N; i++) {
    if (reserved[i] || (!land[i] && dLand[i] > 14)) cost[i] = Infinity;
    else if (!land[i]) cost[i] = 40; // causeway out to an island
    else if (water[i]) cost[i] = 16;
    else if (solid[i]) cost[i] = PEAKS.has(m.glyph[i] & 0x7fff) ? 22 : 5;
    else cost[i] = 1.4;
  }
  const road = m.road;
  const gS = new Float32Array(N), seen = new Int32Array(N), closed = new Int32Array(N), came = new Int32Array(N), dirA = new Int8Array(N);
  let stamp = 0;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const astar = (sx0, sy0, tx, ty) => {
    stamp++;
    const start = sy0 * W + sx0, goal = ty * W + tx;
    const heap = new Heap();
    gS[start] = 0; seen[start] = stamp; dirA[start] = -1; came[start] = -1;
    heap.push(0, start);
    let iter = 0;
    while (heap.size && iter++ < 1500000) {
      const cur = heap.pop();
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      if (cur === goal) {
        const path = [];
        for (let c = goal; c !== -1; c = came[c]) path.push(c);
        return path.reverse();
      }
      const cx = cur % W, cy = (cur / W) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (closed[ni] === stamp) continue;
        let c = road[ni] ? 0.35 : cost[ni];
        if (c === Infinity) { if (ni !== goal) continue; c = 1; }
        const ng = gS[cur] + c + (dirA[cur] >= 0 && dirA[cur] !== d ? 2.5 : 0);
        if (seen[ni] !== stamp || ng < gS[ni]) {
          seen[ni] = stamp; gS[ni] = ng; came[ni] = cur; dirA[ni] = d;
          heap.push(ng + 1.15 * (Math.abs(nx - tx) + Math.abs(ny - ty)), ni);
        }
      }
    }
    return null;
  };
  const carve = (path) => {
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      road[i] |= R_ON;
      if (k > 0) {
        const p = path[k - 1], d = i - p;
        if (d === 1) { road[i] |= R_W; road[p] |= R_E; } else if (d === -1) { road[i] |= R_E; road[p] |= R_W; }
        else if (d === W) { road[i] |= R_N; road[p] |= R_S; } else { road[i] |= R_S; road[p] |= R_N; }
      }
      if (water[i]) road[i] |= R_DOT;
      if (!m.entr.has(i)) { m.glyph[i] = 0; solid[i] = 0; }
    }
  };
  // minimum spanning tree over hubs + a few loops
  const hubs = pois.map((p) => p.hub);
  const inTree = new Uint8Array(hubs.length), edges = [];
  if (hubs.length) {
    inTree[0] = 1;
    const bestD = hubs.map((h) => Math.hypot(h.x - hubs[0].x, h.y - hubs[0].y)), bestP = hubs.map(() => 0);
    for (let n = 1; n < hubs.length; n++) {
      let bi = -1, bd = Infinity;
      for (let k = 0; k < hubs.length; k++) if (!inTree[k] && bestD[k] < bd) { bd = bestD[k]; bi = k; }
      inTree[bi] = 1; edges.push([bestP[bi], bi]);
      for (let k = 0; k < hubs.length; k++) {
        if (inTree[k]) continue;
        const d = Math.hypot(hubs[k].x - hubs[bi].x, hubs[k].y - hubs[bi].y);
        if (d < bestD[k]) { bestD[k] = d; bestP[k] = bi; }
      }
    }
    for (let a = 0; a < hubs.length; a++) {
      if (R() > 0.3) continue;
      let bk = -1, bd = 75;
      for (let k = 0; k < hubs.length; k++) {
        if (k === a || edges.some(([p, q]) => (p === a && q === k) || (p === k && q === a))) continue;
        const d = Math.hypot(hubs[k].x - hubs[a].x, hubs[k].y - hubs[a].y);
        if (d < bd) { bd = d; bk = k; }
      }
      if (bk >= 0) edges.push([a, bk]);
    }
  }
  edges.sort((a, b) => Math.hypot(hubs[a[0]].x - hubs[a[1]].x, hubs[a[0]].y - hubs[a[1]].y) -
    Math.hypot(hubs[b[0]].x - hubs[b[1]].x, hubs[b[0]].y - hubs[b[1]].y));
  for (const p of pois) if (p.local) for (const l of p.local) { const path = astar(l.x, l.y, p.hub.x, p.hub.y); if (path) carve(path); }
  for (const [a, b] of edges) {
    const path = astar(hubs[a].x, hubs[a].y, hubs[b].x, hubs[b].y);
    if (path) carve(path);
  }
  for (const h of hubs) road[h.y * W + h.x] |= R_NODE | R_ON;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, r = road[i];
    if (!r || (r & R_DOT)) continue;
    const c = ((r & R_N) ? 1 : 0) + ((r & R_E) ? 1 : 0) + ((r & R_S) ? 1 : 0) + ((r & R_W) ? 1 : 0);
    if (c >= 3 && !(road[i - 1] & R_NODE) && !(road[i - W] & R_NODE) && rnd(x, y, 11) < 0.7) road[i] |= R_NODE;
  }

  // 7. Creatures ----------------------------------------------------------------
  for (let t = 0; t < 40000 && m.creatures.length < 2400; t++) {
    const x = Math.floor(R() * W), y = Math.floor(R() * H), i = y * W + x;
    if (!land[i] || solid[i] || water[i] || road[i]) continue;
    const list = CREATURE_TABLE[biome[i]];
    if (!list) continue;
    m.creatures.push(makeCreature(list[Math.floor(R() * list.length)], x, y, biome[i], R));
  }

  m.finalize();
  let start = pois.find((p) => p.type === 'village');
  if (!start) start = pois[0] || { hub: { x: W >> 1, y: H >> 1 } };
  // prefer the village closest to the centre of the continent
  let bd = Infinity;
  for (const p of pois) if (p.type === 'village') {
    const d = Math.hypot(p.x - W / 2, p.y - H / 2);
    if (d < bd) { bd = d; start = p; }
  }
  return { map: m, pois, entrances, start: { x: start.hub.x, y: start.hub.y }, land };
}
