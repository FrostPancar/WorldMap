'use strict';
// ---------------------------------------------------------------------------
// WebGL post-processing:
//   composite  scene * dithered light + scatter haze + emissive  (low res)
//   bloom      bright-pass -> separable blur at 1/2 and 1/4 res
//   final      crisp upscale, chromatic fringe, scanlines, vignette,
//              slight curvature, grain, Bayer dissolve for transitions
// Render targets store colour / 2 so 8-bit buffers can carry 2x overbright.
// ---------------------------------------------------------------------------

const GLSL_COMMON = `
precision highp float;
varying vec2 v;
float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS_COMP = GLSL_COMMON + `
uniform sampler2D uS, uL, uE;
uniform vec2 uRes, uCam;
uniform vec3 uAmb;
uniform float uEK, uLevels, uHaze;
void main(){
  vec3 s = texture2D(uS, v).rgb;
  vec3 L = texture2D(uL, v).rgb * 2.0;
  vec3 e = texture2D(uE, v).rgb;
  vec2 p = floor(v * uRes); p.y = uRes.y - 1.0 - p.y; p += uCam;
  float b = bayer4(p);
  // soft-compress stacked light so clusters of lamps don't blow out
  vec3 addRaw = max(L - uAmb, 0.0);
  vec3 add = addRaw * 1.25 / (1.0 + addRaw * 0.9);
  vec3 addQ = floor(add * uLevels + b) / uLevels;
  vec3 Lf = min(L, uAmb) + addQ;
  vec3 col = s * Lf;
  float gi = max(add.r, max(add.g, add.b));
  vec3 hue = add / max(gi, 1e-4);
  float hz = step(b + 0.03, gi * 0.6) * 0.11 + step(b + 0.03, gi * 0.22) * 0.1;
  col += hue * hz * uHaze;
  col += e * uEK;
  gl_FragColor = vec4(col * 0.5, 1.0);
}`;

const FS_BRIGHT = GLSL_COMMON + `
uniform sampler2D uT; uniform vec2 uTx; uniform float uTh;
void main(){
  vec3 c = texture2D(uT, v + vec2(-0.5, -0.5) * uTx).rgb + texture2D(uT, v + vec2(0.5, -0.5) * uTx).rgb +
           texture2D(uT, v + vec2(-0.5, 0.5) * uTx).rgb + texture2D(uT, v + vec2(0.5, 0.5) * uTx).rgb;
  c *= 0.5; // average * 2 (decode)
  float l = max(c.r, max(c.g, c.b));
  c *= smoothstep(uTh, uTh + 0.45, l);
  gl_FragColor = vec4(c * 0.5, 1.0);
}`;

const FS_BLUR = GLSL_COMMON + `
uniform sampler2D uT; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(uT, v).rgb * 0.227027;
  c += (texture2D(uT, v + uDir * 1.384615).rgb + texture2D(uT, v - uDir * 1.384615).rgb) * 0.316216;
  c += (texture2D(uT, v + uDir * 3.230769).rgb + texture2D(uT, v - uDir * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

const FS_FINAL = GLSL_COMMON + `
uniform sampler2D uC, uB1, uB2;
uniform vec2 uSRes, uView, uFrac;
uniform float uTime, uFade, uCurve, uScan, uBloom, uCA, uWarp, uHue, uMono;
vec3 hueRot(vec3 c, float a){
  vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c;
  float h = atan(yiq.z, yiq.y) + a, ch = length(yiq.yz);
  yiq.y = ch * cos(h); yiq.z = ch * sin(h);
  return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * yiq;
}
vec3 fetch(vec2 p){ return texture2D(uC, vec2((floor(p.x) + 0.5) / uSRes.x, 1.0 - (floor(p.y) + 0.5) / uSRes.y)).rgb; }
void main(){
  vec2 cc = v - 0.5;
  float r2 = dot(cc, cc);
  vec2 uv = 0.5 + cc * (1.0 + uCurve * r2);
  vec2 sp = vec2(uv.x * uView.x, (1.0 - uv.y) * uView.y) + 1.0 + uFrac;
  sp.x += sin(sp.y * 0.09 + uTime * 1.7) * uWarp;
  sp.y += sin(sp.x * 0.07 + uTime * 1.1) * uWarp * 0.5;
  float ca = uCA * (0.3 + 1.6 * r2);
  vec3 col;
  col.r = fetch(sp + vec2(ca, 0.0)).r;
  col.g = fetch(sp).g;
  col.b = fetch(sp - vec2(ca, 0.0)).b;
  col *= 2.0;
  vec2 buv = vec2(sp.x / uSRes.x, 1.0 - sp.y / uSRes.y);
  vec3 bl = texture2D(uB1, buv).rgb * 2.0 * 0.9 + texture2D(uB2, buv).rgb * 2.0 * 1.4;
  col += bl * uBloom;
  if (uHue > 0.0) col = max(hueRot(col, uTime * uHue), 0.0);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(1.08, 0.96, 0.78), uMono);
  vec2 f = fract(sp);
  float scan = mix(1.0, 0.74 + 0.26 * sin(f.y * 3.14159), uScan);
  float grille = mix(1.0, 0.9 + 0.1 * sin(f.x * 3.14159), uScan);
  col *= scan * grille;
  float vig = smoothstep(0.95, 0.3, length(cc * vec2(1.0, 0.9)));
  col *= mix(0.5, 1.0, vig);
  col = col / (1.0 + col * 0.15) * 1.1;
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 311.0) - 0.5) * 0.03;
  col *= step(uFade, bayer4(floor(sp)) + 0.0001);
  vec2 e = smoothstep(vec2(0.0), vec2(0.003), uv) * smoothstep(vec2(1.0), vec2(0.997), uv);
  col *= e.x * e.y;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

class Post {
  constructor(canvas) {
    const opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    this.gl = gl;
    this.ok = !!gl;
    if (!gl) return;
    const tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.progs = {
      comp: this.program(FS_COMP), bright: this.program(FS_BRIGHT), blur: this.program(FS_BLUR), final: this.program(FS_FINAL),
    };
    this.tS = this.tex(gl.NEAREST); this.tL = this.tex(gl.LINEAR); this.tE = this.tex(gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.targets = null;
  }
  program(fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  tex(filter) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  target(w, h) {
    const gl = this.gl, t = this.tex(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  resize(SW, SH) {
    if (!this.ok) return;
    const gl = this.gl;
    if (this.targets) for (const k in this.targets) { gl.deleteTexture(this.targets[k].t); gl.deleteFramebuffer(this.targets[k].f); }
    const hw = Math.max(1, SW >> 1), hh = Math.max(1, SH >> 1), qw = Math.max(1, SW >> 2), qh = Math.max(1, SH >> 2);
    this.targets = {
      comp: this.target(SW, SH), h1: this.target(hw, hh), h2: this.target(hw, hh), q1: this.target(qw, qh), q2: this.target(qw, qh),
    };
    this.SW = SW; this.SH = SH;
  }
  upload(t, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
  pass(prog, target, binds, setU) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : this.screenW, target ? target.h : this.screenH);
    gl.useProgram(prog.p);
    binds.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t[1]); gl.uniform1i(prog.u[t[0]], i); });
    setU(prog.u);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  render(scene, light, emit, P) {
    const gl = this.gl, T = this.targets, pr = this.progs;
    this.screenW = gl.drawingBufferWidth; this.screenH = gl.drawingBufferHeight;
    this.upload(this.tS, scene); this.upload(this.tL, light); this.upload(this.tE, emit);
    this.pass(pr.comp, T.comp, [['uS', this.tS], ['uL', this.tL], ['uE', this.tE]], (u) => {
      gl.uniform2f(u.uRes, this.SW, this.SH); gl.uniform2f(u.uCam, P.camX, P.camY);
      gl.uniform3f(u.uAmb, P.amb[0], P.amb[1], P.amb[2]);
      gl.uniform1f(u.uEK, P.emitK); gl.uniform1f(u.uLevels, P.levels); gl.uniform1f(u.uHaze, P.haze);
    });
    this.pass(pr.bright, T.h1, [['uT', T.comp.t]], (u) => {
      gl.uniform2f(u.uTx, 1 / this.SW, 1 / this.SH); gl.uniform1f(u.uTh, P.threshold);
    });
    const blur = (src, dst, w, h, dx, dy) => this.pass(pr.blur, dst, [['uT', src.t]], (u) => gl.uniform2f(u.uDir, dx / w, dy / h));
    blur(T.h1, T.h2, T.h1.w, T.h1.h, 1, 0); blur(T.h2, T.h1, T.h1.w, T.h1.h, 0, 1);
    blur(T.h1, T.q1, T.h1.w, T.h1.h, 1, 0); // downsample + blur
    blur(T.q1, T.q2, T.q1.w, T.q1.h, 0, 1);
    blur(T.q2, T.q1, T.q1.w, T.q1.h, 1.5, 0); blur(T.q1, T.q2, T.q1.w, T.q1.h, 0, 1.5);
    this.pass(pr.final, null, [['uC', T.comp.t], ['uB1', T.h1.t], ['uB2', T.q2.t]], (u) => {
      gl.uniform2f(u.uSRes, this.SW, this.SH); gl.uniform2f(u.uView, P.viewW, P.viewH);
      gl.uniform2f(u.uFrac, P.fracX, P.fracY); gl.uniform1f(u.uTime, P.time); gl.uniform1f(u.uFade, P.fade);
      gl.uniform1f(u.uCurve, P.curve); gl.uniform1f(u.uScan, P.scan); gl.uniform1f(u.uBloom, P.bloom); gl.uniform1f(u.uCA, P.ca);
      gl.uniform1f(u.uWarp, P.warp || 0); gl.uniform1f(u.uHue, P.hue || 0); gl.uniform1f(u.uMono, P.mono || 0);
    });
  }
}
