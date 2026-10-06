'use strict';
// ---------------------------------------------------------------------------
// Co-op: everyone in a room shares the same seeded world, so only player
// positions travel. Two transports feed the same peer table:
//   - Public MQTT-over-WebSocket brokers (works from any static host, e.g.
//     Netlify): everyone in a room publishes and subscribes on one topic.
//   - The claude.ai artifact `room` presence channel, when the page runs there.
// Without either the game is simply solo.
// ---------------------------------------------------------------------------

const SCARVES = ['#ff5a50', '#4ae0ff', '#ffd84a', '#a8f060', '#d88aff', '#ff9a3a'];
for (let k = 0; k < SCARVES.length; k++) {
  for (const n of ['p_down', 'p_up', 'p_side']) variant(`${n}_${k}`, n, ['#e8fff0', '#162030', SCARVES[k]]);
}

// Playable characters: the scarf creature plus the character-sheet critters,
// each in every scarf colour.
const CHARS = ['p', 'c_cat', 'c_rabbit', 'c_fox', 'c_frog', 'c_bear', 'c_octo', 'c_ghost', 'c_dragon', 'c_deer', 'c_bird', 'c_slime', 'c_lizard', 'c_bat'];
for (let k = 0; k < SCARVES.length; k++) for (const n of CHARS.slice(1)) variant(`${n}_${k}`, n, [SCARVES[k], '#141420']);

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
  look: (() => { try { const l = JSON.parse(localStorage.getItem('worldmap-look')); if (l && l.ch >= 0 && l.ch < CHARS.length) return l; } catch (e) { /* no storage */ } return { ch: 0, co: -1 }; })(),

  // --- shared peer table ----------------------------------------------------
  receive(id, s) {
    if (!s || id === this.self) return;
    if (typeof s.px !== 'number' || typeof s.py !== 'number' || typeof s.w !== 'string') return;
    let e = this.peers.get(id);
    if (!e) { e = { px: s.px, py: s.py, c: Math.abs(hashStr(id)) % SCARVES.length }; this.peers.set(id, e); }
    if (e.where !== s.w) { e.px = s.px; e.py = s.py; }
    e.tx = s.px; e.ty = s.py; e.face = ['up', 'down', 'left', 'right'].indexOf(s.f) >= 0 ? s.f : 'down';
    e.moving = !!s.m; e.where = s.w; e.seen = performance.now();
    e.ch = Number.isInteger(s.ch) && s.ch >= 0 && s.ch < CHARS.length ? s.ch : 0;
    if (Number.isInteger(s.co) && s.co >= 0 && s.co < SCARVES.length) e.c = s.co;
    e.pk = typeof s.pk === 'string' && POWERS[s.pk] ? s.pk : 'spark';
    e.cg = typeof s.cg === 'number' ? clamp(s.cg, 0, 1) : 0;
    if (s.bm && typeof s.bm.s === 'number' && s.bm.s !== e.bms) {
      e.bms = s.bm.s;
      if (e.where === this.where()) Powers.remoteBeam(e, s.bm);
    }
    Combat.netReceive(id, s, e);
    CoopUI.refresh();
  },
  drop(id) { if (this.peers.delete(id)) CoopUI.refresh(); },

  // --- claude.ai artifact room ------------------------------------------------
  async initArtifactRoom() {
    if (!window.claude || !window.claude.use) return false;
    let room = null;
    try { room = await window.claude.use('room'); } catch (e) { room = null; }
    if (!room || this.status !== 'solo') return false;
    this.room = room; this.status = 'joined'; this.artifact = true;
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

  // --- MQTT relay rooms -----------------------------------------------------
  // Every player publishes to and subscribes on one topic per room on several
  // public MQTT-over-WebSocket brokers at once; duplicates are ignored. No
  // host and no peer-to-peer handshake, so nothing can hang on NAT.
  BROKERS: ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'],
  join(code, seed) {
    this.leave();
    this.code = code; this.seed = String(seed); this.status = 'connecting';
    this.self = this.self || 'p' + Math.random().toString(36).slice(2, 10);
    this.topic = 'worldmap-v2/' + code.toLowerCase().replace(/[^a-z0-9-]/g, '');
    this.links = this.BROKERS.map((url) => new MqttLink(url, this.topic, (msg) => this.onMsg(msg), () => this.linkChanged()));
    this.sendFn = (st) => this.publish({ i: this.self, s: this.seed, st });
    clearTimeout(this.offT);
    this.offT = setTimeout(() => { if (this.status === 'connecting') { this.status = 'offline'; CoopUI.refresh(); } }, 12000);
    CoopUI.refresh();
  },
  leave() {
    if (this.links) { this.publish({ i: this.self, bye: 1 }); this.links.forEach((l) => l.close()); }
    this.links = null; this.peers.clear(); this.room = null; this.sendFn = null; this.status = 'solo';
  },
  publish(obj) {
    if (!this.links) return;
    const data = JSON.stringify(obj);
    for (const l of this.links) l.publish(data);
  },
  linkChanged() {
    const up = this.links && this.links.some((l) => l.ready);
    this.room = up ? true : null;
    this.status = up ? 'joined' : (this.status === 'offline' ? 'offline' : 'connecting');
    if (up) { this.lastSent = 0; Sound.sfx('join'); } // announce ourselves right away
    CoopUI.refresh();
  },
  onMsg(text) {
    let m;
    try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m.i !== 'string' || m.i === this.self || m.i.length > 24) return;
    if (m.bye) { this.drop(m.i); return; }
    if (m.s !== undefined && String(m.s) !== this.seed) return; // someone in a different world
    this.receive(m.i, m.st);
  },

  // --- per-frame -----------------------------------------------------------------
  where() { return game.ret ? 'i' + game.ret.id : 'o'; },
  update(dt, p) {
    if (this.sendFn) {
      const st = { px: Math.round(p.px), py: Math.round(p.py), f: p.face, m: p.moving ? 1 : 0, w: this.where(), ch: this.look.ch, co: this.myColor(),
        pk: Powers.kind, cg: Powers.charging ? Math.round(Powers.charge * 10) / 10 : 0 };
      const lb = Powers.lastBeam;
      if (lb && performance.now() - lb.t < 900) st.bm = { s: lb.s, a: lb.a, c: lb.c };
      const key = `${st.px},${st.py},${st.f},${st.m},${st.w},${st.ch},${st.co},${st.pk},${st.cg},${st.bm ? st.bm.s : 0}`;
      const now = performance.now();
      // send on change or when there is combat news (capped ~15/s), plus a keepalive every 2s
      if (now - this.lastSent > 66) {
        const net = Combat.netPayload(now);
        const k2 = key + ',' + net.out.hp + ',' + JSON.stringify(net.out.pt);
        if (net.force || k2 !== this.last || now - this.lastSent > 2000) {
          Object.assign(st, net.out);
          this.last = k2; this.lastSent = now; this.lastState = st; this.sendFn(st);
        }
      }
    }
    const k = 1 - Math.exp(-dt * 14), now = performance.now();
    for (const [id, e] of this.peers) {
      if (!this.artifact && now - e.seen > 8000) { this.drop(id); continue; }
      if (Math.abs(e.tx - e.px) > 64 || Math.abs(e.ty - e.py) > 64) { e.px = e.tx; e.py = e.ty; }
      e.px += (e.tx - e.px) * k; e.py += (e.ty - e.py) * k;
      e.animT = e.moving ? (e.animT || 0) + dt : 0;
    }
  },
  myColor() {
    if (this.look.co >= 0 && this.look.co < SCARVES.length) return this.look.co;
    return this.self ? Math.abs(hashStr(this.self)) % SCARVES.length : 0;
  },
  // ent remembers the last horizontal facing for side-only critter sprites
  sprite(face, frame, c, ch, ent) {
    if (ch) {
      const flip = face === 'left' ? true : face === 'right' ? false : !!(ent && ent.hflip);
      if (ent) ent.hflip = flip;
      return [G[`${CHARS[ch]}_${c}`], frame, flip];
    }
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
// The Escape menu: resume, restart the world, character, co-op room, sound.
// On touch screens (no Escape key) a small menu button opens it instead.
// ---------------------------------------------------------------------------
const CoopUI = {
  init(seed) {
    this.seed = seed;
    const css = document.createElement('style');
    css.textContent = `
      #coop-btn{position:fixed;left:14px;top:14px;width:34px;height:34px;border:1px solid #3a3a46;background:#0b0b10cc;
        color:#cfcfc4;font:16px monospace;cursor:pointer;border-radius:6px;display:none;align-items:center;justify-content:center;z-index:5;padding:0}
      body.touch #coop-btn{display:flex}
      #coop-btn:hover{border-color:#8a8a96}
      #coop-btn .dot{position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:#555}
      #coop-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:260px;max-width:calc(100% - 32px);max-height:calc(100% - 32px);
        overflow:auto;background:#0b0b10f2;border:1px solid #3a3a46;border-radius:6px;
        color:#cfcfc4;font:12px/1.4 monospace;padding:14px;z-index:6;display:none;box-sizing:border-box}
      #coop-panel.open{display:block}
      #coop-panel h2{margin:0 0 10px;font:600 13px monospace;letter-spacing:.2em;color:#f2f0e8;text-align:center}
      #coop-panel hr{border:0;border-top:1px solid #2a2a34;margin:12px 0}
      #coop-panel button.warn{border-color:#6a3a3a;color:#ffb0a0}
      #coop-panel button.warn.armed{background:#5a1a1a;border-color:#ff6a5a;color:#fff}
      #coop-panel label{display:block;color:#8a8a96;margin:0 0 4px}
      #coop-panel input{width:100%;box-sizing:border-box;background:#000;border:1px solid #3a3a46;color:#f2f0e8;font:13px monospace;
        padding:6px;border-radius:4px;margin-bottom:8px;text-transform:lowercase}
      #coop-panel .row{display:flex;gap:6px}
      #coop-panel button{flex:1;background:#1a1a24;border:1px solid #3a3a46;color:#f2f0e8;font:12px monospace;padding:6px;border-radius:4px;cursor:pointer}
      #coop-panel button:hover{border-color:#8a8a96}
      #coop-status{margin-top:8px;color:#8a8a96;display:flex;align-items:center;gap:6px}
      #coop-panel .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px}
      #coop-panel .grid canvas{display:block;width:100%;height:auto;aspect-ratio:1;image-rendering:pixelated;background:#000;border:1px solid #2a2a34;border-radius:3px;cursor:pointer;box-sizing:border-box;padding:3px}
      #coop-panel .grid canvas.on{border-color:#f2f0e8}
      #coop-panel .sw{display:flex;gap:4px;margin-bottom:10px}
      #coop-panel .sw span{flex:1;height:14px;border-radius:3px;cursor:pointer;border:1px solid transparent}
      #coop-panel .sw span.on{border-color:#f2f0e8}
      #coop-status i{width:7px;height:7px;border-radius:50%;background:#555;display:inline-block}`;
    document.head.appendChild(css);
    const btn = document.createElement('button');
    btn.id = 'coop-btn'; btn.title = 'Co-op'; btn.innerHTML = '&#9881;<span class="dot"></span>';
    const panel = document.createElement('div');
    panel.id = 'coop-panel';
    panel.innerHTML = `<h2>MENU</h2>
      <div class="row"><button id="menu-resume">Resume</button></div>
      <div class="row" style="margin-top:6px"><button id="menu-restart" class="warn">Restart world</button><button id="menu-new" class="warn">New world</button></div>
      <hr><label>Character</label><div class="grid" id="coop-chars"></div><div class="sw" id="coop-cols"></div>
      <label for="coop-code">Room</label><input id="coop-code" maxlength="24" spellcheck="false" autocomplete="off">
      <div class="row"><button id="coop-join">Join</button><button id="coop-copy">Copy link</button></div>
      <div class="row" style="margin-top:6px"><button id="coop-sound"></button></div>
      <div id="coop-status"><i></i><span></span></div>`;
    document.body.append(btn, panel);
    this.btn = btn; this.panel = panel;
    const input = panel.querySelector('#coop-code');
    const q = new URLSearchParams(location.search);
    input.value = q.get('room') || Math.random().toString(36).slice(2, 7);
    btn.onclick = () => this.toggle();
    panel.querySelector('#menu-resume').onclick = () => this.toggle(false);
    // restarting wipes your progress, so each button wants a second click to confirm
    const confirmBtn = (el, label, fn) => {
      let armed = 0;
      el.onclick = () => {
        if (armed) { fn(); return; }
        armed = setTimeout(() => { armed = 0; el.textContent = label; el.classList.remove('armed'); }, 2500);
        el.textContent = 'Sure? Click again'; el.classList.add('armed'); Sound.sfx('ui');
      };
    };
    confirmBtn(panel.querySelector('#menu-restart'), 'Restart world', () => this.restart(this.seed));
    confirmBtn(panel.querySelector('#menu-new'), 'New world', () => this.restart(Math.floor(Math.random() * 1e9)));
    this.buildPicker();
    const join = () => {
      const code = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!code) return;
      input.value = code;
      history.replaceState(null, '', `?room=${code}&seed=${this.seed}`);
      Coop.join(code, this.seed);
      panel.classList.remove('open'); document.getElementById('cvs').focus();
    };
    panel.querySelector('#coop-join').onclick = join;
    const snd = panel.querySelector('#coop-sound');
    const sndLabel = () => { snd.textContent = Sound.enabled ? 'Sound: on' : 'Sound: off'; };
    sndLabel();
    snd.onclick = () => { Sound.start(); Sound.setEnabled(!Sound.enabled); sndLabel(); Sound.sfx('ui'); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); if (e.key === 'Escape') this.toggle(false); e.stopPropagation(); });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    panel.querySelector('#coop-copy').onclick = (e) => {
      const code = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const url = `${location.origin}${location.pathname}?room=${code}&seed=${this.seed}`;
      const done = () => { e.target.textContent = 'Copied'; setTimeout(() => { e.target.textContent = 'Copy link'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Invite link', url));
      else prompt('Invite link', url);
    };
    if (q.get('room')) Coop.join(input.value.trim().toLowerCase(), seed);
    this.refresh();
  },
  buildPicker() {
    const grid = this.panel.querySelector('#coop-chars'), cols = this.panel.querySelector('#coop-cols');
    grid.innerHTML = ''; cols.innerHTML = '';
    const c = Coop.myColor();
    CHARS.forEach((n, i) => {
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
      cv.getContext('2d').drawImage(spr(i ? G[`${n}_${c}`] : G['p_down_' + c], 0, false), 0, 0);
      if (i === Coop.look.ch) cv.className = 'on';
      cv.onclick = () => this.setLook({ ch: i });
      grid.appendChild(cv);
    });
    SCARVES.forEach((col, k) => {
      const sp = document.createElement('span'); sp.style.background = col;
      if (k === c) sp.className = 'on';
      sp.onclick = () => this.setLook({ co: k });
      cols.appendChild(sp);
    });
  },
  setLook(patch) {
    if (patch.co !== undefined && Coop.look.co < 0) Coop.look.co = Coop.myColor();
    Object.assign(Coop.look, patch);
    try { localStorage.setItem('worldmap-look', JSON.stringify(Coop.look)); } catch (e) { /* no storage */ }
    this.buildPicker();
  },
  toggle(open) {
    const p = this.panel;
    if (!p) return;
    if (open === undefined) open = !p.classList.contains('open');
    p.classList.toggle('open', open);
    Sound.sfx('ui');
    if (open) p.querySelector('#menu-resume').focus(); else document.getElementById('cvs').focus();
  },
  isOpen() { return !!(this.panel && this.panel.classList.contains('open')); },
  // start over: forget items, XP, keys, specials, beaten bosses and unlocked doors
  restart(seed) {
    try { for (const k of ['worldmap-combat', 'worldmap-power']) localStorage.removeItem(k); } catch (e) { /* no storage */ }
    const q = new URLSearchParams(location.search);
    q.set('seed', seed);
    if (String(seed) !== String(this.seed)) q.delete('room'); // a different world can't share a room
    if (Coop.links) Coop.leave();
    const next = '?' + q.toString();
    if (next === location.search) location.reload(); else location.search = next;
  },
  go(code, seed) { location.search = `?room=${code}&seed=${seed}`; },
  refresh() {
    if (!this.panel) return;
    if (Coop.self !== this.pickerSelf) { this.pickerSelf = Coop.self; this.buildPicker(); }
    const n = Coop.peers.size + 1;
    const [col, text] = {
      solo: ['#555', 'Solo — pick a room and join'],
      connecting: ['#e8b040', 'Connecting…'],
      joined: ['#5ae070', n > 1 ? `${n} explorers here` : 'In room — waiting for friends'],
      offline: ['#e05050', 'Can’t reach co-op servers — retrying'],
    }[Coop.status];
    this.panel.querySelector('#coop-status i').style.background = col;
    this.panel.querySelector('#coop-status span').textContent = text;
    this.btn.querySelector('.dot').style.background = col;
  },
};

// Minimal MQTT 3.1.1 client over WebSocket: CONNECT, SUBSCRIBE, QoS 0 PUBLISH,
// PINGREQ. Reconnects with backoff.
class MqttLink {
  constructor(url, topic, onMsg, onChange) {
    this.url = url; this.topic = topic; this.onMsg = onMsg; this.onChange = onChange;
    this.ready = false; this.closed = false; this.backoff = 1000;
    this.connect();
  }
  connect() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url, 'mqtt'); } catch (e) { this.retry(); return; }
    this.ws = ws; ws.binaryType = 'arraybuffer';
    this.buf = new Uint8Array(0);
    ws.onopen = () => {
      const id = 'wm' + Math.random().toString(36).slice(2, 12);
      this.send(0x10, [...MqttLink.str('MQTT'), 4, 0x02, 0, 60, ...MqttLink.str(id)]);
    };
    ws.onmessage = (ev) => this.feed(new Uint8Array(ev.data));
    ws.onclose = ws.onerror = () => {
      if (this.ws !== ws) return;
      this.ws = null; clearInterval(this.ping);
      if (this.ready) { this.ready = false; this.onChange(); }
      this.retry();
    };
  }
  retry() {
    if (this.closed) return;
    clearTimeout(this.rt);
    this.rt = setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 15000);
  }
  close() {
    this.closed = true; clearTimeout(this.rt); clearInterval(this.ping);
    if (this.ws) { try { this.send(0xE0, []); this.ws.close(); } catch (e) { /* gone */ } }
    this.ws = null; this.ready = false;
  }
  static str(s) { const b = new TextEncoder().encode(s); return [b.length >> 8, b.length & 255, ...b]; }
  send(type, body) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const len = []; let n = body.length;
    do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
    this.ws.send(new Uint8Array([type, ...len, ...body]));
  }
  publish(text) {
    if (!this.ready) return;
    this.send(0x30, [...MqttLink.str(this.topic), ...new TextEncoder().encode(text)]);
  }
  feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length);
    b.set(this.buf); b.set(chunk, this.buf.length);
    let o = 0;
    for (;;) {
      if (b.length - o < 2) break;
      let mult = 1, len = 0, k = o + 1, byte;
      do { if (k >= b.length) { len = -1; break; } byte = b[k++]; len += (byte & 127) * mult; mult *= 128; } while (byte & 128);
      if (len < 0 || k + len > b.length) break;
      this.packet(b[o], b.subarray(k, k + len));
      o = k + len;
    }
    this.buf = b.slice(o);
  }
  packet(type, body) {
    const t = type >> 4;
    if (t === 2) { // CONNACK
      if (body[1] !== 0) { this.ws.close(); return; }
      this.send(0x82, [0, 1, ...MqttLink.str(this.topic), 0]);
      clearInterval(this.ping);
      this.ping = setInterval(() => this.send(0xC0, []), 30000);
    } else if (t === 9) { // SUBACK
      this.ready = true; this.backoff = 1000; this.onChange();
    } else if (t === 3) { // PUBLISH
      const tl = (body[0] << 8) | body[1];
      let p = 2 + tl;
      if ((type >> 1) & 3) p += 2;
      try { this.onMsg(new TextDecoder().decode(body.subarray(p))); } catch (e) { /* bad payload */ }
    }
  }
}
addEventListener('pagehide', () => { if (Coop.links) Coop.leave(); });
