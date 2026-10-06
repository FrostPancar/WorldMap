'use strict';
// ---------------------------------------------------------------------------
// Player, wandering creatures and the particle system.
// ---------------------------------------------------------------------------

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function makeCreature(name, x, y, biome, R) {
  return {
    g: G[name], x, y, fx: x, fy: y, t: 1, moving: false,
    speed: 2 + R() * 2.5, wait: R() * 4, flip: R() < 0.5, biome, ph: R() * 10,
    px: x * TS, py: y * TS,
  };
}

function updateCreature(c, m, dt, pl) {
  // pets follow the player, enemies chase when close, everything else wanders
  const pdx = pl.x - c.x, pdy = pl.y - c.y, pd = Math.abs(pdx) + Math.abs(pdy);
  const chase = c.enemy && pd < 7, follow = c.pet && pd > 2;
  const speed = (c.pet ? 7 : chase ? 3.6 : c.speed) * (c.slow > 0 ? 0.4 : 1);
  if (c.moving) {
    c.t += dt * speed;
    if (c.t >= 1) { c.t = 1; c.moving = false; c.wait = (chase || follow) ? 0.05 : 0.2 + Math.random() * (Math.random() < 0.3 ? 4 : 1.2); }
  } else {
    c.wait -= dt;
    if (c.pet && pd > 14) { // a pet left far behind catches up
      c.x = c.fx = pl.x; c.y = c.fy = pl.y + (m.blocked(pl.x, pl.y + 1) ? 0 : 1);
    } else if (c.wait <= 0) {
      const tries = [];
      if (chase || follow) {
        const sx = Math.sign(pdx), sy = Math.sign(pdy);
        if (Math.abs(pdx) >= Math.abs(pdy)) { if (sx) tries.push([sx, 0]); if (sy) tries.push([0, sy]); }
        else { if (sy) tries.push([0, sy]); if (sx) tries.push([sx, 0]); }
      } else if (!c.pet) {
        const k = Math.floor(Math.random() * 4);
        tries.push([[0, 1, 0, -1][k], [-1, 0, 1, 0][k]]);
      }
      let moved = false;
      for (const [dx, dy] of tries) {
        const nx = c.x + dx, ny = c.y + dy, ni = ny * m.w + nx;
        const ok = !m.blocked(nx, ny) && !m.entr.has(ni) && (c.biome < 0 || chase || m.biome[ni] === c.biome) &&
          !(nx === pl.x && ny === pl.y) && !(nx === pl.tx && ny === pl.ty);
        if (!ok) continue;
        c.fx = c.x; c.fy = c.y; c.x = nx; c.y = ny; c.t = 0; c.moving = true;
        if (dx) c.flip = dx < 0;
        moved = true; break;
      }
      if (!moved) c.wait = (chase || follow) ? 0.25 : 0.3 + Math.random();
    }
  }
  const t = c.moving ? c.t : 1;
  c.px = lerp(c.fx, c.x, t) * TS;
  c.py = lerp(c.fy, c.y, t) * TS - (c.moving ? Math.sin(t * Math.PI) * 1.5 : 0);
}

