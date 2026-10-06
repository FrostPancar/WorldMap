'use strict';
// ---------------------------------------------------------------------------
// Dream layer: every interior is re-dressed in one of sixteen surreal themes,
// in the spirit of Yume Nikki — patterned floors, re-skinned walls, framed
// pixel paintings after public-domain masterworks, a centrepiece, props,
// wandering dream-dwellers, ambient particles and a screen effect.
// Themes are picked deterministically per entrance so co-op players share
// the same dream.
// ---------------------------------------------------------------------------

// --- helpers -------------------------------------------------------------------
// Two-frame bob for "floating" props: the second frame sits a pixel lower.
function bob(rows) { return [rows, ['.'.repeat(rows[0].length)].concat(rows.slice(0, -1))]; }
// A 16x16 framed painting: gold outer frame (1), dark inner frame (2), and a
// 12x12 picture drawn by fn(x, y) returning palette slots '3'..'9'.
function painting(name, colors, fn) {
  defGlyph(name, rowsFrom(16, 16, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '1';
    if (x === 1 || y === 1 || x === 14 || y === 14) return '2';
    return fn(x - 2, y - 2) || '3';
  }), ['#c8a040', '#5a3a14'].concat(colors), { tags: 'painting' });
}
const DIGITS = {
  0: ['111', '1.1', '1.1', '1.1', '111'], 1: ['.1.', '11.', '.1.', '.1.', '111'], 2: ['111', '..1', '111', '1..', '111'],
  3: ['111', '..1', '.11', '..1', '111'], 4: ['1.1', '1.1', '111', '..1', '..1'], 5: ['111', '1..', '111', '..1', '111'],
  6: ['111', '1..', '111', '1.1', '111'], 7: ['111', '..1', '.1.', '.1.', '.1.'], 8: ['111', '1.1', '111', '1.1', '111'],
  9: ['111', '1.1', '111', '..1', '111'],
};

// --- paintings (after public-domain works) ----------------------------------------
// Mona Lisa — Leonardo da Vinci (Louvre, Paris)
painting('pMona', ['#6a7a4a', '#9a8a5a', '#2a1a10', '#d8b080', '#3a2a1a'], (x, y) => {
  const fx = (x - 5.5) / 2.1, fy = (y - 4.2) / 2.7;
  if (fx * fx + fy * fy < 1) return (y === 4 && (x === 5 || x === 7)) ? '5' : '6';
  const hx = (x - 5.5) / 3.3, hy = (y - 4.6) / 4.2;
  if (hx * hx + hy * hy < 1 && y < 9) return '5';
  if (y >= 10 && x >= 4 && x <= 7) return '6';
  if (y >= 7 && Math.abs(x - 5.5) < 2.4 + (y - 7) * 0.8) return '7';
  return y < 4 ? '4' : '3';
});
// The Starry Night — Vincent van Gogh (MoMA, New York)
painting('pStarry', ['#1a2a6a', '#5a8ad8', '#f0d84a', '#141410', '#2a3a5a'], (x, y) => {
  const w = Math.max(0, (y - 1) / 4.5);
  if (x >= 1.5 - w && x <= 2.5 + w * 0.6 && y >= 1) return '6';
  for (const [sx, sy] of [[5, 2], [8, 4], [10, 1], [6, 6], [10, 7]]) {
    const d = Math.hypot(x - sx, y - sy);
    if (d < 0.8) return '5';
    if (d < 1.6) return '4';
  }
  if (y >= 9) return hash2(x, y, 3) < 0.15 ? '5' : '7';
  return Math.sin(x * 0.9 + y * 1.3) + Math.sin(y * 0.8 - x * 0.4) > 1.1 ? '4' : '3';
});
// The Great Wave off Kanagawa — Katsushika Hokusai
painting('pWave', ['#e8dcb8', '#1a3a7a', '#f2f0e8', '#5a6a8a', '#c8b080'], (x, y) => {
  if (Math.abs(x - 8.5) <= y - 6 && y >= 6 && y <= 9) return y === 6 ? '5' : '6';
  const d = Math.hypot(x - 3.2, y - 5.5);
  if (d > 3 && d < 4.6 && y < 7) return y < 3 && hash2(x, y, 4) < 0.5 ? '5' : '4';
  if (y >= 9 + Math.sin(x * 0.9)) return (y === 9 || hash2(x, y, 5) < 0.15) ? '5' : '4';
  if (y === 8 && x >= 9 && x <= 11) return '7';
  return '3';
});
// The Scream — Edvard Munch (National Museum, Oslo)
painting('pScream', ['#e8702a', '#c8402a', '#2a4a8a', '#8a6a3a', '#d8c8a0', '#1a1a20'], (x, y) => {
  const hx = (x - 6) / 1.5, hy = (y - 6) / 2;
  if (hx * hx + hy * hy < 1) return ((y === 5 && (x === 5 || x === 7)) || (y === 7 && x === 6)) ? '8' : '7';
  if (y >= 8 && y <= 11 && x >= 5 && x <= 7) return '8';
  if (Math.abs(y - (11 - x * 0.45)) < 0.7) return '6';
  if (y < 6) return Math.floor(y + Math.sin(x * 0.7) * 1.3) % 2 ? '3' : '4';
  return '5';
});
// Composition with Red, Blue and Yellow — Piet Mondrian
painting('pMondrian', ['#f0ece0', '#121212', '#d8302a', '#2a4ab8', '#f0c830'], (x, y) => {
  if (x === 3 || x === 9 || y === 4 || y === 9) return '4';
  if (x < 3 && y < 4) return '5';
  if (x > 9 && y > 9) return '6';
  if (x < 3 && y > 9) return '7';
  return '3';
});
// The Kiss — Gustav Klimt (Belvedere, Vienna)
painting('pKlimt', ['#d8a830', '#8a5a18', '#1a1208', '#f0e090', '#e8c8a0', '#c84a3a', '#3a8a6a'], (x, y) => {
  if (Math.hypot(x - 4.6, y - 2.6) < 1.4 || Math.hypot(x - 6.8, y - 3) < 1.3) return '7';
  const ox = (x - 6) / 4, oy = (y - 7) / 5.5;
  if (ox * ox + oy * oy < 1) {
    if ((x + y) % 4 === 0) return '5';
    if ((x * 7 + y * 3) % 11 === 0) return y > 7 ? '8' : '9';
    return (x * y) % 5 === 0 ? '6' : '3';
  }
  return hash2(x, y, 6) < 0.12 ? '6' : '4';
});
// Retro sunset grid
painting('pSunset', ['#3a1a5a', '#a83a8a', '#f07a5a', '#ffd060', '#ff4ad8', '#1a0a2a'], (x, y) => {
  if (y < 7) {
    if (Math.hypot(x - 5.5, y - 6) < 3.6 && y !== 4 && y !== 6) return '6';
    return y < 2 ? '3' : y < 4 ? '4' : '5';
  }
  if (y === 7 || y === 9 || y === 11) return '7';
  return Math.abs((x - 5.5) * 7 / (y - 5)) % 3 < 0.5 ? '7' : '8';
});
// Egyptian wall panel with the Eye of Horus
painting('pHiero', ['#c8a060', '#5a3a1a', '#2a6ab0', '#b83a2a'], (x, y) => {
  if (y >= 1 && y <= 3 && x >= 3 && x <= 8) {
    const eye = ['.4444.', '455554', '.4444.'];
    const c = eye[y - 1][x - 3];
    return c === '.' ? '3' : c;
  }
  if (y === 4 && (x === 5 || x === 6)) return '4';
  if (y > 5 && x % 4 !== 3 && hash2(x >> 2, y >> 1, 7) < 0.6 && (x + y) % 2 === 0) return hash2(x, y, 8) < 0.2 ? '6' : '4';
  return '3';
});
// Fine Wind, Clear Morning ("Red Fuji") — Katsushika Hokusai
painting('pFuji', ['#4a7ac8', '#8ab0e0', '#b8402a', '#f2f0e8', '#3a6a3a'], (x, y) => {
  const half = (y - 2) * 0.9;
  if (y >= 2 && Math.abs(x - 6) <= half) {
    if (y < 4) return '6';
    if (y >= 10) return '7';
    return '5';
  }
  if (y < 4 && hash2(x, y, 9) < 0.3) return '4';
  return y < 5 ? '3' : '4';
});
const PAINTINGS = ['pMona', 'pStarry', 'pWave', 'pScream', 'pMondrian', 'pKlimt', 'pSunset', 'pHiero', 'pFuji'];

