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
// The Escape menu, drawn like the game: the 3x5 pixel font, square pixel
// borders sized to the game's pixel scale, the world palette. Three pages,
// flipped with Q and E: character, collectibles (opens here), settings/co-op.
// On touch screens (no Escape key) a small menu button opens it instead.
// ---------------------------------------------------------------------------
defGlyph('icon_map', ['11111111', '12221221', '12122321', '12212221', '12322121', '12221221', '11111111', '........'],
  ['#8a5a2a', '#e8d8b8', '#d8302a'], { emit: [3] });

// a piece of pixel text as a canvas, scaled by CSS to the game's pixel size
function pxText(str, col, k) {
  str = String(str).toUpperCase();
  const c = document.createElement('canvas');
  c.width = Math.max(1, str.length * 4 - 1); c.height = 5;
  drawText(c.getContext('2d'), str, 0, 0, col || '#f2f0e8');
  c.className = 'px';
  k = k || 1;
  c.style.width = `calc(var(--px) * ${c.width * k})`; c.style.height = `calc(var(--px) * ${5 * k})`;
  return c;
}
function pxIcon(g, k) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8; c.className = 'px';
  if (g) c.getContext('2d').drawImage(spr(g, 0, false), 0, 0);
  c.style.width = c.style.height = `calc(var(--px) * ${8 * (k || 1)})`;
  return c;
}

