'use strict';
// ---------------------------------------------------------------------------
// Sound: everything is synthesised with WebAudio (no files). A generative
// ambient score (slow pads, a bass drone and sparse bell melodies) follows
// the player's surroundings: time of day and biome outdoors, the dream theme
// indoors. Sound effects are small synth patches. Audio starts on the first
// key/tap (browser autoplay rules) and can be muted from the ⚙ menu.
// ---------------------------------------------------------------------------

// Moods: root note (MIDI), scale intervals, bell rate, density, timbres, filter.
const MOODS = {
  day: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 34, dens: 0.55, pad: 'triangle', bell: 'sine', lp: 1800, oct: 12 },
  night: { root: 57, scale: [0, 3, 5, 7, 10], bpm: 26, dens: 0.45, pad: 'sine', bell: 'sine', lp: 1100, oct: 12 },
  spooky: { root: 50, scale: [0, 1, 5, 7, 8], bpm: 18, dens: 0.4, pad: 'sawtooth', bell: 'triangle', lp: 700, oct: 12, wob: 9 },
  snow: { root: 64, scale: [0, 2, 4, 6, 7, 11], bpm: 20, dens: 0.35, pad: 'sine', bell: 'sine', lp: 2400, oct: 24 },
  volcano: { root: 45, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 22, dens: 0.35, pad: 'sawtooth', bell: 'triangle', lp: 600, oct: 12 },
  crystal: { root: 62, scale: [0, 2, 4, 7, 11], bpm: 40, dens: 0.6, pad: 'sine', bell: 'sine', lp: 3000, oct: 24 },
  desert: { root: 52, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 26, dens: 0.45, pad: 'triangle', bell: 'triangle', lp: 1400, oct: 12 },
  marsh: { root: 53, scale: [0, 3, 5, 6, 7, 10], bpm: 20, dens: 0.4, pad: 'sine', bell: 'triangle', lp: 900, oct: 12, wob: 6 },
  pink: { root: 65, scale: [0, 4, 7, 9, 11], bpm: 36, dens: 0.6, pad: 'sine', bell: 'sine', lp: 2600, oct: 12 },
  // dream interiors
  mondrian: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 70, dens: 0.6, pad: 'square', bell: 'square', lp: 1200, oct: 12 },
  starry: { root: 55, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 30, dens: 0.55, pad: 'sine', bell: 'sine', lp: 2000, oct: 12, wob: 4 },
  wave: { root: 57, scale: [0, 1, 5, 7, 8], bpm: 28, dens: 0.5, pad: 'triangle', bell: 'triangle', lp: 1600, oct: 12 },
  nightcity: { root: 53, scale: [0, 3, 5, 7, 10], bpm: 46, dens: 0.55, pad: 'sawtooth', bell: 'triangle', lp: 900, oct: 12, wob: 3 },
  scream: { root: 48, scale: [0, 1, 3, 6, 7, 9], bpm: 16, dens: 0.4, pad: 'sawtooth', bell: 'sine', lp: 800, oct: 12, wob: 14 },
  eyes: { root: 47, scale: [0, 1, 2, 6, 7], bpm: 14, dens: 0.45, pad: 'sawtooth', bell: 'sine', lp: 600, oct: 24, wob: 10 },
  numbers: { root: 67, scale: [0, 2, 4, 6, 8, 10], bpm: 40, dens: 0.5, pad: 'sine', bell: 'triangle', lp: 2200, oct: 12 },
  rapanui: { root: 50, scale: [0, 3, 5, 7, 10], bpm: 20, dens: 0.35, pad: 'sine', bell: 'triangle', lp: 900, oct: 12 },
  giza: { root: 52, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 30, dens: 0.5, pad: 'triangle', bell: 'triangle', lp: 1300, oct: 12 },
  vapor: { root: 58, scale: [0, 4, 7, 11, 14], bpm: 32, dens: 0.55, pad: 'sawtooth', bell: 'sine', lp: 1100, oct: 12, wob: 8 },
  melting: { root: 56, scale: [0, 2, 4, 6, 8, 10], bpm: 18, dens: 0.4, pad: 'sine', bell: 'sine', lp: 1200, oct: 12, wob: 18 },
  muertos: { root: 62, scale: [0, 2, 4, 5, 7, 9], bpm: 60, dens: 0.6, pad: 'triangle', bell: 'triangle', lp: 1800, oct: 12 },
  klimt: { root: 61, scale: [0, 2, 4, 7, 9], bpm: 34, dens: 0.6, pad: 'sine', bell: 'sine', lp: 2800, oct: 24 },
  gallery: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 24, dens: 0.45, pad: 'sine', bell: 'sine', lp: 1600, oct: 12 },
  chess: { root: 57, scale: [0, 2, 3, 5, 7, 8, 11], bpm: 36, dens: 0.5, pad: 'triangle', bell: 'square', lp: 1300, oct: 12 },
  aquarium: { root: 59, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 22, dens: 0.5, pad: 'sine', bell: 'sine', lp: 900, oct: 12, wob: 7 },
};

