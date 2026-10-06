'use strict';
// ---------------------------------------------------------------------------
// Urban enemies: people and things from modern city life rather than RPG
// monsters — commuters who rush at you, phone zombies, joggers, paparazzi
// with blinding flashes, e-scooter riders, pigeon flocks, living traffic
// cones, runaway shopping carts, robot vacuums, delivery drones, fire
// hydrants, CCTV cameras and trash bags that split when popped.
// ---------------------------------------------------------------------------

defGlyph('c_commuter', [
  ['..222...', '..211...', '..111...', '...1....', '.33433..', '.33433..', '.334335.', '.3333355', '..33.555', '..33.555',
    '..3.3...', '..3.3...', '..3.3...', '..3.3...', '.66.66..', '........'],
  ['..222...', '..211...', '..111...', '...1....', '.33433..', '.33433..', '.334335.', '.3333355', '..33.555', '..33.555',
    '..3..3..', '.3....3.', '.3....3.', '.3....3.', '66....66', '........'],
], ['#e0b890', '#2a1a10', '#3a3e4e', '#c8302a', '#7a4a1a', '#111111']);
defGlyph('c_phone', [
  ['..111...', '.11111..', '.12221..', '.12221..', '..111...', '.11111..', '1111113.', '1111133.', '.11111..', '..444...',
    '..4.4...', '..4.4...', '..4.4...', '..4.4...', '.55.55..', '........'],
  ['..111...', '.11111..', '.12221..', '.12221..', '..111...', '.11111..', '1111113.', '1111133.', '.11111..', '..444...',
    '..4.4...', '..4..4..', '..4..4..', '..4..4..', '.55..55.', '........'],
], ['#5a6a7a', '#a8c8e8', '#bff4ff', '#2a3a5a', '#1a1a1a'], { emit: [3] });
defGlyph('c_jogger', [
  ['........', '..111...', '..333...', '..111...', '...1....', '.12221..', '1.222.1.', '..222...', '..444...', '..444...',
    '..1.1...', '.1...1..', '.1...1..', '1.....1.', '5.....5.', '........'],
  ['........', '..111...', '..333...', '..111...', '...1....', '.12221..', '..2221..', '.1222...', '..444...', '..444...',
    '..1.1...', '..1.1...', '..1.1...', '..1.1...', '.55.55..', '........'],
], ['#e0b890', '#f0c030', '#e8302a', '#2a6ad8', '#f2f0e8']);
defGlyph('c_paparazzi', [
  ['..333...', '.33333..', '..111...', '..111...', '..222...', '.2224455', '.222444.', '.22222..', '..666...', '..6.6...',
    '..6.6...', '..6.6...', '..6.6...', '..6.6...', '.66.66..', '........'],
  ['..333...', '.33333..', '..111...', '..111...', '..222...', '.222444.', '.222444.', '.22222..', '..666...', '..6.6...',
    '..6..6..', '..6..6..', '..6..6..', '..6..6..', '.66..66.', '........'],
], ['#e0b890', '#a8946a', '#1a1a1a', '#2a2a30', '#f2f8ff', '#3a3a44'], { emit: [5] });
defGlyph('c_scooter', [
  ['..333...', '..333...', '..111...', '...2....', '..222..5', '..222.5.', '..222.5.', '..44.5..', '..44.5..', '..4.45..',
    '..4.5...', '.555555.', '.6....6.', '........', '........', '........'],
  ['..333...', '..333...', '..111...', '...2....', '..222..5', '..222.5.', '..222.5.', '..44.5..', '..44.5..', '..4.45..',
    '..4.5...', '.555555.', '6......6', '........', '........', '........'],
], ['#e0b890', '#e84a8a', '#4ae8f0', '#2a2a3a', '#3a3a44', '#111111']);
defGlyph('c_pigeon', [
  ['........', '....11..', '...1311.', '..12114.', '111211..', '.11111..', '..4.4...', '........'],
  ['........', '........', '....11..', '...1311.', '.112114.', '111111..', '..4.4...', '........'],
], ['#8a8a96', '#6ac8a8', '#e8a020', '#e88a6a']);
defGlyph('c_cone', [
  ['...1....', '..111...', '..313...', '..222...', '.11111..', '.12221..', '1111111.', '........'],
  ['........', '...1....', '..111...', '..313...', '..222...', '.11111..', '1111111.', '........'],
], ['#ff7a1a', '#f2f0e8', '#1a1a1a']);
defGlyph('c_cart', [
  ['2.......', '.1111111', '.1.1.1.1', '.1111111', '..1.1.1.', '..11111.', '..3...3.', '........'],
  ['2.......', '.1111111', '.1.1.1.1', '.1111111', '..1.1.1.', '..11111.', '...3.3..', '........'],
], ['#c8c8d0', '#c8302a', '#1a1a1a']);
defGlyph('c_roomba', [
  ['........', '........', '..1111..', '.122221.', '12232221', '12222221', '.111111.', '........'],
  ['........', '........', '..1111..', '.122221.', '12222221', '12222221', '.111111.', '........'],
], ['#2a2a34', '#5a5a66', '#4ae870'], { emit: [3] });
defGlyph('c_drone', [
  ['22....22', '.1....1.', '..1331..', '..1351..', '.1....1.', '22....22', '...44...', '...44...'],
  ['.22..22.', '.1....1.', '..1331..', '..1331..', '.1....1.', '.22..22.', '...44...', '...44...'],
], ['#8a8a96', '#d8d8e0', '#1a1a22', '#c89050', '#ff3a3a'], { emit: [5], tags: 'float' });
defGlyph('c_hydrant', [
  ['...22...', '..1111..', '.111111.', '31111113', '..1111..', '..1111..', '.111111.', '11111111'],
  ['...22...', '..1111..', '.111111.', '31111113', '..1111..', '..1111..', '.111111.', '11111111'],
], ['#d8302a', '#8a1a1a', '#f0c030']);
defGlyph('c_cctv', [
  ['..222222', '.2222223', '..222222', '...1....', '...1....', '...1....', '...1....', '..111...'],
  ['..222222', '.2222222', '..222222', '...1....', '...1....', '...1....', '...1....', '..111...'],
], ['#5a5a66', '#e8e8f0', '#ff2a2a'], { emit: [3] });
defGlyph('c_trash', [
  ['...33...', '..1..1..', '.111111.', '.141141.', '11111111', '12111211', '.111111.', '........'],
  ['........', '...33...', '.11..11.', '.141141.', '11111111', '12111211', '11111111', '........'],
], ['#1a1a22', '#3a3a4a', '#f0c030', '#f2f0e8'], { emit: [4] });
defGlyph('c_trashbit', [
  ['........', '........', '...33...', '..1111..', '.141141.', '.111111.', '..1111..', '........'],
  ['........', '........', '........', '..1111..', '.141141.', '.111111.', '.111111.', '........'],
], ['#1a1a22', '#3a3a4a', '#f0c030', '#f2f0e8'], { emit: [4] });