// --- centrepieces ----------------------------------------------------------------
// Moai — Rapa Nui (Easter Island)
defGlyph('moai', rowsFrom(16, 24, (x, y) => {
  if (y < 4) return x >= 4 && x <= 11 ? '3' : '';
  if (y < 18) {
    if (x < 2 || x > 13) return '';
    if (y === 7 && x >= 3 && x <= 12) return '2';
    if (y >= 8 && y <= 9 && ((x >= 4 && x <= 5) || (x >= 10 && x <= 11))) return '2';
    if (x >= 7 && x <= 8 && y >= 8 && y <= 13) return '1';
    if (x === 9 && y >= 9 && y <= 13) return '2';
    if (y >= 14 && y <= 15 && x >= 5 && x <= 10) return y === 14 ? '2' : '1';
    return x < 4 || x > 11 ? '2' : '1';
  }
  if (x < 1 || x > 14) return '';
  return x === 3 || x === 12 ? '2' : '1';
}), ['#6a6a72', '#3a3a44', '#8a3a2a']);
// A giant blinking eye
defGlyph('giantEye', [1, 1, 1, 0.45, 0.08, 0.45].map((open) => rowsFrom(16, 16, (x, y) => {
  const ax = (x - 7.5) / 7.5;
  const half = 6 * Math.sqrt(Math.max(0, 1 - ax * ax));
  const dy = Math.abs(y - 7.5);
  if (dy > half + 0.6) return '';
  if (dy > half * open - 0.4) return dy > half - 0.6 || open < 0.2 ? '5' : '4';
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (x === 6 && y === 6) return '1';
  return d < 1.6 ? '3' : d < 3.6 ? '2' : '1';
})), ['#f2eee8', '#3a7ad8', '#0a0a10', '#c88878', '#3a1a1a'], { anim: 1.2, emit: [2] });
// A melting clock
defGlyph('meltClock', rowsFrom(16, 16, (x, y) => {
  const ox = (x - 8) / 7, oy = (y - 6) / 4.6;
  const body = ox * ox + oy * oy < 1;
  const drip = (x >= 2 && x <= 5 && y >= 7 && y <= 13 - Math.abs(x - 3.5)) || (x >= 10 && x <= 11 && y >= 8 && y <= 12);
  if (!body && !drip) return '';
  const rim = body && ox * ox + oy * oy > 0.7;
  if (rim || (drip && (x === 2 || x === 5 || x === 10 || x === 11))) return '1';
  if ((x === 8 && y >= 3 && y <= 6) || (y === 6 && x >= 8 && x <= 11)) return '3';
  if ((x === 8 && y === 2) || (x === 13 && y === 6) || (x === 3 && y === 6)) return '3';
  return '2';
}), ['#c8a040', '#e8e0c0', '#2a2a2a']);
// Torii gate — Japan
defGlyph('torii', rowsFrom(24, 24, (x, y) => {
  if (y === 0) return x < 2 || x > 21 ? '2' : '';
  if (y <= 2) return '2';
  if (y <= 4) return x >= 1 && x <= 22 ? '1' : '';
  if (y === 7) return x >= 2 && x <= 21 ? '1' : '';
  if (y >= 5 && y <= 6 && x >= 11 && x <= 12) return '1';
  if ((x >= 4 && x <= 5) || (x >= 18 && x <= 19)) return y >= 22 ? '2' : '1';
  return '';
}), ['#d8302a', '#1a1a1a']);
// Pyramid with the all-seeing eye — Giza
defGlyph('pyramid', rowsFrom(24, 16, (x, y) => {
  if (Math.abs(x - 11.5) > y * 0.75 + 0.5) return '';
  if (y >= 6 && y <= 8 && Math.abs(x - 11.5) < 3 - Math.abs(y - 7)) return Math.abs(x - 11.5) < 1 && y === 7 ? '4' : '3';
  if (y % 3 === 2) return '2';
  return x < 11.5 ? '1' : '2';
}), ['#d8a840', '#a87020', '#f2f0e8', '#1a3a7a'], { emit: [3, 4], light: { c: '#ffd070', r: 50, i: 0.6, f: 0.05, ox: 12, oy: -1 } });
// Greek marble bust on a neon plinth
defGlyph('bust', rowsFrom(16, 16, (x, y) => {
  if (y >= 14) return x >= 3 && x <= 12 ? '3' : '';
  if (y >= 12) return x >= 2 && x <= 13 ? (x > 8 ? '2' : '1') : '';
  if (y >= 10) return x >= 6 && x <= 9 ? '1' : '';
  const hx = (x - 7.5) / 4, hy = (y - 5) / 5;
  if (hx * hx + hy * hy < 1) return y < 3 && (x + y) % 2 ? '2' : (x > 8 ? '2' : '1');
  if (x >= 2 && x <= 3 && y >= 5 && y <= 6) return '1';
  return '';
}), ['#e8e4f0', '#a8a0c0', '#ff6ad8'], { emit: [3], light: { c: '#ff6ad8', r: 40, i: 0.7, f: 0.05, ox: 8, oy: 6 } });
// Maneki-neko — the beckoning cat
defGlyph('maneki', [0, 1].map((up) => rowsFrom(16, 16, (x, y) => {
  const paw = up ? (x >= 11 && x <= 13 && y >= 1 && y <= 5) : (x >= 11 && x <= 13 && y >= 4 && y <= 8);
  if (paw) return '1';
  if ((x === 4 || x === 9) && y === 2) return '1';
  const hx = (x - 6.5) / 4, hy = (y - 5) / 3;
  if (hx * hx + hy * hy < 1) return (y === 5 && (x === 5 || x === 8)) ? '4' : '1';
  if (y === 8 && x >= 3 && x <= 10) return '2';
  if (y === 9 && x >= 6 && x <= 7) return '3';
  if (y >= 9 && y <= 15 && x >= 2 && x <= 11) return y === 15 || x === 2 || x === 11 ? '5' : '1';
  return '';
})), ['#f2f0e8', '#d8302a', '#f0c030', '#1a1a1a', '#c8c0b0'], { anim: 1.5, emit: [3] });
// Calavera — Día de Muertos sugar skull
defGlyph('calavera', rowsFrom(16, 16, (x, y) => {
  const hx = (x - 7.5) / 7, hy = (y - 6.5) / 6.5;
  const head = hx * hx + hy * hy < 1;
  const jaw = y >= 11 && y <= 15 && x >= 4 && x <= 11;
  if (!head && !jaw) return '';
  for (const ex of [4.5, 10.5]) {
    const d = Math.hypot(x - ex, y - 7);
    if (d < 1.3) return '3';
    if (d < 2.3) return (x + y) % 2 ? '2' : '4';
  }
  if (y >= 9 && y <= 10 && x >= 7 && x <= 8) return '5';
  if (y >= 12 && (x % 2 === 0)) return '5';
  if (y < 4 && Math.hypot(x - 7.5, y - 2) < 1.5) return '6';
  return '1';
}), ['#f2eee0', '#ff4a8a', '#ff8a2a', '#4ad8c8', '#1a1a1a', '#f0d040'], { emit: [2, 3, 4, 6] });
// Cypress tree (as in The Starry Night)
defGlyph('cypress', rowsFrom(8, 24, (x, y) => {
  const w = Math.min(3.6, 0.5 + y * 0.24) - (y > 20 ? (y - 20) * 0.7 : 0);
  return Math.abs(x - 3.5) < w ? ((x * 3 + y) % 4 ? '1' : '2') : '';
}), ['#16241a', '#2e4a2e']);

