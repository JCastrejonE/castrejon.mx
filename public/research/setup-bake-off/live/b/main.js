/*
 * Mycelium — a Physarum polycephalum (slime mold) simulation.
 *
 * Based on the agent model in Jeff Jones, "Characteristics of pattern
 * formation and evolution in approximations of Physarum transport networks"
 * (2010). Every agent has three sensors (left, forward, right) that sample a
 * shared chemical trail map. It turns toward the strongest reading, takes a
 * step, and deposits more chemical. The map is blurred and decays each frame.
 * Vein-like networks appear from those local rules alone.
 *
 * Everything runs on the CPU with typed arrays and is drawn through a single
 * ImageData blit. No libraries, no build step.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- setup --
  const stage = document.getElementById('stage');
  const ctx = stage.getContext('2d', { alpha: false });
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  const $ = (id) => document.getElementById(id);
  const hud = $('hud'), brushEl = $('brush'), toastEl = $('toast');

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const MAX_CELLS = 320000;       // upper bound on simulation grid size
  const MAX_AGENTS = 260000;      // capacity of the agent buffers

  // Sin/cos lookup tables. An angle maps to a table index via a bit mask, so
  // negative and large angles wrap for free.
  const TRIG_N = 4096, TRIG_MASK = TRIG_N - 1, TRIG_K = TRIG_N / TAU;
  const COS = new Float32Array(TRIG_N), SIN = new Float32Array(TRIG_N);
  for (let i = 0; i < TRIG_N; i++) { COS[i] = Math.cos(i / TRIG_K); SIN[i] = Math.sin(i / TRIG_K); }

  // ------------------------------------------------------------ behaviours --
  // Units are simulation cells, radians per step, and multipliers per frame.
  const PRESETS = [
    { name: 'Membrane',  density: 0.50, sa: 15,   sd: 20, ra: 30,  speed: 1.5, deposit: 0.5, cap: 10, decay: 0.97, diffuse: 0.50, jitter: 0.05, glow: 0.50 },
    { name: 'Filaments', density: 0.60, sa: 11,   sd: 40, ra: 11,  speed: 2.2, deposit: 0.2, cap: 2,  decay: 0.92, diffuse: 0.15, jitter: 0.01, glow: 0.35 },
    { name: 'Silk',      density: 0.60, sa: 30,   sd: 60, ra: 5,   speed: 3.0, deposit: 0.3, cap: 3,  decay: 0.90, diffuse: 0.10, jitter: 0.02, glow: 0.40 },
    { name: 'Veins',     density: 0.30, sa: 22.5, sd: 9,  ra: 45,  speed: 1.0, deposit: 0.3, cap: 1,  decay: 0.90, diffuse: 0.50, jitter: 0.05, glow: 0.45 },
    { name: 'Coral',     density: 0.70, sa: 60,   sd: 22, ra: 20,  speed: 1.3, deposit: 0.2, cap: 1,  decay: 0.94, diffuse: 0.30, jitter: 0.02, glow: 0.40 },
    { name: 'Labyrinth', density: 0.30, sa: 60,   sd: 16, ra: -45, speed: 1.0, deposit: 1.0, cap: 20, decay: 0.96, diffuse: 0.70, jitter: 0.10, glow: 0.35 },
    { name: 'Worms',     density: 0.50, sa: 120,  sd: 18, ra: 60,  speed: 1.8, deposit: 3.0, cap: 80, decay: 0.95, diffuse: 0.45, jitter: 0.30, glow: 0.55 },
  ];

  // Colour ramps from background (t=0) to hot (t=1).
  const PALETTES = [
    { name: 'Bioluminescent', stops: ['#030306', '#06213a', '#0a6d7e', '#2fd3b5', '#d8ffe9', '#ffffff'] },
    { name: 'Ember',          stops: ['#040202', '#2a0710', '#7d1a1d', '#e0561c', '#ffc26b', '#fff6e0'] },
    { name: 'Orchid',         stops: ['#05030a', '#1d0b3a', '#5a1f7a', '#c53c9d', '#ffa3c8', '#fff4fb'] },
    { name: 'Gold Leaf',      stops: ['#050403', '#1f1a10', '#5b4a22', '#b99545', '#f4e3a1', '#ffffff'] },
    { name: 'Ice',            stops: ['#020409', '#0b1530', '#23488a', '#6aa6e8', '#d9ecff', '#ffffff'] },
    { name: 'Ink',            stops: ['#f2ede3', '#d9d1c1', '#9a917f', '#4a4439', '#17140f', '#000000'] },
  ];

  const PARAM_KEYS = ['sa', 'sd', 'ra', 'speed', 'deposit', 'decay', 'diffuse', 'jitter', 'cap', 'glow', 'density'];

  // Live parameters ease toward the target preset, so switching morphs the
  // organism instead of cutting to it.
  const params = {};
  let target = PRESETS[0];
  let presetIndex = 0;
  let paletteIndex = 0;
  Object.assign(params, target);

  // ---------------------------------------------------------------- state --
  let W = 0, H = 0, cells = 0, scale = 1;
  let trail, scratch, flow, image, pixels;
  let flowGain = 0.1;     // exposure of the flow layer, auto-adjusted
  const ax = new Float32Array(MAX_AGENTS);
  const ay = new Float32Array(MAX_AGENTS);
  const aa = new Float32Array(MAX_AGENTS);
  let count = 0;          // agents currently simulated (adaptive)
  let capacity = 0;       // agent cap for the current grid size

  const lut = new Uint32Array(1024);

  const pointer = { x: 0, y: 0, px: 0, py: 0, inside: false, down: false, repel: false, right: false,
                    downAt: 0, downX: 0, downY: 0 };
  let brush = 26;         // brush radius in CSS pixels
  let paused = false;
  let autopilot = true;
  let lastInput = -1e9;
  let lastAutoSwitch = 0;
  let hudHidden = false;

  // Seeded PRNG (mulberry32), so a reseed can reproduce a layout if we want.
  let seed = (Math.random() * 2 ** 32) >>> 0;
  function rand() {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ------------------------------------------------------------- palette --
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function buildLut() {
    const stops = PALETTES[paletteIndex].stops.map(hexToRgb);
    const segs = stops.length - 1;
    for (let i = 0; i < lut.length; i++) {
      const t = Math.pow(i / (lut.length - 1), 0.85);
      const f = t * segs, k = Math.min(segs - 1, f | 0), u = f - k;
      // smoothstep inside each segment keeps the ramp free of visible kinks
      const s = u * u * (3 - 2 * u);
      const a = stops[k], b = stops[k + 1];
      const r = a[0] + (b[0] - a[0]) * s;
      const g = a[1] + (b[1] - a[1]) * s;
      const bl = a[2] + (b[2] - a[2]) * s;
      lut[i] = (255 << 24) | (bl << 16) | (g << 8) | r;   // little-endian ABGR
    }
    const bg = stops[0];
    document.body.style.background = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    const light = bg[0] + bg[1] + bg[2] > 384;
    document.body.style.color = light ? '#2a261f' : '#cfd3e0';
    hud.style.background = light ? 'rgba(242,237,227,0.6)' : '';
    for (const el of hud.querySelectorAll('h1, .preset, .keys b')) el.style.color = light ? '#000' : '';
  }

  // --------------------------------------------------------------- resize --
  function resize() {
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    stage.width = Math.round(cssW * dpr);
    stage.height = Math.round(cssH * dpr);

    scale = Math.max(1, Math.sqrt((cssW * cssH) / MAX_CELLS));
    const nW = Math.max(64, Math.round(cssW / scale));
    const nH = Math.max(64, Math.round(cssH / scale));
    const first = !trail;
    const oldW = W, oldH = H;
    W = nW; H = nH; cells = W * H;

    trail = new Float32Array(cells);
    scratch = new Float32Array(cells);
    flow = new Float32Array(cells);
    off.width = W; off.height = H;
    image = offCtx.createImageData(W, H);
    pixels = new Uint32Array(image.data.buffer);

    capacity = Math.min(MAX_AGENTS, Math.floor(cells * 0.8));
    if (first) {
      count = Math.min(capacity, 60000);
      seedAgents('disc');
    } else {
      // Keep the colony when the window changes size: scale positions.
      const sx = W / oldW, sy = H / oldH;
      count = Math.min(count, capacity);
      for (let i = 0; i < count; i++) {
        ax[i] = Math.min(ax[i] * sx, W - 0.01); ay[i] = Math.min(ay[i] * sy, H - 0.01);
      }
    }
  }

  // ------------------------------------------------------------- seeding --
  const LAYOUTS = ['disc', 'ring', 'scatter', 'spiral', 'twin'];
  let layoutIndex = 0;

  function seedAgents(layout) {
    trail.fill(0);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    for (let i = 0; i < count; i++) {
      let x, y, a;
      const r = rand(), th = rand() * TAU;
      switch (layout) {
        case 'ring': {                       // start on a circle, facing inward
          const rr = R * (0.92 + 0.08 * r);
          x = cx + Math.cos(th) * rr; y = cy + Math.sin(th) * rr; a = th + Math.PI;
          break;
        }
        case 'disc': {                       // filled disc, facing outward
          const rr = R * 0.7 * Math.sqrt(r);
          x = cx + Math.cos(th) * rr; y = cy + Math.sin(th) * rr; a = th;
          break;
        }
        case 'spiral': {
          const u = i / count, ang = u * TAU * 5;
          const rr = R * 1.1 * u;
          x = cx + Math.cos(ang) * rr + (rand() - 0.5) * 6;
          y = cy + Math.sin(ang) * rr + (rand() - 0.5) * 6;
          a = ang + Math.PI / 2;
          break;
        }
        case 'twin': {                       // two colonies that will meet
          const side = i & 1 ? 1 : -1, rr = R * 0.35 * Math.sqrt(r);
          x = cx + side * R * 0.75 + Math.cos(th) * rr; y = cy + Math.sin(th) * rr; a = th;
          break;
        }
        default:                             // scatter
          x = rand() * W; y = rand() * H; a = th;
      }
      ax[i] = Math.min(((x % W) + W) % W, W - 0.01);
      ay[i] = Math.min(((y % H) + H) % H, H - 0.01);
      aa[i] = a;
    }
  }

  // A spore burst: move a batch of agents to the pointer as an outward ring.
  function burst(sx, sy) {
    const n = Math.min(count, 9000);
    for (let k = 0; k < n; k++) {
      const i = (rand() * count) | 0;
      const th = rand() * TAU, rr = rand() * 3;
      ax[i] = Math.min((sx + Math.cos(th) * rr + W) % W, W - 0.01);
      ay[i] = Math.min((sy + Math.sin(th) * rr + H) % H, H - 0.01);
      aa[i] = th;
    }
  }

  // ---------------------------------------------------------- simulation --
  function stepAgents() {
    const sa = params.sa * DEG * TRIG_K;           // sensor angle, table units
    const sd = Math.min(params.sd, Math.min(W, H) / 3), ra = params.ra * DEG, sp = params.speed;
    const dep = params.deposit, jit = params.jitter, cap = params.cap;
    const w = W, h = H, t = trail, fl = flow;

    for (let i = 0; i < count; i++) {
      let x = ax[i], y = ay[i], a = aa[i];
      const ai = a * TRIG_K;

      // Sample the three sensors (wrapping at the edges: the world is a torus).
      let j = (ai | 0) & TRIG_MASK;
      let sx = x + COS[j] * sd, sy = y + SIN[j] * sd;
      let ix = sx | 0, iy = sy | 0;
      if (ix < 0) ix += w; else if (ix >= w) ix -= w;
      if (iy < 0) iy += h; else if (iy >= h) iy -= h;
      const F = t[iy * w + ix];

      j = ((ai - sa) | 0) & TRIG_MASK;
      sx = x + COS[j] * sd; sy = y + SIN[j] * sd;
      ix = sx | 0; iy = sy | 0;
      if (ix < 0) ix += w; else if (ix >= w) ix -= w;
      if (iy < 0) iy += h; else if (iy >= h) iy -= h;
      const L = t[iy * w + ix];

      j = ((ai + sa) | 0) & TRIG_MASK;
      sx = x + COS[j] * sd; sy = y + SIN[j] * sd;
      ix = sx | 0; iy = sy | 0;
      if (ix < 0) ix += w; else if (ix >= w) ix -= w;
      if (iy < 0) iy += h; else if (iy >= h) iy -= h;
      const R = t[iy * w + ix];

      // Turn toward the strongest reading.
      if (F > L && F > R) { /* keep heading */ }
      else if (F < L && F < R) a += (rand() < 0.5 ? -ra : ra);
      else if (L > R) a -= ra;
      else if (R > L) a += ra;
      if (jit) a += (rand() - 0.5) * jit;

      // Step forward.
      j = ((a * TRIG_K) | 0) & TRIG_MASK;
      x += COS[j] * sp; y += SIN[j] * sp;
      // A tiny negative plus w can round up to exactly w in float32, which
      // would index past the row, so check the stored precision.
      if (x < 0) { x += w; if (Math.fround(x) >= w) x = 0; } else if (x >= w) x -= w;
      if (y < 0) { y += h; if (Math.fround(y) >= h) y = 0; } else if (y >= h) y -= h;

      ax[i] = x; ay[i] = y;
      // Keep the angle bounded so float precision never degrades.
      aa[i] = a > 1000 || a < -1000 ? a % TAU : a;
      const c = (y | 0) * w + (x | 0), v = t[c];
      fl[c] += 1;
      if (v < cap) t[c] = v + dep > cap ? cap : v + dep;
    }
  }

  // Blur the trail with a separable 3x3 box filter, mix it back in by the
  // diffuse amount, then decay. The edges wrap.
  function diffuseDecay() {
    const w = W, h = H, t = trail, s = scratch;
    const k = params.diffuse, keep = 1 - k, decay = params.decay;
    const third = 1 / 3;

    // horizontal pass -> scratch
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let prev = t[row + w - 1], cur = t[row];
      for (let x = 0; x < w; x++) {
        const next = x + 1 < w ? t[row + x + 1] : t[row];
        s[row + x] = (prev + cur + next) * third;
        prev = cur; cur = next;
      }
    }
    // vertical pass + mix + decay -> trail
    for (let y = 0; y < h; y++) {
      const up = (y === 0 ? h - 1 : y - 1) * w;
      const row = y * w;
      const dn = (y === h - 1 ? 0 : y + 1) * w;
      for (let x = 0; x < w; x++) {
        const blur = (s[up + x] + s[row + x] + s[dn + x]) * third;
        t[row + x] = (t[row + x] * keep + blur * k) * decay;
      }
    }
  }

  // Paint chemical (or repellent) along the pointer's path this frame.
  function applyPointer() {
    if (!pointer.inside) return;
    let strength;
    const cap = params.cap;
    if (pointer.repel) strength = -8 * cap;
    else if (pointer.down) strength = 3 * cap;
    else strength = 0.35 * cap;          // the idle hover lures softly

    const r = Math.max(2, brush / scale);
    const x0 = pointer.px / scale, y0 = pointer.py / scale;
    const x1 = pointer.x / scale, y1 = pointer.y / scale;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    // Hovering only lures while the pointer moves, so a resting cursor does
    // not paint a solid disc.
    if (!pointer.down && !pointer.repel) {
      if (dist < 0.01) return;
      strength *= Math.min(1, dist / r);
    }
    const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
    const r2 = r * r, ir = Math.ceil(r);
    for (let s = 0; s < steps; s++) {
      const u = steps === 1 ? 1 : s / (steps - 1);
      const cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u;
      const cxi = cx | 0, cyi = cy | 0;
      for (let dy = -ir; dy <= ir; dy++) {
        let yy = cyi + dy; if (yy < 0) yy += H; else if (yy >= H) yy -= H;
        for (let dx = -ir; dx <= ir; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          let xx = cxi + dx; if (xx < 0) xx += W; else if (xx >= W) xx -= W;
          const f = 1 - d2 / r2;
          const idx = yy * W + xx;
          if (strength < 0) trail[idx] = Math.min(trail[idx], strength * f);
          else trail[idx] += strength * f * f / steps;
        }
      }
    }
    pointer.px = pointer.x; pointer.py = pointer.y;
  }

  // --------------------------------------------------------------- render --
  // Two layers share one colour ramp: the chemical trail is a soft glow in
  // the lower part of the ramp, and recent agent traffic ("flow") adds the
  // bright, fibrous highlights on top.
  function render() {
    const t = trail, f = flow, p = pixels, n = cells, top = lut.length - 1;
    const tk = (top * params.glow) / params.cap, fk = top * (1 - params.glow) * flowGain;
    const bg = lut[0], hot = lut[top];
    let sum = 0, samples = 0;
    for (let i = 0; i < n; i++) {
      const v = t[i], fv = f[i];
      f[i] = fv * 0.72;
      if (fv > 0.05 && (i & 31) === 0) { sum += fv; samples++; }
      const tv = v <= 0 ? 0 : v >= params.cap ? top * params.glow : v * tk;
      const m = tv + fv * fk;
      p[i] = m <= 0 ? bg : m >= top ? hot : lut[m | 0];
    }
    // Keep a typical vein's traffic at about half brightness, whatever the
    // agent density or behaviour.
    if (samples) flowGain += (0.55 / (sum / samples) - flowGain) * 0.05;
    offCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, stage.width, stage.height);
  }

  // ----------------------------------------------------------------- loop --
  let frameMs = 12;
  let frameCount = 0;

  // Parameters ease toward the target and "breathe": a slow drift in sensor
  // reach and angle keeps the network reorganising instead of freezing.
  const base = {};
  function ease(now) {
    for (const k of PARAM_KEYS) base[k] = (base[k] ?? target[k]) + (target[k] - (base[k] ?? target[k])) * 0.04;
    Object.assign(params, base);
    const s = now * 0.001;
    params.sd = base.sd * (1 + 0.22 * Math.sin(s * 0.21) * Math.sin(s * 0.047 + 1));
    params.sa = base.sa * (1 + 0.15 * Math.sin(s * 0.13 + 2));
  }

  // Each behaviour asks for a population (a fraction of the grid). The machine
  // may not afford it, so a separate performance ceiling grows while frames
  // are cheap and shrinks when they are not.
  let perfCeiling = MAX_AGENTS;
  function adapt() {
    if (frameMs > 16) perfCeiling = Math.max(20000, Math.floor(Math.min(perfCeiling, count) * 0.95));
    else if (frameMs < 10) perfCeiling = Math.min(MAX_AGENTS, perfCeiling + 1500);
    const want = Math.min(perfCeiling, Math.floor(capacity * params.density));
    if (count > want) count = Math.max(want, count - Math.ceil(count * 0.02));
    else if (count < want) {
      const add = Math.min(want - count, 3000);
      // New agents are born at the positions of existing ones.
      for (let k = 0; k < add; k++) {
        const src = (rand() * count) | 0, i = count + k;
        ax[i] = ax[src]; ay[i] = ay[src]; aa[i] = rand() * TAU;
      }
      count += add;
    }
  }

  function autopilotTick(now) {
    hud.classList.toggle('idle', now - lastInput > 6000 && !hudHidden);
    if (!autopilot || now - lastInput < 12000) return;
    if (now - lastAutoSwitch > 22000) {
      lastAutoSwitch = now;
      setPreset((presetIndex + 1) % PRESETS.length, true);
      if (presetIndex % 3 === 0) setPalette((paletteIndex + 1) % (PALETTES.length - 1), true);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!paused) {
      const t0 = performance.now();
      ease(now);
      applyPointer();
      stepAgents();
      diffuseDecay();
      render();
      frameMs += (performance.now() - t0 - frameMs) * 0.1;
      adapt();
    } else {
      pointer.px = pointer.x; pointer.py = pointer.y;
    }
    autopilotTick(now);
    if ((++frameCount & 15) === 0) $('agents').textContent = count.toLocaleString('en-US');
  }

  // ------------------------------------------------------------------- UI --
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  function setPreset(i, quiet) {
    presetIndex = i; target = PRESETS[i];
    $('presetNum').textContent = i + 1;
    $('presetName').textContent = target.name;
    if (!quiet) toast(target.name);
  }
  function setPalette(i, quiet) {
    paletteIndex = i; buildLut();
    if (!quiet) toast(PALETTES[i].name);
  }
  function setAuto(on) {
    autopilot = on;
    $('auto').classList.toggle('on', on);
  }

  function updateBrushEl() {
    const d = brush * 2;
    brushEl.style.width = d + 'px'; brushEl.style.height = d + 'px';
    brushEl.style.left = pointer.x + 'px'; brushEl.style.top = pointer.y + 'px';
    brushEl.style.opacity = pointer.inside ? 1 : 0;
    brushEl.classList.toggle('repel', pointer.repel);
    brushEl.classList.toggle('feed', pointer.down && !pointer.repel);
  }

  function touched() { lastInput = performance.now(); }

  stage.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!pointer.inside) { pointer.px = pointer.x; pointer.py = pointer.y; pointer.inside = true; }
    pointer.repel = e.shiftKey || pointer.right;
    touched(); updateBrushEl();
  });
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointer.x = pointer.px = e.clientX; pointer.y = pointer.py = e.clientY;
    pointer.inside = true; pointer.down = true;
    pointer.right = e.button === 2;
    pointer.repel = e.shiftKey || pointer.right;
    pointer.downAt = performance.now(); pointer.downX = e.clientX; pointer.downY = e.clientY;
    touched(); updateBrushEl();
  });
  stage.addEventListener('pointerup', (e) => {
    const quick = performance.now() - pointer.downAt < 250;
    const still = Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) < 6;
    if (quick && still && !pointer.repel) burst(e.clientX / scale, e.clientY / scale);
    pointer.down = false; pointer.right = false; pointer.repel = e.shiftKey;
    // On touch screens there is no hover, so stop luring once the finger lifts.
    if (e.pointerType !== 'mouse') pointer.inside = false;
    updateBrushEl();
  });
  stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pointer.down) { pointer.inside = false; updateBrushEl(); }
  });
  stage.addEventListener('pointercancel', () => {
    pointer.down = pointer.right = pointer.repel = false; pointer.inside = false; updateBrushEl();
  });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    brush = Math.max(6, Math.min(160, brush * Math.exp(-e.deltaY * 0.0015)));
    touched(); updateBrushEl();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    touched();
    if (k === 'shift') { pointer.repel = true; updateBrushEl(); return; }
    if (k >= '1' && k <= String(PRESETS.length)) { setPreset(+k - 1); return; }
    switch (k) {
      case ' ': paused = !paused; toast(paused ? 'Paused' : 'Running'); e.preventDefault(); break;
      case 'c': setPalette((paletteIndex + (e.shiftKey ? PALETTES.length - 1 : 1)) % PALETTES.length); break;
      case 'r':
        layoutIndex = (layoutIndex + 1) % LAYOUTS.length;
        seedAgents(LAYOUTS[layoutIndex]); toast('Reseed · ' + LAYOUTS[layoutIndex]); break;
      case 'a': setAuto(!autopilot); toast(autopilot ? 'Autopilot on' : 'Autopilot off'); break;
      case 'h': hudHidden = !hudHidden; hud.classList.toggle('hidden', hudHidden); break;
      case 's': save(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') { pointer.repel = pointer.right; updateBrushEl(); }
  });

  function save() {
    const a = document.createElement('a');
    a.download = `mycelium-${PRESETS[presetIndex].name.toLowerCase()}-${Date.now()}.png`;
    a.href = stage.toDataURL('image/png');
    a.click();
    toast('Saved');
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // ------------------------------------------------------------------ go --
  resize();
  buildLut();
  setPreset(0, true);
  setAuto(true);
  requestAnimationFrame(frame);

  // A small hook for automated checks; harmless in normal use.
  window.__mycelium = { get count() { return count; }, get frameMs() { return frameMs; },
                        get healthy() { for (let i = 0; i < cells; i += 97) if (!Number.isFinite(trail[i])) return false; return true; },
                        get preset() { return PRESETS[presetIndex].name; }, setPreset, setPalette, presets: PRESETS,
                        // for parameter sweeps: jump straight to a behaviour and reseed
                        tune(p, layout) { for (const k in p) base[k] = p[k]; target = Object.assign({}, target, p); Object.assign(params, target);
                                          seedAgents(layout || 'scatter'); } };
})();