// Every hostile creature: HP, contact damage, movement behaviour and optional
// ranged attack. Behaviours live in updateCreature(); shots in Combat.
const ENEMY_DEF = {
  c_spider: { hp: 3, dmg: 1, beh: 'chase' }, c_bat: { hp: 2, dmg: 1, beh: 'erratic' }, c_ghost: { hp: 4, dmg: 1, beh: 'chase' },
  c_slime: { hp: 3, dmg: 1, beh: 'hop' }, c_eyeball: { hp: 3, dmg: 1, beh: 'chase' }, c_shadow: { hp: 5, dmg: 2, beh: 'chase' },
  c_tvhead: { hp: 4, dmg: 1, beh: 'keepaway', shot: 'laser' }, c_knight: { hp: 6, dmg: 2, beh: 'rush' }, c_knightW: { hp: 6, dmg: 2, beh: 'rush' },
  c_dragon: { hp: 6, dmg: 2, beh: 'chase' },
  c_commuter: { hp: 4, dmg: 2, beh: 'rush' }, c_phone: { hp: 5, dmg: 1, beh: 'shamble' }, c_jogger: { hp: 3, dmg: 1, beh: 'jog' },
  c_paparazzi: { hp: 4, dmg: 1, beh: 'keepaway', shot: 'flash' }, c_scooter: { hp: 4, dmg: 2, beh: 'charge' },
  c_pigeon: { hp: 1, dmg: 1, beh: 'erratic' }, c_cone: { hp: 7, dmg: 1, beh: 'hop' }, c_cart: { hp: 5, dmg: 2, beh: 'charge' },
  c_roomba: { hp: 3, dmg: 1, beh: 'wander' }, c_drone: { hp: 3, dmg: 1, beh: 'keepaway', shot: 'box' },
  c_hydrant: { hp: 6, dmg: 1, beh: 'turret', shot: 'water' }, c_cctv: { hp: 4, dmg: 1, beh: 'turret', shot: 'laser' },
  c_trash: { hp: 4, dmg: 1, beh: 'chase', split: 'c_trashbit' }, c_trashbit: { hp: 1, dmg: 1, beh: 'erratic' },
};
// enemy shots: speed (px/s), damage, cooldown, range (tiles), lobbed or straight
const SHOTS = {
  flash: { spd: 170, dmg: 1, cd: 2.6, range: 7, col: '#f2f8ff' },
  laser: { spd: 220, dmg: 1, cd: 1.7, range: 8, col: '#ff3a3a' },
  water: { lob: true, dmg: 1, cd: 2.3, range: 6, col: '#5ab8ff', n: 3 },
  box: { lob: true, dmg: 2, cd: 2.9, range: 7, col: '#c89050' },
};
// themed urban foes inside dream rooms
const THEME_FOES = {
  nightcity: ['c_commuter', 'c_phone', 'c_scooter', 'c_cctv', 'c_cone', 'c_trash'], vapor: ['c_cart', 'c_roomba', 'c_commuter', 'c_phone'],
  gallery: ['c_paparazzi', 'c_cctv', 'c_roomba'], numbers: ['c_commuter', 'c_phone', 'c_cctv'], mondrian: ['c_roomba', 'c_cone'],
  melting: ['c_phone', 'c_commuter'], scream: ['c_phone', 'c_commuter'], eyes: ['c_cctv'], klimt: ['c_paparazzi'],
  giza: ['c_paparazzi'], rapanui: ['c_paparazzi'], wave: ['c_pigeon', 'c_drone'], chess: [], muertos: [], aquarium: [], starry: [],
};