// --- props -------------------------------------------------------------------------
defGlyph('lanternRed', ['...2....', '.11111..', '1311131.', '1111111.', '1311131.', '.11111..', '...2....', '........'],
  ['#e8302a', '#1a1a1a', '#ffd080'], { emit: [1, 3], light: { c: '#ff5a3a', r: 32, i: 0.7, f: 0.1, ox: 3.5, oy: 3.5 } });
defGlyph('vending', ['11111111', '12222221', '12343431', '12222221', '12434341', '12222221', '12343431', '12222221',
  '11111111', '15555551', '15666651', '15555551', '11111111', '11111111', '11171111', '11111111'],
['#e8e8f0', '#bff4ff', '#e8302a', '#2a6ad8', '#3a3a44', '#0a0a10', '#ffd040'],
{ emit: [2, 3, 4, 7], light: { c: '#bff4ff', r: 40, i: 0.8, f: 0.04, ox: 4, oy: -2 } });
variant('vendingRed', 'vending', ['#c8302a', '#fff0c0', '#2a6ad8', '#f0c030', '#3a1a1a', '#0a0a10', '#ffd040']);
defGlyph('phoneBox', ['..1111..', '.111111.', '11333311', '11111111', '12211221', '12211221', '11111111', '12211221',
  '12211221', '11111111', '12211221', '12211221', '11111111', '11111111', '11111111', '11111111'],
['#c8202a', '#ffe8a0', '#f2f0e8'], { emit: [2, 3], light: { c: '#ffd890', r: 34, i: 0.6, f: 0.05, ox: 4, oy: -2 } });
defGlyph('streetLamp', ['..222...', '.22222..', '..111...', '...1....', '...1....', '...1....', '...1....', '...1....',
  '...1....', '...1....', '...1....', '...1....', '...1....', '...1....', '...1....', '..111...'],
['#1a1a20', '#ffe0a0'], { emit: [2], light: { c: '#ffd890', r: 56, i: 0.9, f: 0.04, ox: 3.5, oy: -6 } });
defGlyph('cone', ['........', '...1....', '..121...', '..111...', '.12221..', '.11111..', '1111111.', '........'], ['#ff7a1a', '#f2f0e8']);
defGlyph('column', ['11111111', '.111111.', '.121212.', '.121212.', '.121212.', '.121212.', '.121212.', '.121212.',
  '.121212.', '.121212.', '.121212.', '.121212.', '.121212.', '.121212.', '.111111.', '11111111'], ['#e8e4f0', '#a8a0c0']);
variant('palmVapor', 'palm', ['#4ae8f0', '#ff6ad8'], { emit: true });
defGlyph('bowler', bob(['........', '........', '..111...', '.11111..', '.11111..', '.12221..', '1111111.', '........']),
  ['#1a1a20', '#3a3a4a'], { anim: 1.4 });
defGlyph('apple', bob(['....3...', '...3.2..', '.11.11..', '1111111.', '1121111.', '1111111.', '.11111..', '..1.1...']),
  ['#6ac83a', '#c8f08a', '#5a3a1a'], { anim: 1.1 });
defGlyph('umbrella', bob(['..111...', '.11111..', '1111111.', '1.1.1.1.', '...2....', '...2....', '...2....', '..22....']),
  ['#1a1a24', '#8a6a3a'], { anim: 0.9 });
defGlyph('eyeFloat', bob(['..1111..', '.111111.', '11122111', '11233211', '11122111', '.111411.', '..1111..', '........']),
  ['#f2eee8', '#3a7ad8', '#0a0a10', '#d83a3a'], { anim: 1.3, emit: [2] });
defGlyph('starProp', bob(['...1....', '...1....', '.11111..', '..111...', '.1...1..', '........', '........', '........']),
  ['#fff0a0'], { anim: 1, emit: true, light: { c: '#fff0a0', r: 16, i: 0.5, f: 0.3, ox: 3.5, oy: 3 } });
defGlyph('moonProp', bob(['..111...', '.11.....', '11......', '11......', '11......', '.11.....', '..111...', '........']),
  ['#f8f0c0'], { anim: 0.7, emit: true, light: { c: '#f8f0c0', r: 22, i: 0.5, f: 0.05, ox: 2, oy: 3 } });
