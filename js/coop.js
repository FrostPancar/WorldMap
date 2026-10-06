'use strict';
// ---------------------------------------------------------------------------
// Co-op: everyone in a room shares the same seeded world, so only player
// positions travel. Two transports feed the same peer table:
//   - WebRTC via PeerJS (any static host, e.g. Netlify): the first player in
//     a room claims the room's host id, everyone else connects to it, and the
//     host relays states between players. If the host leaves, the next player
//     to reconnect takes over.
//   - The claude.ai artifact `room` presence channel, when the page runs there.
// Without either the game is simply solo.
// ---------------------------------------------------------------------------

const SCARVES = ['#ff5a50', '#4ae0ff', '#ffd84a', '#a8f060', '#d88aff', '#ff9a3a'];
for (let k = 0; k < SCARVES.length; k++) {
  for (const n of ['p_down', 'p_up', 'p_side']) variant(`${n}_${k}`, n, ['#e8fff0', '#162030', SCARVES[k]]);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

const Coop = {
  room: null,          // truthy while connected to anyone (either transport)
  self: null,          // my id within the room
  peers: new Map(),    // id -> {px, py, tx, ty, face, moving, where, c, seen}
  last: '', lastSent: 0,
  sendFn: null,
  status: 'solo',      // solo | connecting | host | joined
  code: null,

  // --- shared peer table ----------------------------------------------------
  receive(id, s) {
    if (!s || id === this.self) return;
    if (typeof s.px !== 'number' || typeof s.py !== 'number' || typeof s.w !== 'string') return;
    let e = this.peers.get(id);
    if (!e) { e = { px: s.px, py: s.py, c: Math.abs(hashStr(id)) % SCARVES.length }; this.peers.set(id, e); }
    if (e.where !== s.w) { e.px = s.px; e.py = s.py; }
    e.tx = s.px; e.ty = s.py; e.face = ['up', 'down', 'left', 'right'].indexOf(s.f) >= 0 ? s.f : 'down';
    e.moving = !!s.m; e.where = s.w; e.seen = performance.now();
    CoopUI.refresh();
  },
  drop(id) { if (this.peers.delete(id)) CoopUI.refresh(); },

  // --- claude.ai artifact room ------------------------------------------------
  async initArtifactRoom() {
    if (!window.claude || !window.claude.use) return false;
    let room = null;
    try { room = await window.claude.use('room'); } catch (e) { room = null; }
    if (!room || this.status !== 'solo') return false;
    this.room = room; this.status = 'joined';
    this.sendFn = (st) => room.presence(st).catch(() => {});
    room.onPeers((ch) => {
      const ids = new Set();
      for (const p of ch.peers) {
        if (p.sameTab) { this.self = p.peer; continue; }
        ids.add(p.peer); this.receive(p.peer, p.presence);
      }
      for (const k of [...this.peers.keys()]) if (!ids.has(k)) this.drop(k);
    }, () => { this.room = null; this.peers.clear(); this.status = 'solo'; CoopUI.refresh(); });
    CoopUI.refresh();
    return true;
  },

  // --- WebRTC rooms (PeerJS) -----------------------------------------------
  join(code, seed) {
    if (typeof Peer === 'undefined') return;
    this.leave();
    this.code = code; this.seed = seed; this.status = 'connecting';
    this.hostId = 'worldmap-v1-' + code.toLowerCase().replace(/[^a-z0-9-]/g, '');
    CoopUI.refresh();
    this.tryHost();
  },
  leave() {
    clearTimeout(this.retryT);
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* already gone */ } }
    this.peer = null; this.conns = new Map(); this.hostConn = null;
    this.peers.clear(); this.room = null; this.sendFn = null; this.status = 'solo';
  },
  retry(ms) {
    clearTimeout(this.retryT);
    this.retryT = setTimeout(() => { if (this.code) this.tryHost(); }, ms);
  },
  tryHost() {
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
    this.conns = new Map(); this.hostConn = null;
    const peer = new Peer(this.hostId);
    this.peer = peer;
    peer.on('open', (id) => {
      if (this.peer !== peer) return;
      this.self = id; this.status = 'host'; this.room = true;
      this.sendFn = (st) => this.broadcast({ t: 's', id: this.self, st });
      CoopUI.refresh();
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.conns.set(conn.peer, conn);
        conn.send({ t: 'hello', seed: this.seed });
        // catch the newcomer up on everyone already here
        if (this.lastState) conn.send({ t: 's', id: this.self, st: this.lastState });
        for (const [id, e] of this.peers) if (e.raw) conn.send({ t: 's', id, st: e.raw });
        CoopUI.refresh();
      });
      conn.on('data', (msg) => {
        if (!msg || msg.t !== 's') return;
        this.receive(conn.peer, msg.st);
        const e = this.peers.get(conn.peer); if (e) e.raw = msg.st;
        this.broadcast({ t: 's', id: conn.peer, st: msg.st }, conn.peer);
      });
      const gone = () => { this.conns.delete(conn.peer); this.drop(conn.peer); this.broadcast({ t: 'bye', id: conn.peer }); };
      conn.on('close', gone); conn.on('error', gone);
    });
    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      if (err.type === 'unavailable-id') { peer.destroy(); this.becomeClient(); }
      else if (err.type !== 'peer-unavailable') { this.status = 'connecting'; CoopUI.refresh(); this.retry(3000); }
    });
    peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) peer.reconnect(); });
  },
  becomeClient() {
    const peer = new Peer();
    this.peer = peer;
    peer.on('open', (id) => {
      if (this.peer !== peer) return;
      this.self = id;
      const conn = peer.connect(this.hostId, { serialization: 'json' });
      this.hostConn = conn;
      conn.on('open', () => {
        this.status = 'joined'; this.room = true;
        this.sendFn = (st) => { if (conn.open) conn.send({ t: 's', st }); };
        this.last = ''; CoopUI.refresh();
      });
      conn.on('data', (msg) => {
        if (!msg) return;
        if (msg.t === 'hello' && msg.seed !== undefined && String(msg.seed) !== String(this.seed)) {
          CoopUI.go(this.code, msg.seed); // the host's world wins
        } else if (msg.t === 's') this.receive(msg.id, msg.st);
        else if (msg.t === 'bye') this.drop(msg.id);
      });
      const lost = () => {
        if (this.peer !== peer) return;
        this.peers.clear(); this.room = null; this.status = 'connecting'; CoopUI.refresh();
        peer.destroy();
        this.retry(500 + Math.random() * 1500); // someone takes over as host
      };
      conn.on('close', lost); conn.on('error', lost);
    });
    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      if (err.type === 'peer-unavailable') { peer.destroy(); this.retry(300 + Math.random() * 700); }
      else { this.status = 'connecting'; CoopUI.refresh(); peer.destroy(); this.retry(3000); }
    });
  },
  broadcast(msg, except) {
    if (!this.conns) return;
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  },

  // --- per-frame -----------------------------------------------------------------
  where() { return game.ret ? 'i' + game.ret.id : 'o'; },
  update(dt, p) {
    if (this.sendFn) {
      const st = { px: Math.round(p.px), py: Math.round(p.py), f: p.face, m: p.moving ? 1 : 0, w: this.where() };
      const key = `${st.px},${st.py},${st.f},${st.m},${st.w}`;
      const now = performance.now();
      // send on change (capped ~30/s), plus a keepalive every 2s
      if ((key !== this.last && now - this.lastSent > 33) || now - this.lastSent > 2000) {
        this.last = key; this.lastSent = now; this.lastState = st; this.sendFn(st);
      }
    }
    const k = 1 - Math.exp(-dt * 14), now = performance.now();
    for (const [id, e] of this.peers) {
      if (this.status !== 'joined' || this.peer) { if (now - e.seen > 8000) { this.drop(id); continue; } }
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
  here() {
    const w = this.where(), out = [];
    for (const e of this.peers.values()) if (e.where === w) out.push(e);
    return out;
  },
};

// ---------------------------------------------------------------------------
// Minimal settings button: room code, join, copy invite link, status.
// ---------------------------------------------------------------------------
const CoopUI = {
  init(seed) {
    this.seed = seed;
    const css = document.createElement('style');
    css.textContent = `
      #coop-btn{position:fixed;left:14px;bottom:14px;width:34px;height:34px;border:1px solid #3a3a46;background:#0b0b10cc;
        color:#cfcfc4;font:16px monospace;cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;z-index:5;padding:0}
      #coop-btn:hover{border-color:#8a8a96}
      #coop-btn .dot{position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:#555}
      #coop-panel{position:fixed;left:14px;bottom:56px;width:228px;background:#0b0b10f0;border:1px solid #3a3a46;border-radius:6px;
        color:#cfcfc4;font:12px/1.4 monospace;padding:12px;z-index:5;display:none;box-sizing:border-box}
      #coop-panel.open{display:block}
      #coop-panel label{display:block;color:#8a8a96;margin:0 0 4px}
      #coop-panel input{width:100%;box-sizing:border-box;background:#000;border:1px solid #3a3a46;color:#f2f0e8;font:13px monospace;
        padding:6px;border-radius:4px;margin-bottom:8px;text-transform:lowercase}
      #coop-panel .row{display:flex;gap:6px}
      #coop-panel button{flex:1;background:#1a1a24;border:1px solid #3a3a46;color:#f2f0e8;font:12px monospace;padding:6px;border-radius:4px;cursor:pointer}
      #coop-panel button:hover{border-color:#8a8a96}
      #coop-status{margin-top:8px;color:#8a8a96;display:flex;align-items:center;gap:6px}
      #coop-status i{width:7px;height:7px;border-radius:50%;background:#555;display:inline-block}`;
    document.head.appendChild(css);
    const btn = document.createElement('button');
    btn.id = 'coop-btn'; btn.title = 'Co-op'; btn.innerHTML = '&#9881;<span class="dot"></span>';
    const panel = document.createElement('div');
    panel.id = 'coop-panel';
    panel.innerHTML = `<label for="coop-code">Room</label><input id="coop-code" maxlength="24" spellcheck="false" autocomplete="off">
      <div class="row"><button id="coop-join">Join</button><button id="coop-copy">Copy link</button></div>
      <div id="coop-status"><i></i><span></span></div>`;
    document.body.append(btn, panel);
    this.btn = btn; this.panel = panel;
    const input = panel.querySelector('#coop-code');
    const q = new URLSearchParams(location.search);
    input.value = q.get('room') || Math.random().toString(36).slice(2, 7);
    btn.onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) input.focus(); else document.getElementById('cvs').focus(); };
    const join = () => {
      const code = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!code) return;
      input.value = code;
      history.replaceState(null, '', `?room=${code}&seed=${this.seed}`);
      Coop.join(code, this.seed);
      panel.classList.remove('open'); document.getElementById('cvs').focus();
    };
    panel.querySelector('#coop-join').onclick = join;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); e.stopPropagation(); });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    panel.querySelector('#coop-copy').onclick = (e) => {
      const code = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const url = `${location.origin}${location.pathname}?room=${code}&seed=${this.seed}`;
      const done = () => { e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy link'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Invite link', url));
      else prompt('Invite link', url);
    };
    if (typeof Peer === 'undefined') { btn.style.display = 'none'; }
    if (q.get('room')) Coop.join(input.value.trim().toLowerCase(), seed);
    this.refresh();
  },
  go(code, seed) { location.search = `?room=${code}&seed=${seed}`; },
  refresh() {
    if (!this.panel) return;
    const n = Coop.peers.size + 1;
    const [col, text] = {
      solo: ['#555', 'Solo — pick a room and join'],
      connecting: ['#e8b040', 'Connecting…'],
      host: ['#5ae070', n > 1 ? `${n} explorers here` : 'In room — waiting for friends'],
      joined: ['#5ae070', `${n} explorer${n > 1 ? 's' : ''} here`],
    }[Coop.status];
    this.panel.querySelector('#coop-status i').style.background = col;
    this.panel.querySelector('#coop-status span').textContent = text;
    this.btn.querySelector('.dot').style.background = col;
  },
};