const Sound = {
  ctx: null,
  enabled: (() => { try { return localStorage.getItem('worldmap-sound') !== 'off'; } catch (e) { return true; } })(),
  mood: MOODS.night, moodKey: 'night', nextPad: 0, nextBell: 0, step: 0,

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.enabled ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.7; this.sfxBus.connect(this.master);
    // a long, soft reverb shared by everything
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb.buffer = ir;
    this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.55;
    this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
    const nl = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    this.nextPad = ctx.currentTime + 0.2; this.nextBell = ctx.currentTime + 1.5;
  },
  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem('worldmap-sound', on ? 'on' : 'off'); } catch (e) { /* no storage */ }
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.1);
  },

  // --- music -------------------------------------------------------------------
  pickMood() {
    const m = game.map;
    if (!m || !game.world) return 'night';
    if (m !== game.world.map) return m.dream && MOODS[m.dream.name] ? m.dream.name : 'night';
    const b = m.biome[game.player.y * m.w + game.player.x];
    const special = { [B.SPOOKY]: 'spooky', [B.SNOW]: 'snow', [B.VOLCANO]: 'volcano', [B.CRYSTAL]: 'crystal', [B.DUNES]: 'desert', [B.MARSH]: 'marsh', [B.PINK]: 'pink' };
    if (special[b]) return special[b];
    return dayState(game.day).day > 0.5 ? 'day' : 'night';
  },
  update() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.enabled) return;
    const key = this.pickMood();
    if (key !== this.moodKey) {
      this.moodKey = key; this.mood = MOODS[key];
      this.nextPad = Math.min(this.nextPad, ctx.currentTime + 0.5); // let the new mood in quickly
    }
    const now = ctx.currentTime;
    if (this.nextPad < now) this.nextPad = now + 0.05;
    if (this.nextBell < now) this.nextBell = now + 0.05;
    while (this.nextPad < now + 0.4) { this.pad(this.nextPad); this.nextPad += 7; }
    while (this.nextBell < now + 0.4) {
      if (Math.random() < this.mood.dens) this.bell(this.nextBell);
      this.nextBell += (60 / this.mood.bpm) * [1, 1, 0.5, 2][Math.floor(Math.random() * 4)];
    }
  },
  freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },
  note(deg, base) {
    const s = this.mood.scale, n = s.length;
    const o = Math.floor(deg / n), k = ((deg % n) + n) % n;
    return base + s[k] + o * 12;
  },
  pad(t) {
    const ctx = this.ctx, M = this.mood;
    const deg = [0, 0, 2, 3, 4, 1][Math.floor(Math.random() * 6)];
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = M.lp; filt.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 2.6); g.gain.setValueAtTime(0.11, t + 6); g.gain.linearRampToValueAtTime(0, t + 9.5);
    filt.connect(g); g.connect(this.music);
    const send = ctx.createGain(); send.gain.value = 0.6; g.connect(send); send.connect(this.verb);
    const voices = [this.note(deg, M.root - 12), this.note(deg + 2, M.root - 12), this.note(deg + 4, M.root - 12)];
    for (const mn of voices) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = M.pad; o.frequency.value = this.freq(mn); o.detune.value = det;
      if (M.wob) {
        const l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = 0.15 + Math.random() * 0.2; lg.gain.value = M.wob;
        l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + 9.6);
      }
      const og = ctx.createGain(); og.gain.value = M.pad === 'sine' ? 0.5 : 0.22;
      o.connect(og); og.connect(filt); o.start(t); o.stop(t + 9.6);
    }
    // bass drone on the chord root
    const b = ctx.createOscillator(), bg = ctx.createGain();
    b.type = 'sine'; b.frequency.value = this.freq(this.note(deg, M.root - 24));
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.16, t + 2); bg.gain.linearRampToValueAtTime(0, t + 9);
    b.connect(bg); bg.connect(this.music); b.start(t); b.stop(t + 9.2);
  },
  bell(t) {
    const ctx = this.ctx, M = this.mood;
    this.step = clamp(this.step + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)], -3, 9);
    const f = this.freq(this.note(this.step, M.root + M.oct - 12));
    const g = ctx.createGain(), dur = 1.6 + Math.random() * 1.6;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.connect(this.music);
    const send = ctx.createGain(); send.gain.value = 0.9; g.connect(send); send.connect(this.verb);
    for (const [mul, amp] of [[1, 1], [2.01, 0.25], [3.98, 0.08]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = mul === 1 ? M.bell : 'sine'; o.frequency.value = f * mul; og.gain.value = amp * (M.bell === 'square' ? 0.35 : 1);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
  },

  // --- sound effects ---------------------------------------------------------------
  ok() { return this.ctx && this.ctx.state === 'running' && this.enabled; },
  env(node, t, peak, a, d) {
    node.gain.setValueAtTime(0.0001, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },
  noiseHit(t, type, f0, f1, peak, dur, q, wet) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); this.env(g, t, peak, 0.005, dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.verb); }
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  tone(t, type, f0, f1, peak, a, dur, wet) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
    this.env(g, t, peak, a, dur);
    o.connect(g); g.connect(this.sfxBus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.verb); }
    o.start(t); o.stop(t + a + dur + 0.05);
  },
  stepSound(biome) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime, snow = biome === B.SNOW, sand = biome === B.DUNES;
    this.noiseHit(t, 'bandpass', snow ? 3500 : sand ? 1800 : 1200 + Math.random() * 600, snow ? 2500 : 700, snow ? 0.05 : 0.035, 0.06, 1.5);
  },
  sfx(name, k) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'enter':
        this.tone(t, 'sine', 520, 140, 0.18, 0.01, 0.6, 0.6);
        this.noiseHit(t, 'lowpass', 2400, 200, 0.12, 0.7, 0.7, 0.5); break;
      case 'exit':
        this.tone(t, 'sine', 160, 600, 0.16, 0.01, 0.5, 0.6);
        this.noiseHit(t, 'lowpass', 300, 2600, 0.1, 0.5, 0.7, 0.5); break;
      case 'map':
        this.tone(t, 'sine', 880, 0, 0.08, 0.005, 0.5, 0.8); this.tone(t + 0.09, 'sine', 1320, 0, 0.06, 0.005, 0.7, 0.8); break;
      case 'ui':
        this.tone(t, 'triangle', 660, 0, 0.06, 0.002, 0.08, 0.2); break;
      case 'join':
        this.tone(t, 'sine', 660, 0, 0.08, 0.005, 0.5, 0.7); this.tone(t + 0.12, 'sine', 990, 0, 0.08, 0.005, 0.8, 0.7); break;
      case 'absorb': {
        this.noiseHit(t, 'bandpass', 300, 4000, 0.14, 0.7, 3, 0.6);
        const base = k || 440;
        [0, 4, 7, 12].forEach((s, i) => this.tone(t + 0.08 + i * 0.07, 'triangle', base * Math.pow(2, s / 12), 0, 0.09, 0.005, 0.5, 0.8));
        break;
      }
      case 'beam': {
        const c = k || 0.3;
        this.tone(t, 'sawtooth', 1400 + c * 600, 70, 0.16 + c * 0.12, 0.004, 0.32 + c * 0.35, 0.4);
        this.tone(t, 'square', 700, 50, 0.06 + c * 0.06, 0.004, 0.25 + c * 0.3, 0.3);
        this.tone(t, 'sine', 120, 38, 0.25 * c + 0.08, 0.004, 0.35 + c * 0.3);
        this.noiseHit(t, 'highpass', 6000, 800, 0.08 + c * 0.1, 0.25 + c * 0.2, 0.7, 0.3);
        break;
      }
      case 'impact':
        this.noiseHit(t, 'lowpass', 1800, 120, 0.12 + (k || 0) * 0.15, 0.35, 0.8, 0.5);
        this.tone(t, 'sine', 90, 40, 0.12 + (k || 0) * 0.15, 0.003, 0.3); break;
      case 'shot': {
        const kind = k;
        if (kind === 'sword') this.noiseHit(t, 'bandpass', 800, 3000, 0.1, 0.12, 2, 0.2);
        else if (kind === 'gun') { this.noiseHit(t, 'lowpass', 3000, 300, 0.14, 0.12, 0.8, 0.3); this.tone(t, 'square', 220, 60, 0.06, 0.002, 0.1); }
        else if (kind === 'bow') this.tone(t, 'triangle', 900, 300, 0.06, 0.002, 0.12, 0.2);
        else if (kind === 'wand' || kind === 'watch') this.tone(t, 'sine', 700, 1400, 0.06, 0.005, 0.25, 0.6);
        else this.tone(t, 'triangle', 500, 900, 0.06, 0.002, 0.1, 0.2);
        break;
      }
      case 'kill':
        this.noiseHit(t, 'bandpass', 2000, 200, 0.12, 0.3, 1.5, 0.4); this.tone(t, 'square', 440, 110, 0.06, 0.003, 0.25, 0.3); break;
      case 'gem': this.tone(t, 'sine', 1200 + Math.random() * 400, 0, 0.04, 0.002, 0.12, 0.5); break;
      case 'levelup': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(t + i * 0.08, 'triangle', 523 * Math.pow(2, s / 12), 0, 0.08, 0.005, 0.4, 0.8)); break;
      case 'chest': this.tone(t, 'triangle', 392, 0, 0.08, 0.005, 0.3, 0.6); this.tone(t + 0.1, 'triangle', 587, 0, 0.08, 0.005, 0.5, 0.7); break;
      case 'heart': this.tone(t, 'sine', 880, 0, 0.06, 0.005, 0.25, 0.7); this.tone(t + 0.1, 'sine', 1175, 0, 0.06, 0.005, 0.35, 0.7); break;
      case 'die': this.tone(t, 'sawtooth', 300, 40, 0.18, 0.005, 1.1, 0.6); this.noiseHit(t, 'lowpass', 2000, 100, 0.15, 1, 0.8, 0.6); break;
      case 'flash': this.noiseHit(t, 'highpass', 5000, 3000, 0.08, 0.08, 0.7, 0.3); this.tone(t, 'sine', 2400, 1800, 0.04, 0.002, 0.1); break;
      case 'eshot': this.tone(t, 'square', 600, 300, 0.04, 0.002, 0.12, 0.2); break;
      case 'poke': this.tone(t, 'sine', 900, 1300, 0.05, 0.002, 0.1, 0.3); break;
      case 'key': this.tone(t, 'triangle', 1320, 0, 0.07, 0.002, 0.2, 0.6); this.tone(t + 0.07, 'triangle', 1760, 0, 0.06, 0.002, 0.3, 0.6); break;
      case 'unlock': this.noiseHit(t, 'bandpass', 2500, 1200, 0.1, 0.08, 3); this.tone(t + 0.1, 'triangle', 660, 0, 0.08, 0.003, 0.4, 0.6); this.tone(t + 0.2, 'triangle', 990, 0, 0.08, 0.003, 0.5, 0.6); break;
      case 'locked': this.noiseHit(t, 'bandpass', 1800, 900, 0.08, 0.06, 4); this.noiseHit(t + 0.09, 'bandpass', 1600, 800, 0.07, 0.06, 4); break;
      case 'hurt': this.tone(t, 'sawtooth', 180, 70, 0.1, 0.003, 0.2, 0.2); break;
      case 'hit':
        this.tone(t, 'square', 900, 300, 0.05, 0.002, 0.12, 0.3); break;
    }
  },
  // a held tone that rises while the beam charges
  chargeStart(base) {
    if (!this.ok() || this.charge) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine';
    o.frequency.value = base * 0.5; o2.frequency.value = base;
    f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 6;
    lfo.frequency.value = 6; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(g.gain);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.15);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxBus);
    const w = ctx.createGain(); w.gain.value = 0.4; g.connect(w); w.connect(this.verb);
    o.start(t); o2.start(t); lfo.start(t);
    this.charge = { o, o2, f, g, lfo, base };
  },
  chargeLevel(c) {
    const ch = this.charge;
    if (!ch) return;
    const t = this.ctx.currentTime;
    ch.o.frequency.setTargetAtTime(ch.base * (0.5 + c * 1.5), t, 0.05);
    ch.o2.frequency.setTargetAtTime(ch.base * (1 + c * 2), t, 0.05);
    ch.f.frequency.setTargetAtTime(400 + c * 3200, t, 0.05);
    ch.lfo.frequency.setTargetAtTime(6 + c * 14, t, 0.05);
  },
  chargeStop() {
    const ch = this.charge;
    if (!ch) return;
    this.charge = null;
    const t = this.ctx.currentTime;
    ch.g.gain.cancelScheduledValues(t); ch.g.gain.setTargetAtTime(0, t, 0.03);
    for (const n of [ch.o, ch.o2, ch.lfo]) n.stop(t + 0.2);
  },
};

// Browsers only allow audio after a user gesture.
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, () => Sound.start(), { passive: true });