defGlyph('marigold', ['........', '.1.1.1..', '..121...', '.12221..', '..121...', '.1.1.1..', '...3....', '..333...'],
  ['#ff8a1a', '#ffd040', '#3a8a3a'], { emit: [1, 2] });
defGlyph('calaveraSmall', ['.111111.', '11111111', '12211221', '12311321', '11144111', '.141414.', '.111111.', '........'],
  ['#f2eee0', '#1a1a1a', '#ff4a8a', '#3a2a2a'], { emit: [3] });
defGlyph('stanchion', ['...11...', '...11...', '...12222', '...1....', '...1....', '...1....', '..111...', '.11111..'], ['#d8a840', '#a81a2a']);
defGlyph('bench', ['........', '........', '11111111', '12222221', '.1....1.', '.1....1.', '........', '........'], ['#5a3a1a', '#8a5a2a']);
defGlyph('tvStatic', [0, 1, 2].map((f) => rowsFrom(8, 8, (x, y) => {
  if (y === 7) return x === 1 || x === 6 ? '1' : '';
  if (y === 0 || y === 6 || x === 0 || x === 7) return '1';
  const h = hash2(x, y, 40 + f);
  return h < 0.33 ? '2' : h < 0.66 ? '3' : '4';
})), ['#3a3a44', '#f2f0e8', '#8a8a96', '#4a4a56'], { anim: 12, emit: [2, 3] });
defGlyph('coral', ['1..1....', '1.11..1.', '.1.1.1..', '..111.1.', '...1.1..', '...111..', '....1...', '...111..'],
  ['#ff6a9a'], { emit: true });
defGlyph('seaweed', [
  ['...1....', '..1.....', '..1.....', '...1....', '...1....', '..1.....', '..1.1...', '..111...'],
  ['..1.....', '...1....', '...1....', '..1.....', '..1.....', '...1....', '..1.1...', '..111...'],
], ['#3aa86a'], { anim: 1.5 });
defGlyph('doorLone', ['.111111.', '.122221.', '.122221.', '.122221.', '.122221.', '.122221.', '.122221.', '.122221.',
  '.122231.', '.122221.', '.122221.', '.122221.', '.122221.', '.122221.', '.122221.', '11111111'],
['#6a3a8a', '#b06ad8', '#f0c030'], { emit: [3] });
variant('stairsNowhere', 'stairs', ['#a89a80']);
for (let d = 0; d < 10; d++) {
  defGlyph('num' + d, rowsFrom(8, 8, (x, y) => {
    const g = DIGITS[d];
    return (y >= 1 && y < 6 && x >= 2 && x < 5 && g[y - 1][x - 2] === '1') ? '1' : '';
  }), ['#6a5a40']);
}
defGlyph('pawn', ['...11...', '..1111..', '...11...', '..1111..', '...11...', '..1111..', '.111111.', '11111111'], ['#1a1a24']);
variant('pawnW', 'pawn', ['#e8e4d8']);
defGlyph('king', ['...1....', '..111...', '...1....', '..111...', '.11111..', '.11111..', '..111...', '..111...',
  '..111...', '..111...', '.11111..', '..111...', '..111...', '.11111..', '1111111.', '1111111.'], ['#1a1a24']);
variant('kingW', 'king', ['#e8e4d8']);

// --- walls ---------------------------------------------------------------------------
defGlyph('eyeWall', [
  ['11111111', '11111111', '11222211', '12233221', '12344321', '12233221', '11222211', '11111111'],
  ['11111111', '11111111', '11222211', '12233221', '12344321', '12233221', '11222211', '11111111'],
  ['11111111', '11111111', '11222211', '12333221', '13443321', '12333221', '11222211', '11111111'],
  ['11111111', '11111111', '11111111', '11111111', '11555511', '11111111', '11111111', '11111111'],
], ['#7a2a3a', '#f2eee8', '#3a7ad8', '#0a0a10', '#3a0a14'], { anim: 1.1 });
defGlyph('goldTile', ['11111111', '12222221', '12111121', '12122121', '12121121', '12111121', '12222221', '11111111'],
  ['#d8a830', '#6a4010'], { emit: [1] });
defGlyph('neonWall', ['11111111', '11111111', '22222222', '11111111', '11111111', '11111111', '11111111', '11111111'],
  ['#1a0a2a', '#ff4ad8'], { emit: [2] });
variant('neonWallCyan', 'neonWall', ['#0a1a2a', '#4ae8f0']);
defGlyph('hieroWall', ['11111111', '12111211', '12121211', '11121111', '11111111', '11211121', '12221121', '11111111'],
  ['#c8a060', '#7a5a2a']);
defGlyph('shojiWall', ['11111111', '1223223.', '1223223.', '11111111', '1223223.', '1223223.', '11111111', '1223223.'],
  ['#5a3a1a', '#e8e0c8', '#d8d0b8']);
variant('brickMondrian', 'brick', ['#121212']);
variant('brickNight', 'brick', ['#2a3a7a']);
variant('brickSand', 'brick', ['#a87a40']);
variant('brickPurple', 'brick', ['#6a2a7a']);
variant('brickPale', 'brick', ['#d0ccc4']);
variant('brickDark', 'brick', ['#3a3a44']);
variant('brickOrange', 'brick', ['#a84a2a']);
variant('rockSea', 'caveRock', ['#2a6a7a', '#123040']);
variant('rockMoss', 'caveRock', ['#4a5a3a', '#22301a']);

