'use strict';
// ---------------------------------------------------------------------------
// Co-op: everyone with the page open shares the same seeded world, so only
// player positions travel. Each player publishes where they are through the
// artifact `room` presence channel; peers are interpolated and drawn on the
// same map. Without the room (plain file:// or offline) the game is solo.
// ---------------------------------------------------------------------------

const SCARVES = ['#ff5a50', '#4ae0ff', '#ffd84a', '#a8f060', '#d88aff', '#ff9a3a'];
for (let k = 0; k < SCARVES.length; k++) {
  for (const n of ['p_down', 'p_up', 'p_side']) variant(`${n}_${k}`, n, ['#e8fff0', '#162030', SCARVES[k]]);
}

const Coop = {
  room: null,
  peers: new Map(),   // peer label -> {x, y, px, py, face, moving, where, c, t}
  last: '',

  async init() {
    if (!window.claude || !window.claude.use) return;
    let room = null;
    try { room = await window.claude.use('room'); } catch (e) { room = null; }
    if (!room) return;
    this.room = room;
    this.self = null;
    room.onPeers((ch) => this.sync(ch.peers), () => { this.room = null; this.peers.clear(); });
  },

  sync(list) {
    const seen = new Set();
    for (const p of list) {
      if (p.sameTab) { this.self = p.peer; continue; }
      const s = p.presence || {};
      if (typeof s.px !== 'number' || typeof s.py !== 'number' || typeof s.w !== 'string') continue;
      seen.add(p.peer);
      let e = this.peers.get(p.peer);
      if (!e) {
        e = { px: s.px, py: s.py, c: Math.abs(hashStr(p.peer)) % SCARVES.length };
        this.peers.set(p.peer, e);
      }
      if (e.where !== s.w) { e.px = s.px; e.py = s.py; }
      e.tx = s.px; e.ty = s.py; e.face = ['up', 'down', 'left', 'right'].indexOf(s.f) >= 0 ? s.f : 'down';
      e.moving = !!s.m; e.where = s.w;
    }
    for (const k of [...this.peers.keys()]) if (!seen.has(k)) this.peers.delete(k);
  },

  where() { return game.ret ? 'i' + game.ret.id : 'o'; },

  // called every frame: publish my state when it changed, ease peers
  update(dt, p) {
    if (this.room) {
      const st = { px: Math.round(p.px), py: Math.round(p.py), f: p.face, m: p.moving ? 1 : 0, w: this.where() };
      const key = `${st.px},${st.py},${st.f},${st.m},${st.w}`;
      if (key !== this.last) { this.last = key; this.room.presence(st).catch(() => {}); }
    }
    const k = 1 - Math.exp(-dt * 14);
    for (const e of this.peers.values()) {
      if (Math.abs(e.tx - e.px) > 64 || Math.abs(e.ty - e.py) > 64) { e.px = e.tx; e.py = e.ty; }
      e.px += (e.tx - e.px) * k; e.py += (e.ty - e.py) * k;
      e.animT = e.moving ? (e.animT || 0) + dt : 0;
    }
  },

  myColor() { return this.self ? Math.abs(hashStr(this.self)) % SCARVES.length : 0; },

  sprite(face, frame, c) {
    if (face === 'up') return [G['p_up_' + c], frame, false];
    if (face === 'down') return [G['p_down_' + c], frame, false];
    return [G['p_side_' + c], frame, face === 'left'];
  },

  // peers that share my current map
  here() {
    const w = this.where(), out = [];
    for (const e of this.peers.values()) if (e.where === w) out.push(e);
    return out;
  },
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}