class Player {
  constructor() { this.place(0, 0); this.face = 'down'; this.animT = 0; }
  place(x, y) {
    this.x = x; this.y = y; this.tx = x; this.ty = y; this.fx = x; this.fy = y;
    this.t = 1; this.moving = false; this.px = x * TS; this.py = y * TS;
  }
  // returns true when the player arrived on a new tile this frame
  update(dt, m, dir, run) {
    let arrived = false;
    const speed = run ? 11 : 6.5;
    if (this.moving) {
      this.t += dt * speed;
      this.animT += dt;
      if (this.t >= 1) {
        this.moving = false; this.x = this.tx; this.y = this.ty; arrived = true;
        const extra = (this.t - 1) / speed;
        this.t = 1;
        if (dir && this.tryMove(m, dir)) this.t = Math.min(0.99, extra * speed);
      }
    } else if (dir) {
      this.tryMove(m, dir);
    }
    if (!this.moving && !dir) this.animT = 0;
    const t = this.moving ? smooth(clamp(this.t, 0, 1)) * 0.35 + clamp(this.t, 0, 1) * 0.65 : 1;
    this.px = lerp(this.fx, this.tx, t) * TS;
    this.py = lerp(this.fy, this.ty, t) * TS;
    return arrived;
  }
  tryMove(m, dir) {
    this.face = dir;
    const [dx, dy] = DIRS[dir];
    const nx = this.x + dx, ny = this.y + dy;
    if (m.blocked(nx, ny)) return false;
    this.fx = this.x; this.fy = this.y; this.tx = nx; this.ty = ny; this.t = 0; this.moving = true;
    return true;
  }
  sprite() {
    const frame = this.moving ? (Math.floor(this.animT * 9) % 2) : 0;
    if (this.face === 'up') return [G.p_up, frame, false];
    if (this.face === 'down') return [G.p_down, frame, false];
    return [G.p_side, frame, this.face === 'left'];
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
const PK = {
  firefly: { c: '#d8ff6a', emit: 1 }, wisp: { c: '#7af0ff', emit: 1 }, spore: { c: '#b8e060', emit: 0.3 },
  sparkle: { c: '#ffb0d8', emit: 1 }, twinkle: { c: '#e8f4ff', emit: 1 }, dust: { c: '#b0703a', emit: 0 },
  bubble: { c: '#ff5a50', emit: 0.5 }, ember: { c: '#ffb040', emit: 1 }, snow: { c: '#e8f0ff', emit: 0.25 },
  mote: { c: '#8a8ad0', emit: 0.4 }, step: { c: '#6a6a70', emit: 0 }, drip: { c: '#6ab0ff', emit: 0.6 },
  leaf: { c: '#5aa040', emit: 0 },
  ash: { c: '#6a5a5a', emit: 0 },
  petal: { c: '#ffb8d0', emit: 0.3 }, confettiR: { c: '#ff4a6a', emit: 0.4 }, confettiY: { c: '#ffe04a', emit: 0.4 },
  confettiB: { c: '#4ad8ff', emit: 0.4 }, star: { c: '#fff6a0', emit: 1 }, gold: { c: '#f0c040', emit: 1 },
  rain: { c: '#6a8ad8', emit: 0.3 }, beamSpark: { c: '#ffffff', emit: 1 }, bubbleUp: { c: '#8ad8ff', emit: 0.6 }, shard: { c: '#d8b0ff', emit: 1 }, leafA: { c: '#e07a28', emit: 0.2 },
};
const particles = [];

function spawnParticle(kind, x, y, vx, vy, life, col) {
  if (particles.length > 700) return;
  particles.push({ k: kind, x, y, vx, vy, life, max: life, ph: Math.random() * 10, col });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
    switch (p.k) {
      case 'firefly': case 'wisp':
        p.vx += (Math.random() - 0.5) * 40 * dt; p.vy += (Math.random() - 0.5) * 40 * dt;
        p.vx *= 0.98; p.vy *= 0.98; break;
      case 'ember':
        p.vx += Math.sin(p.ph + p.life * 9) * 12 * dt; p.vy -= 6 * dt; break;
      case 'snow': case 'leaf': case 'leafA': case 'ash': case 'petal': case 'confettiR': case 'confettiY': case 'confettiB': case 'bubbleUp':
        p.vx = Math.sin(p.ph + p.life * 2) * 8 + (p.k === 'leaf' || p.k === 'leafA' ? 6 : 0); break;
      case 'drip': p.vy += 120 * dt; break;
      case 'beamSpark': p.vx *= 0.9; p.vy *= 0.9; break;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}

function drawParticles(sctx, ectx, ox, oy, W, H, time) {
  for (const p of particles) {
    const x = Math.round(p.x - ox), y = Math.round(p.y - oy);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const def = PK[p.k];
    let a = Math.min(1, p.life / (p.max * 0.3), (p.max - p.life) / 0.25 + 0.1);
    if (p.k === 'firefly') a *= 0.35 + 0.65 * Math.max(0, Math.sin(time * 3 + p.ph));
    if (p.k === 'sparkle' || p.k === 'twinkle' || p.k === 'shard' || p.k === 'star' || p.k === 'gold') a *= Math.sin((1 - p.life / p.max) * Math.PI);
    if (a <= 0.02) continue;
    const c = p.col || def.c;
    sctx.globalAlpha = a; sctx.fillStyle = c; sctx.fillRect(x, y, 1, 1);
    if (def.emit) { ectx.globalAlpha = a * def.emit; ectx.fillStyle = c; ectx.fillRect(x, y, 1, 1); }
  }
  sctx.globalAlpha = 1; ectx.globalAlpha = 1;
}