// --- dream dwellers (creatures) --------------------------------------------------------
defGlyph('c_birdfolk', [
  ['..111...', '.11111..', '.11121..', '.1111333', '..111...', '...4....', '..444...', '.44444..',
    '.44444..', '.44444..', '.44444..', '4444444.', '.44444..', '..4.4...', '..4.4...', '.44.44..'],
  ['..111...', '.11111..', '.11121..', '.1111333', '..111...', '...4....', '..444...', '.44444..',
    '.44444..', '.44444..', '.44444..', '4444444.', '.44444..', '...44...', '..4..4..', '.4....4.'],
], ['#d8d0e8', '#1a1a1a', '#e8c040', '#a83a6a']);
defGlyph('c_shadow', [
  ['..1111..', '.111111.', '.121121.', '.111111.', '..1111..', '...11...', '.111111.', '11111111',
    '1.1111.1', '1.1111.1', '..1111..', '..1111..', '..1..1..', '..1..1..', '..1..1..', '.11..11.'],
  ['..1111..', '.111111.', '.121121.', '.111111.', '..1111..', '...11...', '.111111.', '11111111',
    '1.1111.1', '1.1111.1', '..1111..', '..1111..', '..1..1..', '.1....1.', '.1....1.', '11....11'],
], ['#1a1024', '#f2f0e8'], { emit: [2] });
defGlyph('c_tvhead', [
  ['.2...2..', '..2.2...', '2222222.', '2333432.', '2343332.', '2333332.', '2222222.', '...1....',
    '.11111..', '1111111.', '1.111.1.', '1.111.1.', '..111...', '..1.1...', '..1.1...', '.11.11..'],
  ['.2...2..', '..2.2...', '2222222.', '2343332.', '2333432.', '2334332.', '2222222.', '...1....',
    '.11111..', '1111111.', '1.111.1.', '1.111.1.', '..111...', '..1.1...', '.1...1..', '11...11.'],
], ['#3a3a4a', '#8a8a90', '#9ae8ff', '#f2f0e8'], { emit: [3, 4] });
defGlyph('c_skeleton', [
  ['.3.3.3..', '.11111..', '.12121..', '.11111..', '..121...', '...1....', '1.111.1.', '.1.1.1..',
    '..111...', '...1....', '..111...', '..1.1...', '..1.1...', '.1...1..', '.1...1..', '11...11.'],
  ['.3.3.3..', '.11111..', '.12121..', '.11111..', '..121...', '1..1..1.', '.11111..', '...1....',
    '..111...', '...1....', '..111...', '..1.1...', '.1...1..', '.1...1..', '1.....1.', '1.....1.'],
], ['#f0ecd8', '#1a1a1a', '#ff8a1a'], { emit: [3] });
defGlyph('c_tourist', [
  ['..111...', '.11111..', '.11111..', '.11111..', '..111...', '..222...', '.22222..', '.22442..',
    '.22442..', '.22222..', '..333...', '..3.3...', '..3.3...', '..3.3...', '..3.3...', '.33.33..'],
  ['..111...', '.11111..', '.11111..', '.11111..', '..111...', '..222...', '.22222..', '.22442..',
    '.22442..', '.22222..', '..333...', '..3.3...', '.3...3..', '.3...3..', '.3...3..', '33...33.'],
], ['#d8c8b8', '#4a8ad8', '#3a3a4a', '#1a1a1a']);
defGlyph('c_knight', [
  ['....11..', '...1111.', '..112111', '.1111111', '1111.11.', '111.....', '1111....', '.1111...',
    '.11111..', '..1111..', '..1111..', '.111111.', '.111111.', '11111111', '.1....1.', '.1....1.'],
  ['....11..', '...1111.', '..112111', '.1111111', '1111.11.', '111.....', '1111....', '.1111...',
    '.11111..', '..1111..', '..1111..', '.111111.', '.111111.', '11111111', '..1..1..', '.1....1.'],
], ['#1a1a24', '#8a8a96']);
variant('c_knightW', 'c_knight', ['#e8e4d8', '#3a3a44']);
defGlyph('c_koi', [
  ['........', '....11..', '1..12111', '11122131', '11111111', '1..1111.', '....1...', '........'],
  ['........', '....11..', '...12111', '1.122131', '11111111', '...1111.', '1...1...', '........'],
], ['#ff7a2a', '#f2f0e8', '#1a1a1a'], { tags: 'float' });
defGlyph('c_jelly', [
  ['..1111..', '.112211.', '11111111', '.3.3.3..', '.3.3.3..', '3.3.3...', '........', '........'],
  ['..1111..', '.112211.', '11111111', '..3.3.3.', '..3.3.3.', '...3.3.3', '........', '........'],
], ['#d8a8ff', '#ffffff', '#a87ad8'], { emit: true, tags: 'float' });
defGlyph('c_eyeball', [
  ['..1111..', '.111111.', '11112211', '11123321', '11112211', '.111111.', '..4..4..', '.4....4.'],
  ['..1111..', '.111111.', '11112211', '11123321', '11112211', '.111111.', '...44...', '..4..4..'],
], ['#f2eee8', '#3a7ad8', '#0a0a10', '#c83a3a'], { emit: [2] });

// --- floor patterns --------------------------------------------------------------------
const FLOORS = {
  mondrian: (x, y, h) => (x % 7 === 0 || y % 6 === 0) ? 1 : (() => {
    const b = hash2(Math.floor(x / 7), Math.floor(y / 6), 31);
    return b < 0.14 ? 2 : b < 0.24 ? 3 : b < 0.32 ? 4 : 0;
  })(),
  swirl: (x, y) => Math.floor((Math.sin(x * 0.5 + y * 0.3) + Math.sin(y * 0.45 - x * 0.2 + Math.hypot(x, y) * 0.3) + 2) * 0.74) % 3,
  tatami: (x, y) => ((x >> 1) + (y >> 2)) % 2,
  asphalt: (x, y, h) => (y % 7 === 0 && x % 4 < 2) ? 3 : h < 0.12 ? 1 : h > 0.96 ? 2 : 0,
  bands: (x, y) => ((Math.floor(y * 0.7 + Math.sin(x * 0.35 + y * 0.2) * 2) % 4) + 4) % 4,
  veins: (x, y, h) => Math.abs(Math.sin(x * 0.7 + Math.sin(y * 0.5) * 2)) < 0.14 ? 2 : (h < 0.5 ? 0 : 1),
  grid: (x, y) => (x % 4 === 0 || y % 4 === 0) ? 1 : 0,
  grass: (x, y, h) => h < 0.45 ? 0 : h < 0.85 ? 1 : 2,
  sandstone: (x, y, h) => (((y & 1 ? x + 1 : x) >> 1) + y) % 3 === 0 ? 1 : (h < 0.05 ? 2 : 0),
  checker: (x, y) => (x + y) % 2,
  dunes: (x, y, h, W, H) => Math.min(2, Math.floor(y / (H / 3))) === 1 ? (h < 0.08 ? 3 : 1) : (Math.floor(y / (H / 3)) < 1 ? 0 : 2),
  papel: (x, y) => y % 5 === 0 ? 2 + (x % 4) : ((x + y) % 2),
  mosaic: (x, y, h) => h < 0.55 ? 0 : h < 0.85 ? 1 : h < 0.95 ? 2 : 3,
  parquet: (x, y) => ((x >> 1) + (y >> 1)) % 2,
  caustic: (x, y) => Math.floor((Math.sin(x * 0.6 + Math.sin(y * 0.4) * 2) + Math.sin(y * 0.5 + x * 0.2) + 2) * 0.74) % 3,
};

