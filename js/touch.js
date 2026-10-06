'use strict';
// ---------------------------------------------------------------------------
// Touch controls: a d-pad (slide your thumb between directions), a run
// button, a map button and, while the map is open, zoom buttons. Shown on
// touch devices; laid out for both portrait and landscape.
// ---------------------------------------------------------------------------

const Touch = {
  init() {
    const css = document.createElement('style');
    css.textContent = `
      #touch{position:fixed;inset:0;pointer-events:none;z-index:4;display:none}
      body.touch #touch{display:block}
      #dpad{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;
        left:calc(18px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));
        width:var(--pad);height:var(--pad);background:radial-gradient(circle,#0000 30%,#0b0b1088 31%);
        border:1px solid #ffffff22}
      #dpad i{position:absolute;width:34%;height:34%;border-radius:6px;background:#14141ccc;border:1px solid #ffffff2a;
        display:flex;align-items:center;justify-content:center;color:#cfcfc4;font:600 calc(var(--pad)*.11)/1 monospace;font-style:normal}
      #dpad i.on{background:#f2f0e8;color:#0b0b10;border-color:#f2f0e8}
      #dpad .up{left:33%;top:0}#dpad .down{left:33%;bottom:0}#dpad .left{left:0;top:33%}#dpad .right{right:0;top:33%}
      .tbtn{position:absolute;pointer-events:auto;touch-action:none;width:var(--btn);height:var(--btn);border-radius:50%;
        background:#14141ccc;border:1px solid #ffffff2a;color:#cfcfc4;font:600 calc(var(--btn)*.24)/1 monospace;
        display:flex;align-items:center;justify-content:center;letter-spacing:.04em}
      .tbtn.on{background:#f2f0e8;color:#0b0b10}
      #t-run{right:calc(20px + env(safe-area-inset-right));bottom:calc(22px + env(safe-area-inset-bottom))}
      #t-map{right:calc(30px + var(--btn) + env(safe-area-inset-right));bottom:calc(22px + var(--btn) * .7 + env(safe-area-inset-bottom))}
      #t-zin,#t-zout{display:none}
      body.touch.mapmode #t-zin,body.touch.mapmode #t-zout{display:flex}
      body.touch.mapmode #t-run,body.touch.mapmode #dpad{display:none}
      #t-zin{right:calc(20px + env(safe-area-inset-right));bottom:calc(22px + env(safe-area-inset-bottom))}
      #t-zout{right:calc(20px + env(safe-area-inset-right));bottom:calc(32px + var(--btn) + env(safe-area-inset-bottom))}
      body.mapmode #t-map{right:calc(30px + var(--btn) + env(safe-area-inset-right));bottom:calc(22px + env(safe-area-inset-bottom))}
      #touch{--pad:min(42vw,40vh,170px);--btn:min(17vw,16vh,64px)}
      @media (orientation:landscape){#touch{--pad:min(24vw,46vh,170px);--btn:min(11vw,18vh,64px)}}
      body.touch #coop-btn{bottom:auto;top:calc(14px + env(safe-area-inset-top));left:calc(14px + env(safe-area-inset-left))}
      body.touch #coop-panel{bottom:auto;top:calc(56px + env(safe-area-inset-top));left:calc(14px + env(safe-area-inset-left));max-height:calc(100% - 80px);overflow:auto}`;
    document.head.appendChild(css);
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `<div id="dpad"><i class="up">▲</i><i class="down">▼</i><i class="left">◀</i><i class="right">▶</i></div>
      <div class="tbtn" id="t-run">RUN</div><div class="tbtn" id="t-map">MAP</div>
      <div class="tbtn" id="t-zin">+</div><div class="tbtn" id="t-zout">−</div>`;
    document.body.appendChild(root);
    this.pad = root.querySelector('#dpad');
    this.arrows = {};
    for (const d of ['up', 'down', 'left', 'right']) this.arrows[d] = this.pad.querySelector('.' + d);

    // d-pad: direction follows the thumb, so you can slide between arrows
    let padId = null;
    const steer = (e) => {
      const r = this.pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      let d = null;
      if (Math.hypot(dx, dy) > r.width * 0.1) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.setDir(d);
    };
    this.pad.addEventListener('pointerdown', (e) => { e.preventDefault(); padId = e.pointerId; this.pad.setPointerCapture(e.pointerId); steer(e); });
    this.pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) steer(e); });
    const release = (e) => { if (e.pointerId === padId) { padId = null; this.setDir(null); } };
    this.pad.addEventListener('pointerup', release);
    this.pad.addEventListener('pointercancel', release);

    const run = root.querySelector('#t-run');
    run.addEventListener('pointerdown', (e) => { e.preventDefault(); input.touchRun = !input.touchRun; run.classList.toggle('on', input.touchRun); });
    const tap = (id, fn) => root.querySelector(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    tap('#t-map', () => toggleMap());
    tap('#t-zin', () => MapView.zoomBy(1));
    tap('#t-zout', () => MapView.zoomBy(-1));

    const enable = () => document.body.classList.add('touch');
    if (navigator.maxTouchPoints > 0 || 'ontouchstart' in window || matchMedia('(pointer: coarse)').matches) enable();
    addEventListener('touchstart', enable, { passive: true, once: true });
    // block pinch/double-tap browser zoom on iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    let lastTap = 0;
    document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTap < 300 && e.target.tagName !== 'INPUT') e.preventDefault(); lastTap = n; }, { passive: false });
    setInterval(() => document.body.classList.toggle('mapmode', game.mode === 'map'), 150);
  },
  setDir(d) {
    if (input.touchDir === d) return;
    input.touchDir = d;
    for (const k in this.arrows) this.arrows[k].classList.toggle('on', k === d);
  },
};
Touch.init();