// Overworld: city life gathers around villages, roads and landmarks.
function seedUrbanEnemies(world, seed) {
  const m = world.map, R = mulberry32(seed ^ 0x3c6ef372);
  const add = (name, x, y) => {
    const i = y * m.w + x;
    if (!m.inb(x, y) || m.solid[i] || m.water[i] || m.entr.has(i)) return false;
    if (Math.abs(x - world.start.x) + Math.abs(y - world.start.y) < 16) return false; // a calm starting village
    m.creatures.push(makeCreature(name, x, y, m.biome[i], R));
    return true;
  };
  const near = (x, y, r, name, n) => {
    for (let t = 0; t < n * 12 && n > 0; t++) if (add(name, x + Math.round((R() - 0.5) * r * 2), y + Math.round((R() - 0.5) * r * 2))) n--;
  };
  for (const p of world.pois) {
    const { x, y } = p.hub;
    if (p.type === 'village') {
      near(x, y, 4, 'c_pigeon', 4 + Math.floor(R() * 3));
      near(x, y, 9, 'c_jogger', 1 + Math.floor(R() * 2));
      near(x, y, 6, 'c_hydrant', 1);
      if (R() < 0.6) near(x, y, 9, 'c_phone', 1);
      if (R() < 0.5) near(x, y, 9, 'c_trash', 2);
    } else if (p.type === 'castle') near(x, y, 2, 'c_cctv', 2);
    else if (p.type === 'lighthouse' || p.type === 'wreck') near(x, y, 4, 'c_drone', 1);
    else if (['shrine', 'worldtree', 'stones', 'ribs', 'volcano'].indexOf(p.type) >= 0) near(x, y, 6, 'c_paparazzi', 1 + Math.floor(R() * 2));
  }
  // along the roads
  const roads = [];
  for (let i = 0; i < m.w * m.h; i++) if (m.road[i] && !(m.road[i] & R_DOT)) roads.push(i);
  const along = (name, n) => {
    for (let t = 0; t < n * 10 && n > 0; t++) {
      const i = roads[Math.floor(R() * roads.length)], x = i % m.w, y = (i / m.w) | 0;
      if (add(name, x + Math.round((R() - 0.5) * 4), y + Math.round((R() - 0.5) * 4))) n--;
    }
  };
  if (roads.length) {
    along('c_commuter', 26); along('c_scooter', 14); along('c_cart', 12); along('c_cone', 18); along('c_trash', 14); along('c_drone', 10);
  }
}