// --- themes ----------------------------------------------------------------------------
// floor: colours used by the pattern; wall: glyph(s) that replace plain walls;
// paint: paintings hung on walls; centre: centrepieces; props: [glyph, per 100
// floor tiles, solid]; npcs: dream-dwellers; parts: ambient particles;
// fx: screen effects (warp, hue drift, sepia, chroma).
const THEMES = [
  { name: 'mondrian', light: 0.35, floor: ['#f0ece0', '#121212', '#d8302a', '#2a4ab8', '#f0c830'], pat: 'mondrian', wallBg: '#e8e4d8', wall: ['brickMondrian'],
    paint: ['pMondrian'], centre: [], props: [['starProp', 0.6, 0]], npcs: ['c_shadow', 'c_tourist'], parts: ['confettiY', 'confettiR', 'confettiB'],
    amb: [0.62, 0.6, 0.56], fx: {} },
  { name: 'starry', floor: ['#141c48', '#1e2a62', '#2a3a80'], pat: 'swirl', wallBg: '#0a1030', wall: ['brickNight'],
    paint: ['pStarry'], centre: ['cypress'], props: [['starProp', 1.2, 0], ['moonProp', 0.2, 0], ['cypress', 0.3, 1]], npcs: ['c_shadow', 'c_birdfolk'],
    parts: ['star', 'firefly'], fx: { warp: 0.6 } },
  { name: 'wave', light: 0.35, floor: ['#d8c8a0', '#c8b890'], pat: 'tatami', wallBg: '#e8e0c8', wall: ['shojiWall'],
    paint: ['pWave', 'pFuji'], centre: ['torii', 'maneki'], props: [['lanternRed', 0.7, 1], ['pineDark', 0.4, 1]], npcs: ['c_koi', 'c_cat'],
    parts: ['petal'], amb: [0.55, 0.5, 0.48], fx: {} },
  { name: 'nightcity', floor: ['#16161e', '#1e1e28', '#2a2a44', '#8a7a30'], pat: 'asphalt', wallBg: '#0a0a14', wall: ['neonWall', 'neonWallCyan'],
    paint: ['pSunset'], centre: ['maneki'], props: [['vending', 0.5, 1], ['vendingRed', 0.3, 1], ['phoneBox', 0.25, 1], ['streetLamp', 0.4, 1], ['cone', 0.5, 1], ['tvStatic', 0.4, 1]],
    npcs: ['c_tvhead', 'c_shadow'], parts: ['rain'], fx: { ca: 1.2 } },
  { name: 'scream', floor: ['#e8702a', '#c8402a', '#2a4a8a', '#3a5aa0'], pat: 'bands', wallBg: '#5a1a10', wall: ['brickOrange'],
    paint: ['pScream'], centre: [], props: [['deadTree', 0.4, 1]], npcs: ['c_shadow', 'c_tourist'], parts: ['ash'], amb: [0.55, 0.4, 0.35], fx: { warp: 1.3 } },
  { name: 'eyes', floor: ['#3a0e18', '#4a1420', '#7a2a3a'], pat: 'veins', wallBg: '#3a0a14', wall: ['eyeWall'],
    paint: [], centre: ['giantEye'], props: [['eyeFloat', 1, 0]], npcs: ['c_eyeball', 'c_shadow'], parts: ['mote'], fx: { warp: 0.4, hue: 0.12 } },
  { name: 'numbers', light: 0.3, floor: ['#d8ccb0', '#c8bca0'], pat: 'grid', wallBg: '#a89a80', wall: ['brickSand'],
    paint: [], centre: [], props: [['num0', 0.4, 0], ['num1', 0.4, 0], ['num2', 0.4, 0], ['num3', 0.4, 0], ['num4', 0.4, 0], ['num5', 0.4, 0], ['num6', 0.4, 0],
      ['num7', 0.4, 0], ['num8', 0.4, 0], ['num9', 0.4, 0], ['doorLone', 0.3, 1], ['stairsNowhere', 0.3, 1]],
    npcs: ['c_birdfolk'], parts: [], amb: [0.55, 0.52, 0.48], fx: { mono: 0.85 } },
  { name: 'rapanui', floor: ['#1a2a14', '#22341a', '#2a4020'], pat: 'grass', wallBg: '#101a0c', wall: ['rockMoss'],
    paint: [], centre: ['moai', 'moai', 'moai'], props: [['stone', 0.4, 1], ['tuft', 1, 0], ['flower', 0.4, 0]], npcs: ['c_bird'],
    parts: ['star', 'firefly'], fx: {} },
  { name: 'giza', light: 0.45, floor: ['#c8a060', '#b89050', '#8a6a3a'], pat: 'sandstone', wallBg: '#8a6a3a', wall: ['hieroWall'],
    paint: ['pHiero'], centre: ['pyramid'], props: [['obelisk', 0.25, 1], ['palm', 0.3, 1], ['pot', 0.4, 1]], npcs: ['c_cat'],
    parts: ['dust'], amb: [0.6, 0.5, 0.4], fx: { warp: 0.35 } },
  { name: 'vapor', light: 0.6, floor: ['#c84aa8', '#3ab8c8'], pat: 'checker', wallBg: '#1a0a2a', wall: ['neonWall'],
    paint: ['pSunset'], centre: ['bust'], props: [['column', 0.5, 1], ['palmVapor', 0.5, 1]], npcs: ['c_shadow', 'c_tvhead'],
    parts: ['star'], fx: { hue: 0.25 } },
  { name: 'melting', light: 0.45, floor: ['#6a8ab8', '#d8a860', '#c89050', '#a87040'], pat: 'dunes', wallBg: '#5a4020', wall: ['brickSand'],
    paint: ['pStarry', 'pMona'], centre: ['meltClock'], props: [['bowler', 0.5, 0], ['apple', 0.5, 0], ['umbrella', 0.4, 0], ['doorLone', 0.2, 1], ['deadTree', 0.3, 1]],
    npcs: ['c_shadow'], parts: [], amb: [0.6, 0.52, 0.45], fx: { warp: 0.9 } },
  { name: 'muertos', light: 0.8, floor: ['#2a1030', '#3a1a40', '#ff6a2a', '#ff4a8a', '#4ad8c8', '#f0d040'], pat: 'papel', wallBg: '#1a0820', wall: ['brickPurple'],
    paint: [], centre: ['calavera'], props: [['marigold', 1.4, 0], ['calaveraSmall', 0.5, 0], ['candle', 0.5, 1]], npcs: ['c_skeleton'],
    parts: ['confettiR', 'confettiY', 'confettiB'], fx: {} },
  { name: 'klimt', light: 0.6, floor: ['#8a5a18', '#d8a830', '#1a1208', '#f0e090'], pat: 'mosaic', wallBg: '#3a2408', wall: ['goldTile'],
    paint: ['pKlimt'], centre: [], props: [['candle', 0.4, 1], ['starProp', 0.5, 0]], npcs: ['c_shadow', 'c_birdfolk'], parts: ['gold'], fx: {} },
  { name: 'gallery', light: 0.45, floor: ['#5a3a20', '#6a4a28'], pat: 'parquet', wallBg: '#e8e4dc', wall: ['brickPale'],
    paint: PAINTINGS, paintMany: true, centre: [], props: [['stanchion', 0.5, 1], ['bench', 0.4, 1]], npcs: ['c_tourist', 'c_tourist'],
    parts: [], amb: [0.62, 0.58, 0.54], fx: {} },
  { name: 'chess', light: 0.35, floor: ['#e8e4d8', '#1a1a24'], pat: 'checker', wallBg: '#2a2a34', wall: ['brickDark'],
    paint: ['pMondrian'], centre: [], props: [['pawn', 0.5, 1], ['pawnW', 0.5, 1], ['king', 0.15, 1], ['kingW', 0.15, 1]], npcs: ['c_knight', 'c_knightW'],
    parts: [], amb: [0.55, 0.54, 0.52], fx: {} },
  { name: 'aquarium', floor: ['#0a2a4a', '#0e3458', '#123e66'], pat: 'caustic', wallBg: '#06182a', wall: ['rockSea'],
    paint: ['pWave'], centre: [], props: [['coral', 0.8, 0], ['seaweed', 1, 0]], npcs: ['c_koi', 'c_jelly', 'c_jelly'], parts: ['bubbleUp'], fx: { warp: 0.8 } },
];