const CoopUI = {
  PAGES: ['CHARACTER', 'COLLECTIBLES', 'SETTINGS'],
  page: 1,
  init(seed) {
    this.seed = seed;
    const css = document.createElement('style');
    css.textContent = `
      #coop-btn{position:fixed;left:14px;top:14px;width:34px;height:34px;border:0;background:#0b0b10;box-shadow:0 0 0 2px #f2f0e8,0 0 0 4px #0b0b10;
        cursor:pointer;display:none;align-items:center;justify-content:center;z-index:5;padding:0;image-rendering:pixelated}
      body.touch #coop-btn{display:flex}
      #coop-btn .dot{position:absolute;top:4px;right:4px;width:4px;height:4px;background:#555}
      #menu-back{position:fixed;inset:0;z-index:5;display:none;background:#000a}
      #menu-back.open{display:block}
      #coop-panel{--px:4px;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;display:none;
        width:calc(var(--px) * 176);max-width:calc(100% - 24px);max-height:calc(100% - 24px);overflow:auto;box-sizing:border-box;
        padding:calc(var(--px) * 6);background:#0b0b10;color:#f2f0e8;outline:none;scrollbar-width:none;
        box-shadow:0 0 0 var(--px) #f2f0e8,0 0 0 calc(var(--px) * 2) #0b0b10,0 0 0 calc(var(--px) * 3) #45454f;
        background-image:repeating-linear-gradient(0deg,#ffffff06 0 var(--px),transparent var(--px) calc(var(--px) * 2))}
      #coop-panel.open{display:block}
      #coop-panel canvas.px{display:block;image-rendering:pixelated}
      #coop-panel .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:calc(var(--px) * 3)}
      #coop-panel .key{display:flex;align-items:center;gap:calc(var(--px) * 2);background:none;border:0;padding:0;cursor:pointer}
      #coop-panel .cap{display:flex;align-items:center;justify-content:center;width:calc(var(--px) * 9);height:calc(var(--px) * 9);
        background:#1a1a24;box-shadow:inset 0 0 0 var(--px) #9a9aa2,inset 0 calc(var(--px) * -2) 0 #45454f}
      #coop-panel .key:hover .cap,#coop-panel .key:active .cap{background:#f2f0e8}
      #coop-panel .title{display:flex;flex-direction:column;align-items:center;gap:calc(var(--px) * 2)}
      #coop-panel .dots{display:flex;gap:calc(var(--px) * 2)}
      #coop-panel .dots i{width:calc(var(--px) * 2);height:calc(var(--px) * 2);background:#45454f}
      #coop-panel .dots i.on{background:#f0b030}
      #coop-panel .rule{height:var(--px);background:#2a2a34;margin:calc(var(--px) * 3) 0}
      #coop-panel .lbl{margin:calc(var(--px) * 3) 0 calc(var(--px) * 2)}
      #coop-panel .slots{display:flex;flex-wrap:wrap;gap:calc(var(--px) * 2)}
      #coop-panel .slot{padding:calc(var(--px) * 2);background:#000;box-shadow:inset 0 0 0 var(--px) #2a2a34;cursor:pointer;line-height:0}
      #coop-panel .slot.on{box-shadow:inset 0 0 0 var(--px) #9a9aa2}
      #coop-panel .slot.sel{box-shadow:inset 0 0 0 var(--px) #f0b030}
      #coop-panel .slot.empty canvas{opacity:.15}
      #coop-panel .info{min-height:calc(var(--px) * 12);margin-top:calc(var(--px) * 3);display:flex;flex-direction:column;gap:calc(var(--px) * 2)}
      #coop-panel .row{display:flex;align-items:center;gap:calc(var(--px) * 3);flex-wrap:wrap}
      #coop-panel .btn{display:flex;align-items:center;justify-content:center;padding:calc(var(--px) * 3) calc(var(--px) * 4);border:0;cursor:pointer;
        background:#1a1a24;box-shadow:inset 0 0 0 var(--px) #9a9aa2,inset 0 calc(var(--px) * -2) 0 #45454f}
      #coop-panel .btn:hover{background:#2c2c3a}
      #coop-panel .btn.warn{box-shadow:inset 0 0 0 var(--px) #d8323a,inset 0 calc(var(--px) * -2) 0 #9a1f2a}
      #coop-panel .btn.armed{background:#5a1a1a}
      #coop-panel .sw{display:flex;gap:calc(var(--px) * 2)}
      #coop-panel .sw span{width:calc(var(--px) * 10);height:calc(var(--px) * 6);cursor:pointer}
      #coop-panel .sw span.on{box-shadow:0 0 0 var(--px) #0b0b10,0 0 0 calc(var(--px) * 2) #f2f0e8}
      #coop-panel input{width:calc(var(--px) * 70);box-sizing:border-box;background:#000;border:0;color:#f2f0e8;
        box-shadow:inset 0 0 0 var(--px) #45454f;font:bold calc(var(--px) * 6)/1 monospace;padding:calc(var(--px) * 2) calc(var(--px) * 3);
        text-transform:uppercase;letter-spacing:calc(var(--px) * .5);outline:none}
      #coop-panel input:focus{box-shadow:inset 0 0 0 var(--px) #f0b030}
      #coop-panel .stat{display:flex;align-items:center;gap:calc(var(--px) * 2);margin-top:calc(var(--px) * 3)}
      #coop-panel .stat i{width:calc(var(--px) * 3);height:calc(var(--px) * 3);background:#555}
      #coop-panel .foot{margin-top:calc(var(--px) * 4);display:flex;justify-content:center;opacity:.6}`;
    document.head.appendChild(css);
    const btn = document.createElement('button');
    btn.id = 'coop-btn'; btn.title = 'Menu'; btn.appendChild(pxIcon(G.icon_map, 3)); btn.firstChild.style.cssText = 'width:24px;height:24px;image-rendering:pixelated';
    btn.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
    const back = document.createElement('div');
    back.id = 'menu-back';
    const panel = document.createElement('div');
    panel.id = 'coop-panel'; panel.tabIndex = -1;
    document.body.append(btn, back, panel);
    this.btn = btn; this.panel = panel; this.back = back;
    btn.onclick = () => this.toggle();
    back.onpointerdown = (e) => { e.preventDefault(); this.toggle(false); };
    const q = new URLSearchParams(location.search);
    this.code = q.get('room') || Math.random().toString(36).slice(2, 7);
    if (q.get('room')) Coop.join(this.code.trim().toLowerCase(), seed);
    addEventListener('resize', () => this.scale());
  },
  // one game pixel in CSS pixels, so the menu's pixels match the world's
  scale() {
    if (!this.panel) return;
    // as big as the window comfortably allows (whole pixels keep the font crisp)
    const px = clamp(Math.min(Math.floor(innerWidth * 0.92 / 190), Math.floor(innerHeight * 0.9 / 150)), 2, 5);
    this.panel.style.setProperty('--px', px + 'px');
  },
  flip(d) { this.page = (this.page + d + 3) % 3; Sound.sfx('ui'); this.build(); },
  build() {
    const p = this.panel;
    p.innerHTML = '';
    // header: [Q] < PAGE NAME > [E]
    const hdr = document.createElement('div'); hdr.className = 'hdr';
    const key = (k, d, arrow) => {
      const b = document.createElement('button'); b.className = 'key';
      const cap = document.createElement('span'); cap.className = 'cap'; cap.appendChild(pxText(k, '#f0b030'));
      const ar = pxText(arrow, '#9a9aa2');
      if (d < 0) b.append(cap, ar); else b.append(ar, cap);
      b.onclick = () => this.flip(d);
      return b;
    };
    const title = document.createElement('div'); title.className = 'title';
    title.appendChild(pxText(this.PAGES[this.page], '#f2f0e8', 2));
    const dots = document.createElement('div'); dots.className = 'dots';
    for (let k = 0; k < 3; k++) { const i = document.createElement('i'); if (k === this.page) i.className = 'on'; dots.appendChild(i); }
    title.appendChild(dots);
    hdr.append(key('Q', -1, '<'), title, key('E', 1, '>'));
    p.appendChild(hdr);
    p.appendChild(Object.assign(document.createElement('div'), { className: 'rule' }));
    [() => this.buildCharacter(p), () => this.buildCollectibles(p), () => this.buildSettings(p)][this.page]();
    const foot = document.createElement('div'); foot.className = 'foot';
    foot.appendChild(pxText('ESC TO CLOSE', '#9a9aa2'));
    p.appendChild(foot);
  },
  label(p, text) { const d = document.createElement('div'); d.className = 'lbl'; d.appendChild(pxText(text, '#9a9aa2')); p.appendChild(d); return d; },
  button(text, cls, fn) {
    const b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : '');
    b.appendChild(pxText(text)); b.onclick = fn;
    b.setText = (t) => { b.innerHTML = ''; b.appendChild(pxText(t)); };
    return b;
  },

  // --- page 1: character ---------------------------------------------------------------
  buildCharacter(p) {
    this.label(p, 'CHOOSE A LOOK');
    const grid = document.createElement('div'); grid.className = 'slots';
    const c = Coop.myColor();
    CHARS.forEach((n, i) => {
      const s = document.createElement('div'); s.className = 'slot' + (i === Coop.look.ch ? ' sel' : ' on');
      s.appendChild(pxIcon(i ? G[`${n}_${c}`] : G['p_down_' + c], 2));
      s.onclick = () => this.setLook({ ch: i });
      grid.appendChild(s);
    });
    p.appendChild(grid);
    this.label(p, 'SCARF COLOUR');
    const sw = document.createElement('div'); sw.className = 'sw';
    SCARVES.forEach((col, k) => {
      const sp = document.createElement('span'); sp.style.background = col;
      if (k === c) sp.className = 'on';
      sp.onclick = () => this.setLook({ co: k });
      sw.appendChild(sp);
    });
    p.appendChild(sw);
  },
  setLook(patch) {
    if (patch.co !== undefined && Coop.look.co < 0) Coop.look.co = Coop.myColor();
    Object.assign(Coop.look, patch);
    try { localStorage.setItem('worldmap-look', JSON.stringify(Coop.look)); } catch (e) { /* no storage */ }
    Sound.sfx('ui');
    if (this.isOpen() && this.page === 0) this.build();
  },

  // --- page 2: collectibles --------------------------------------------------------------
  buildCollectibles(p) {
    const info = document.createElement('div'); info.className = 'info';
    const say = (a, b, col) => { info.innerHTML = ''; info.appendChild(pxText(a, col || '#f2f0e8')); if (b) info.appendChild(pxText(b, '#9a9aa2')); };
    let selEl = null;
    const slot = (row, g, on, a, b, col) => {
      const s = document.createElement('div'); s.className = 'slot' + (on ? ' on' : ' empty');
      s.appendChild(pxIcon(g, 1));
      const show = () => { if (selEl) selEl.classList.remove('sel'); selEl = s; s.classList.add('sel'); say(a, b, col); };
      s.onmouseenter = s.onclick = show;
      row.appendChild(s);
      return s;
    };
    const row = (text) => { this.label(p, text); const r = document.createElement('div'); r.className = 'slots'; p.appendChild(r); return r; };
    const r1 = row('CRYSTALS ' + Combat.crystals.length + '/' + CRYSTAL_SLOTS);
    for (let k = 0; k < CRYSTAL_SLOTS; k++) {
      const C = CRYSTALS[k], got = Combat.crystals.indexOf(k) >= 0;
      slot(r1, C ? C.g : CRYSTALS[0].g, got, got ? C.name : '???', got ? C.effect : 'DEFEAT A WORLD BOSS', got ? C.col : '#9a9aa2');
    }
    const r2 = row('SPECIALS');
    for (const k in SPECIALS) {
      const S = SPECIALS[k], got = Combat.specials.indexOf(k) >= 0;
      slot(r2, G[S.icon], got, got ? S.name : '???', got ? 'HOLD SPACE TO CHANNEL, E TO SWITCH' : 'TRADE 5 WEAPONS TO LEARN');
    }
    const r3 = row('ITEMS');
    slot(r3, G.icon_map, true, 'WORLD MAP', 'PRESS M TO OPEN', '#e8d8b8');
    slot(r3, G.key, Combat.keys > 0, 'KEYS X' + Combat.keys, 'OPEN LOCKED DOORS - ARENAS TAKE 2', '#f0b030');
    const r4 = row('WEAPONS ' + Combat.inv.length);
    Combat.inv.forEach((id, i) => {
      const it = ITEMS[id];
      slot(r4, G['item_' + id], true, it.name + (i === Combat.eq ? ' - HELD' : ''), it.kind + ' - ' + it.el + ' - Q TO SWAP', ELEMENTS[it.el].col);
    });
    p.appendChild(info);
    say('LEVEL ' + Combat.level(), 'HOVER OVER AN ITEM TO READ IT');
  },

  // --- page 3: settings and co-op ------------------------------------------------------
  buildSettings(p) {
    this.label(p, 'SETTINGS');
    const r = document.createElement('div'); r.className = 'row';
    const snd = this.button(Sound.enabled ? 'SOUND ON' : 'SOUND OFF', '', () => { Sound.start(); Sound.setEnabled(!Sound.enabled); snd.setText(Sound.enabled ? 'SOUND ON' : 'SOUND OFF'); Sound.sfx('ui'); });
    r.appendChild(snd);
    // restarting wipes your progress, so each button wants a second click to confirm
    const confirmBtn = (label, fn) => {
      let armed = 0;
      const b = this.button(label, 'warn', () => {
        if (armed) { fn(); return; }
        armed = setTimeout(() => { armed = 0; b.setText(label); b.classList.remove('armed'); }, 2500);
        b.setText('SURE? CLICK AGAIN'); b.classList.add('armed'); Sound.sfx('ui');
      });
      return b;
    };
    r.append(confirmBtn('RESTART WORLD', () => this.restart(this.seed)), confirmBtn('NEW WORLD', () => this.restart(Math.floor(Math.random() * 1e9))));
    p.appendChild(r);
    this.label(p, 'CO-OP ROOM');
    const r2 = document.createElement('div'); r2.className = 'row';
    const input = document.createElement('input');
    input.maxLength = 24; input.spellcheck = false; input.autocomplete = 'off'; input.value = this.code;
    const join = () => {
      const code = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!code) return;
      this.code = code; input.value = code;
      history.replaceState(null, '', `?room=${code}&seed=${this.seed}`);
      Coop.join(code, this.seed);
      this.refresh();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); if (e.key === 'Escape') this.toggle(false); e.stopPropagation(); });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('input', () => { this.code = input.value; });
    const copy = this.button('COPY LINK', '', () => {
      const code = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const url = `${location.origin}${location.pathname}?room=${code}&seed=${this.seed}`;
      const done = () => { copy.setText('COPIED'); setTimeout(() => copy.setText('COPY LINK'), 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Invite link', url));
      else prompt('Invite link', url);
    });
    r2.append(input, this.button('JOIN', '', join), copy);
    p.appendChild(r2);
    this.stat = document.createElement('div'); this.stat.className = 'stat';
    p.appendChild(this.stat);
    this.refresh();
  },

  toggle(open) {
    const p = this.panel;
    if (!p) return;
    if (open === undefined) open = !p.classList.contains('open');
    p.classList.toggle('open', open); this.back.classList.toggle('open', open);
    Sound.sfx('ui');
    if (open) { this.page = 1; this.scale(); this.build(); p.focus(); } else document.getElementById('cvs').focus();
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
    const n = Coop.peers.size + 1;
    const [col, text] = {
      solo: ['#555', 'SOLO - PICK A ROOM AND JOIN'],
      connecting: ['#e8b040', 'CONNECTING...'],
      joined: ['#5ae070', n > 1 ? n + ' EXPLORERS HERE' : 'IN ROOM - WAITING FOR FRIENDS'],
      offline: ['#e05050', 'CAN\'T REACH CO-OP SERVERS - RETRYING'],
    }[Coop.status];
    this.btn.querySelector('.dot').style.background = col;
    if (this.stat && this.stat.isConnected) {
      this.stat.innerHTML = '';
      const i = document.createElement('i'); i.style.background = col;
      this.stat.append(i, pxText(text, '#9a9aa2'));
    }
    if (Coop.self !== this.pickerSelf) { this.pickerSelf = Coop.self; if (this.isOpen() && this.page === 0) this.build(); }
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