// Interior wall glyphs that are plain masonry/rock and may be re-skinned.
const PLAIN_WALLS = new Set(['brick', 'brickStone', 'brickRed', 'brickIce', 'wallWood', 'wallStone', 'caveRock', 'caveRock2', 'caveRockIce',
  'caveRock2Ice', 'caveRockDungeon', 'caveRockBrown', 'caveRock2Brown', 'caveRockOre', 'root'].map((n) => G[n]));
// Floor clutter that would fight the dream floor.
const CLUTTER = new Set(['speck', 'speck2', 'speckCave', 'speckNavy', 'speckSnow', 'grassCave', 'grassDark', 'dotgridIce', 'plank', 'rootDark']
  .map((n) => G[n]));

function dreamTheme(ent) {
  const id = String(ent.id);
  return THEMES[(Math.abs(hashStr(id)) + (ent.depth || 0) * 5) % THEMES.length];
}

// Dreamlike biome floors inside the world-boss lairs, two per boss (in the
// order of WORLD_BOSSES: spider, slime, ghost, dragon, garbage). foes: the
// enemies that roam them.
const LAIR_THEMES = [
  [{ name: 'webs', floor: ['#0e1a16', '#14241e', '#1e3a2a'], pat: 'veins', wallBg: '#060c0a', wall: ['rockMoss'], paint: [], centre: ['deadTree'],
    props: [['cobweb', 2.2, 0], ['deadTreeDark', 0.4, 1], ['grave', 0.3, 1], ['torchGreen', 0.25, 1]], npcs: [], foes: ['c_spider', 'c_spider', 'c_bat'],
    parts: ['wisp', 'mote'], amb: [0.32, 0.4, 0.34], fx: { warp: 0.5 } },
   { name: 'webs2', floor: ['#1a0e1e', '#24142a', '#3a1e3a'], pat: 'swirl', wallBg: '#0a060c', wall: ['rockMoss'], paint: [], centre: ['giantEye'],
    props: [['cobweb', 2.6, 0], ['eyeFloat', 0.5, 0], ['deadTreeDark', 0.5, 1], ['torchGreen', 0.25, 1]], npcs: [], foes: ['c_spider', 'c_spider', 'c_eyeball'],
    parts: ['wisp'], amb: [0.36, 0.3, 0.4], fx: { warp: 0.8, hue: 0.05 } }],
  [{ name: 'spores', floor: ['#1a2a10', '#24381a', '#3a2a4a'], pat: 'grass', wallBg: '#0c1408', wall: ['rockMoss'], paint: [], centre: ['mushroomBig'],
    props: [['glowShroom', 1.4, 0], ['glowShroomPurple', 0.9, 0], ['mushSmall', 0.8, 1], ['mushBrown', 0.8, 0]], npcs: ['c_frog'], foes: ['c_slime', 'c_slime'],
    parts: ['spore', 'firefly'], amb: [0.4, 0.44, 0.4], fx: { hue: 0.06 } },
   { name: 'spores2', floor: ['#2a1a3a', '#3a2450', '#4ad8c8'], pat: 'caustic', wallBg: '#140a1e', wall: ['brickPurple'], paint: [], centre: ['mushroomBig', 'mushroomBig'],
    props: [['glowShroomPurple', 1.6, 0], ['glowShroom', 1, 0], ['bubble', 0.6, 0]], npcs: [], foes: ['c_slime', 'c_slime', 'c_frog'],
    parts: ['spore', 'bubbleUp'], amb: [0.42, 0.36, 0.46], fx: { warp: 0.7, hue: 0.12 } }],
  [{ name: 'frost', floor: ['#16263a', '#1e3450', '#8ccaf0'], pat: 'mosaic', wallBg: '#08101a', wall: ['brickIce'], paint: [], centre: ['crystalBigCyanLit'],
    props: [['crystalIce', 0.8, 1], ['iceBlock', 0.6, 1], ['snowflake', 1.2, 0], ['lanternBlue', 0.2, 1]], npcs: [], foes: ['c_ghost', 'c_ghost', 'c_bat'],
    parts: ['snow', 'shard'], amb: [0.42, 0.48, 0.6], fx: { mono: 0.25 } },
   { name: 'frost2', floor: ['#e4eef6', '#c8d8e8', '#8ccaf0'], pat: 'checker', light: 0.5, wallBg: '#5a94c0', wall: ['brickIce'], paint: [], centre: ['crystalBigLit'],
    props: [['crystalIce', 0.8, 1], ['pineIce', 0.6, 1], ['snowflake', 1.4, 0], ['grave', 0.3, 1]], npcs: [], foes: ['c_ghost', 'c_ghost', 'c_shadow'],
    parts: ['snow', 'star'], amb: [0.58, 0.6, 0.66], fx: { warp: 0.4 } }],
  [{ name: 'ember', floor: ['#2a1410', '#3a1a10', '#5a2a14'], pat: 'bands', wallBg: '#140806', wall: ['brickRed'], paint: [], centre: ['fireShrine'],
    props: [['vent', 0.6, 1], ['rockObsidian', 0.6, 1], ['lavaLit', 0.25, 1], ['skullBone', 0.5, 0]], npcs: [], foes: ['c_dragon', 'c_bat', 'c_bat'],
    parts: ['ember', 'ash'], amb: [0.5, 0.34, 0.28], fx: { warp: 0.6 } },
   { name: 'ember2', floor: ['#3a0a08', '#5a1a0c', '#ff7a1a'], pat: 'caustic', wallBg: '#1a0604', wall: ['brickOrange'], paint: [], centre: ['obelisk'],
    props: [['brazier', 0.4, 1], ['vent', 0.7, 1], ['peakBasalt', 0.4, 1], ['skullBone', 0.6, 0]], npcs: [], foes: ['c_dragon', 'c_dragon', 'c_bat'],
    parts: ['ember'], amb: [0.55, 0.36, 0.3], fx: { warp: 1 } }],
  [{ name: 'gridlock', floor: ['#16161e', '#1e1e28', '#2a2a44', '#8a7a30'], pat: 'asphalt', wallBg: '#0a0a14', wall: ['brickDark'], paint: [], centre: ['phoneBox'],
    props: [['cone', 1, 1], ['vending', 0.4, 1], ['streetLamp', 0.4, 1], ['barrel', 0.5, 1]], npcs: [], foes: ['c_commuter', 'c_phone', 'c_trash', 'c_cone'],
    parts: ['rain'], amb: [0.42, 0.42, 0.48], fx: { ca: 1 } },
   { name: 'gridlock2', floor: ['#c84aa8', '#3ab8c8', '#16161e'], pat: 'checker', wallBg: '#1a0a2a', wall: ['neonWall', 'neonWallCyan'], paint: ['pSunset'], centre: ['bust'],
    props: [['cone', 0.8, 1], ['vendingRed', 0.4, 1], ['tvStatic', 0.4, 1], ['streetLamp', 0.3, 1]], npcs: [], foes: ['c_trash', 'c_cart', 'c_paparazzi', 'c_roomba'],
    parts: ['star', 'confettiY'], amb: [0.46, 0.4, 0.52], fx: { hue: 0.15 } }],
];

function applyDream(m, ent, seed, theme) {
  const T = theme || dreamTheme(ent);
  const R = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const W = m.w, H = m.h, N = W * H;
  const floor = new Uint8Array(N);
  for (let i = 0; i < N; i++) floor[i] = m.bg[i] === 0 ? 1 : 0;
  const special = (i) => m.entr.has(i);

  // floor + walls
  const k = T.floor.length;
  const pal = T.floor.concat(m.bgPal.map((c, j) => (j === 1 || j === 3) ? T.wallBg : c));
  m.bgPal = pal;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (floor[i]) {
      m.bg[i] = clamp(FLOORS[T.pat](x, y, hash2(x, y, seed & 0xffff), W, H), 0, k - 1);
      const g = m.glyph[i] & 0x7fff;
      if (g && CLUTTER.has(g)) m.glyph[i] = 0;
    } else {
      m.bg[i] = k + m.bg[i];
      const g = m.glyph[i] & 0x7fff;
      if (g && PLAIN_WALLS.has(g)) m.glyph[i] = G[T.wall[Math.floor(hash2(x, y, 77) * T.wall.length)]];
    }
  }

  const sp = m.spawn;
  const nearSpawn = (x, y) => Math.abs(x - sp.x) + Math.abs(y - sp.y) < 4;
  const free = (x, y) => {
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false;
    const i = y * W + x;
    return floor[i] && !m.solid[i] && !m.glyph[i] && !special(i) && !m.water[i] && !nearSpawn(x, y);
  };
  // a solid object only goes where it is surrounded by open floor, so it can never seal a path
  const ringFree = (x0, y0, x1, y1) => {
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (!free(x, y)) return false;
    return true;
  };
  const floorCount = floor.reduce((a, b) => a + b, 0);

  // paintings on walls, each under a soft gallery light
  if (T.paint.length) {
    const want = T.paintMany ? Math.ceil(floorCount / 18) : Math.max(1, Math.round(floorCount / 120));
    const spots = [];
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      if (floor[i] || floor[i + 1] || !floor[i + W] || !floor[i + W + 1] || special(i) || special(i + 1)) continue;
      if (special(i + W) || special(i + W + 1)) continue;
      spots.push([x, y]);
    }
    shuffle(spots, R);
    const used = [];
    for (const [x, y] of spots) {
      if (used.length >= want) break;
      if (used.some(([ux, uy]) => Math.abs(ux - x) < 4 && Math.abs(uy - y) < 3)) continue;
      const pick = T.paint[Math.floor(R() * T.paint.length)];
      m.glyph[y * W + x] = G[pick]; m.glyph[y * W + x + 1] = 0;
      m.solid[y * W + x] = 1; m.solid[y * W + x + 1] = 1;
      m.addLight(x * TS + 8, (y + 1) * TS + 2, '#ffe6c0', 30, 0.55, 0.02);
      used.push([x, y]);
    }
  }

  // centrepieces: try the middle of the space first, then anywhere roomy
  const placeBig = (name) => {
    const d = GLYPHS[G[name]], cw = d.w / TS, ch = d.h / TS;
    const tries = [[Math.floor(W / 2 - cw / 2), Math.floor(H / 2 + ch / 2)]];
    for (let t = 0; t < 600; t++) tries.push([1 + Math.floor(R() * (W - cw - 2)), ch + Math.floor(R() * (H - ch - 1))]);
    for (const [ax, ay] of tries) {
      if (!ringFree(ax, ay - ch + 1, ax + cw - 1, ay)) continue;
      for (let y = ay - ch + 1; y <= ay; y++) for (let x = ax; x < ax + cw; x++) { m.glyph[y * W + x] = 0; m.solid[y * W + x] = 1; }
      m.glyph[ay * W + ax] = G[name];
      return true;
    }
    return false;
  };
  const centres = floorCount > 900 ? T.centre : T.centre.slice(0, Math.max(1, Math.round(floorCount / 160)));
  for (const c of centres) placeBig(c);

  // props
  for (const [name, per100, sol] of T.props) {
    let n = Math.round(per100 * floorCount / 100 * (0.7 + R() * 0.6));
    const d = GLYPHS[G[name]], ch = d.h / TS;
    for (let t = 0; t < n * 30 && n > 0; t++) {
      const x = 1 + Math.floor(R() * (W - 2)), y = ch + Math.floor(R() * (H - ch - 1));
      if (sol ? !ringFree(x, y - ch + 1, x, y) : !free(x, y)) continue;
      m.glyph[y * W + x] = G[name];
      if (sol) for (let yy = y - ch + 1; yy <= y; yy++) m.solid[yy * W + x] = 1;
      n--;
    }
  }

  // dream-dwellers replace the usual wildlife
  m.creatures = [];
  if (T.npcs.length) spawnInteriorCreatures(m, R, T.npcs, Math.min(12, 2 + Math.round(floorCount / 160)));
  for (const c of m.creatures) c.speed *= 0.6;
  const foes = T.foes || THEME_FOES[T.name];
  if (foes && foes.length) spawnInteriorCreatures(m, R, foes, Math.min(10, 2 + Math.round(floorCount / 200)));

  if (T.amb) m.ambient = T.amb.slice();
  m.dream = { name: T.name, parts: T.parts, fx: T.fx, light: T.light || 1 };
}
