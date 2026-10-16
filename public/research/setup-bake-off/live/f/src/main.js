// Mycelia — wiring: sizing, loop, adaptive quality, input, panel, keys.

import { Sim, PRESETS } from './sim.js';
import { Renderer, PALETTES } from './render.js';

const SIM_SCALE = 0.5;          // sim cells per CSS px
const MAX_CELLS = 450_000;
const MAX_DPR = 2;
const TICK_MS = 1000 / 60;      // sim runs at ~60 ticks/s regardless of refresh rate
const MAX_STEPS_PER_FRAME = 2;
const SLOW_FRAME_MS = 22;
const MIN_AGENTS = 20_000;
const CLICK_MS = 250;
const CLICK_PX = 6;
const HINT_MS = 6000;
const REF_CELLS = 640 * 400;    // presets' agent counts are tuned for this grid

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const panel = $('panel');
const readout = $('readout');
const hint = $('hint');
const toast = $('toast');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  paused: false,
  palette: 0,
  preset: 0,
  mirror: false,
  fps: 0,
  frameMs: 16.7,
  uiHidden: false,
  reducedMotion,
  agentCap: Infinity,   // lowered by adaptive quality, raised by the user
  stepsLastFrame: 0,
  glow: true,
  maxDpr: MAX_DPR,      // lowered to 1 by adaptive quality before agents are cut
  brush: 'feed',        // 'feed' | 'scatter' (touch has no shift / right button)
};

// ---------------------------------------------------------------- sizing

function simSize() {
  const cw = Math.max(1, window.innerWidth), ch = Math.max(1, window.innerHeight);
  let s = SIM_SCALE;
  if (cw * ch * s * s > MAX_CELLS) s = Math.sqrt(MAX_CELLS / (cw * ch));
  return [Math.max(32, Math.round(cw * s)), Math.max(32, Math.round(ch * s))];
}

function sizeCanvas() {
  const dpr = Math.min(state.maxDpr, window.devicePixelRatio || 1);
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

// ---------------------------------------------------------------- setup

// Keep agent density roughly constant across screen sizes.
function presetParams(i, cells = sim.width * sim.height) {
  const p = { ...PRESETS[i].params };
  const density = Math.min(1.5, Math.max(0.25, cells / REF_CELLS));
  p.agents = Math.max(MIN_AGENTS, Math.round((p.agents * density) / 1000) * 1000);
  if (p.agents > state.agentCap) p.agents = Math.max(MIN_AGENTS, state.agentCap);
  if (reducedMotion) p.stepSize *= 0.5;
  return p;
}

sizeCanvas();
const [sw, sh] = simSize();
const sim = new Sim(sw, sh, presetParams(0, sw * sh));
const renderer = new Renderer(canvas);

sim.reset(PRESETS[0].pattern || 'disc');
for (let i = 0; i < 30; i++) sim.step();

window.__mycelia = { sim, renderer, state };

// ---------------------------------------------------------------- panel

const SLIDERS = [
  { key: 'species', label: 'Species', min: 1, max: 3, step: 1, on: 'change', fmt: (v) => v },
  { key: 'agents', label: 'Agents', min: MIN_AGENTS, max: 300_000, step: 5000, on: 'change', fmt: (v) => (v / 1000).toFixed(0) + 'k' },
  { key: 'sensorAngle', label: 'Sensor angle', min: 0.05, max: 1.6, step: 0.01, fmt: (v) => Math.round((v * 180) / Math.PI) + '°' },
  { key: 'sensorDist', label: 'Sensor distance', min: 2, max: 40, step: 0.5, fmt: (v) => (+v).toFixed(1) },
  { key: 'turnSpeed', label: 'Turn speed', min: 0.02, max: 1.4, step: 0.01, fmt: (v) => Math.round((v * 180) / Math.PI) + '°' },
  { key: 'decay', label: 'Decay', min: 0.8, max: 0.995, step: 0.001, fmt: (v) => (+v).toFixed(3) },
  { key: 'stepSize', label: 'Speed', min: 0.2, max: 3, step: 0.05, fmt: (v) => (+v).toFixed(2) },
  { key: 'repulsion', label: 'Rivalry', min: 0, max: 2, step: 0.05, fmt: (v) => (+v).toFixed(2) },
];

const sliderEls = {};
const presetSel = $('preset');
const paletteSel = $('palette');

PRESETS.forEach((p, i) => presetSel.add(new Option(`${i + 1}  ${p.name}`, i)));
PALETTES.forEach((p, i) => paletteSel.add(new Option(p.name, i)));

function fillPct(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--pct', pct + '%');
}

for (const s of SLIDERS) {
  const wrap = document.createElement('label');
  wrap.className = 'slider';
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  lbl.textContent = s.label;
  const out = document.createElement('output');
  const input = document.createElement('input');
  Object.assign(input, { type: 'range', min: s.min, max: s.max, step: s.step });
  input.dataset.key = s.key;
  wrap.append(lbl, out, input);
  $('sliders').append(wrap);
  sliderEls[s.key] = { input, out, spec: s };

  input.addEventListener('input', () => {
    out.textContent = s.fmt(+input.value);
    fillPct(input);
    if (s.on !== 'change') sim.setParams({ [s.key]: +input.value });
  });
  input.addEventListener('change', () => {
    const v = +input.value;
    if (s.key === 'agents') state.agentCap = v;
    sim.setParams({ [s.key]: v });
    syncPanel();
  });
}

function syncPanel() {
  for (const k in sliderEls) {
    const { input, out, spec } = sliderEls[k];
    const v = k === 'agents' ? sim.agentCount : sim.params[k];
    input.value = v;
    out.textContent = spec.fmt(v);
    fillPct(input);
  }
  presetSel.value = state.preset;
  paletteSel.value = state.palette;
  $('btn-pause').textContent = state.paused ? 'Play' : 'Pause';
  $('btn-pause').setAttribute('aria-pressed', state.paused);
  $('btn-mirror').setAttribute('aria-pressed', state.mirror);
  $('brush-feed').setAttribute('aria-pressed', state.brush === 'feed');
  $('brush-scatter').setAttribute('aria-pressed', state.brush === 'scatter');
}

function setCollapsed(c) {
  panel.classList.toggle('collapsed', c);
  $('panel-toggle').setAttribute('aria-expanded', String(!c));
}
setCollapsed(window.innerWidth < 700);
$('panel-toggle').addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));

presetSel.addEventListener('change', () => applyPreset(+presetSel.value));
paletteSel.addEventListener('change', () => setPalette(+paletteSel.value));
$('btn-reseed').addEventListener('click', () => reseed());
$('btn-pause').addEventListener('click', () => togglePause());
$('btn-mirror').addEventListener('click', () => toggleMirror());
$('btn-save').addEventListener('click', () => savePNG());
$('brush-feed').addEventListener('click', () => setBrush('feed'));
$('brush-scatter').addEventListener('click', () => setBrush('scatter'));

if (reducedMotion) $('motion-note').hidden = false;

// ---------------------------------------------------------------- actions

let toastTimer = 0;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
}

function applyPreset(i) {
  state.preset = ((i % PRESETS.length) + PRESETS.length) % PRESETS.length;
  const p = PRESETS[state.preset];
  sim.setParams(presetParams(state.preset));
  sim.reset(p.pattern || 'disc');
  for (let k = 0; k < 8; k++) sim.step();
  syncPanel();
  say(p.name);
}

function reseed() {
  const patterns = ['disc', 'ring', 'spiral', 'clusters', 'random'];
  const preferred = PRESETS[state.preset].pattern;
  // First reseed repeats the preset's own pattern; later ones wander.
  const pat = reseed.count++ === 0 && preferred ? preferred : patterns[(Math.random() * patterns.length) | 0];
  sim.reset(pat);
  say('Reseed · ' + pat);
}
reseed.count = 0;

function setPalette(i) {
  renderer.setPalette(i);
  state.palette = renderer.paletteIndex;
  const light = PALETTES[state.palette].mode === 'ink';
  document.body.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]').content =
    '#' + PALETTES[state.palette].bg.map((c) => c.toString(16).padStart(2, '0')).join('');
  syncPanel();
}

function togglePause() {
  state.paused = !state.paused;
  syncPanel();
  say(state.paused ? 'Paused' : 'Playing');
}

function toggleMirror() {
  state.mirror = !state.mirror;
  syncPanel();
  say(state.mirror ? 'Mirror on · 6-fold' : 'Mirror off');
}

function setBrush(b) {
  state.brush = b;
  syncPanel();
}

function toggleUI() {
  state.uiHidden = !state.uiHidden;
  document.body.classList.toggle('ui-hidden', state.uiHidden);
}

function savePNG() {
  const a = document.createElement('a');
  const d = new Date();
  const stamp = d.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = renderer.toPNG();
  a.download = `mycelia-${stamp}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  say('Saved PNG');
}

// ---------------------------------------------------------------- hint

let hintGone = false;
function dismissHint() {
  if (hintGone) return;
  hintGone = true;
  hint.classList.add('gone');
  setTimeout(() => (hint.hidden = true), 1400);
}
setTimeout(dismissHint, HINT_MS);

// ---------------------------------------------------------------- pointer

// Each input point is fanned out to 6 rotations about the centre in mirror mode.
function forEachMirror(x, y, fn) {
  if (!state.mirror) return fn(x, y);
  const cx = sim.width / 2, cy = sim.height / 2, dx = x - cx, dy = y - cy;
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a);
    fn(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
}

function brushRadius() {
  return Math.max(3, Math.min(sim.width, sim.height) * 0.022);
}

function toGrid(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * sim.width, ((e.clientY - r.top) / r.height) * sim.height];
}

const ptr = {
  down: false, id: -1, repel: false, dragging: false,
  startX: 0, startY: 0, startT: 0,  // client px
  gx: 0, gy: 0,                     // latest grid pos
  lx: 0, ly: 0,                     // last applied grid pos
  hover: false, hx: 0, hy: 0,
};

function applyBrushAt(x, y) {
  const r = brushRadius();
  if (ptr.repel) forEachMirror(x, y, (px, py) => sim.repel(px, py, r * 1.6, 0.6));
  else forEachMirror(x, y, (px, py) => sim.addFood(px, py, r, 1.2));
}

// Paint along the segment since the last application so fast strokes stay continuous.
function applyStroke() {
  const dx = ptr.gx - ptr.lx, dy = ptr.gy - ptr.ly;
  const spacing = brushRadius() * 0.5;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / spacing));
  for (let i = 1; i <= n; i++) applyBrushAt(ptr.lx + (dx * i) / n, ptr.ly + (dy * i) / n);
  ptr.lx = ptr.gx;
  ptr.ly = ptr.gy;
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  if (ptr.down) return;
  dismissHint();
  canvas.setPointerCapture(e.pointerId);
  const [gx, gy] = toGrid(e);
  Object.assign(ptr, {
    down: true, id: e.pointerId, repel: state.brush === 'scatter' || e.shiftKey || e.button === 2, dragging: false,
    startX: e.clientX, startY: e.clientY, startT: performance.now(),
    gx, gy, lx: gx, ly: gy,
  });
  e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
  ptr.hover = e.pointerType === 'mouse';
  [ptr.hx, ptr.hy] = toGrid(e);
  if (!ptr.down || e.pointerId !== ptr.id) return;
  [ptr.gx, ptr.gy] = [ptr.hx, ptr.hy];
  if (!ptr.dragging && Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY) > CLICK_PX) {
    ptr.dragging = true;
    applyBrushAt(ptr.lx, ptr.ly);
  }
  if (ptr.dragging) applyStroke();
});

function endPointer(e, cancelled) {
  if (!ptr.down || e.pointerId !== ptr.id) return;
  const quick = performance.now() - ptr.startT < CLICK_MS;
  if (!cancelled && !ptr.dragging && quick) {
    const [gx, gy] = toGrid(e);
    const n = Math.round(Math.min(6000, sim.agentCount * 0.03) / (state.mirror ? 3 : 1));
    forEachMirror(gx, gy, (px, py) => sim.burst(px, py, n));
  }
  ptr.down = false;
  ptr.dragging = false;
}
canvas.addEventListener('pointerup', (e) => endPointer(e, false));
canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
canvas.addEventListener('pointerleave', () => (ptr.hover = false));

// Holding still still feeds: once the click window has passed, treat as a drag.
function pointerTick(now) {
  if (!ptr.down) return;
  if (!ptr.dragging && now - ptr.startT >= CLICK_MS) ptr.dragging = true;
  if (ptr.dragging) {
    if (ptr.gx === ptr.lx && ptr.gy === ptr.ly) applyBrushAt(ptr.gx, ptr.gy);
    else applyStroke();
  }
}

function drawCursor() {
  if (!(ptr.hover || ptr.down) || state.uiHidden) return;
  const ctx = renderer.ctx;
  const sx = canvas.width / sim.width, sy = canvas.height / sim.height;
  const r = brushRadius() * (ptr.repel && ptr.down ? 1.6 : 1) * sx;
  const x = (ptr.down ? ptr.gx : ptr.hx) * sx, y = (ptr.down ? ptr.gy : ptr.hy) * sy;
  const light = PALETTES[state.palette].mode === 'ink';
  ctx.save();
  ctx.lineWidth = Math.max(1, sx * 0.6);
  ctx.strokeStyle = light ? 'rgba(30,30,40,0.35)' : 'rgba(255,255,255,0.28)';
  if (ptr.down && ptr.repel) ctx.setLineDash([4 * sx, 4 * sx]);
  forEachMirror(x / sx, y / sy, (px, py) => {
    ctx.beginPath();
    ctx.arc(px * sx, py * sy, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

// ---------------------------------------------------------------- keys

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range'))) return;
  const k = e.key;
  let handled = true;
  if (k === ' ' || e.code === 'Space') togglePause();
  else if (k === 'r' || k === 'R') reseed();
  else if (k >= '1' && k <= '9' && +k <= PRESETS.length) applyPreset(+k - 1);
  else if (k === 'p' || k === 'P') setPalette(state.palette + 1);
  else if (k === 'h' || k === 'H') toggleUI();
  else if (k === 's' || k === 'S') savePNG();
  else if (k === 'm' || k === 'M') toggleMirror();
  else handled = false;
  if (handled) {
    e.preventDefault();
    dismissHint();
    if (t && t.blur && t !== document.body) t.blur();
  }
});

// ---------------------------------------------------------------- resize

let resizeTimer = 0;
window.addEventListener('resize', () => {
  sizeCanvas();            // immediate so the canvas never looks stretched
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const [w, h] = simSize();
    sim.resize(w, h);
  }, 180);
});

// ---------------------------------------------------------------- loop

let last = performance.now();
let acc = 0;
let fpsFrames = 0, fpsT = last;
let slowSince = 0;
let adaptCooldownUntil = last + 2500;  // let the first frames settle

function adapt(now) {
  if (state.paused || now < adaptCooldownUntil || document.hidden) return;
  if (state.frameMs > SLOW_FRAME_MS) {
    if (!slowSince) slowSince = now;
    // Shed the glow pass first (cheap to lose), then agents.
    if (now - slowSince > 800 && renderer.glowEnabled) {
      renderer.glowEnabled = false;
      state.glow = false;
      slowSince = 0;
      adaptCooldownUntil = now + 1500;
    } else if (now - slowSince > 800 && state.maxDpr > 1 && (window.devicePixelRatio || 1) > 1) {
      state.maxDpr = 1;
      sizeCanvas();
      slowSince = 0;
      adaptCooldownUntil = now + 1500;
    } else if (now - slowSince > 800 && sim.agentCount > MIN_AGENTS) {
      const n = Math.max(MIN_AGENTS, Math.round((sim.agentCount * 0.85) / 1000) * 1000);
      sim.setParams({ agents: n });
      state.agentCap = n;
      syncPanel();
      slowSince = 0;
      adaptCooldownUntil = now + 1500;
    }
  } else slowSince = 0;
}

function frame(now) {
  const dt = now - last;
  last = now;
  if (dt < 250) state.frameMs += (dt - state.frameMs) * 0.08;

  pointerTick(now);

  let steps = 0;
  if (!state.paused) {
    acc = Math.min(acc + dt, TICK_MS * MAX_STEPS_PER_FRAME);
    while (acc >= TICK_MS * 0.9 && steps < MAX_STEPS_PER_FRAME) {
      sim.step();
      acc -= TICK_MS;
      steps++;
    }
    if (acc < 0) acc = 0;
  }
  state.stepsLastFrame = steps;

  renderer.draw(sim);
  drawCursor();

  fpsFrames++;
  if (now - fpsT >= 500) {
    state.fps = Math.round((fpsFrames * 1000) / (now - fpsT));
    fpsFrames = 0;
    fpsT = now;
    const agents = sim.agentCount >= 1000 ? Math.round(sim.agentCount / 1000) + 'k' : sim.agentCount;
    readout.textContent = `${state.fps} fps · ${agents} agents · ${sim.width}×${sim.height}${state.paused ? ' · paused' : ''}${state.mirror ? ' · mirror' : ''}`;
  }

  adapt(now);
  requestAnimationFrame(frame);
}

syncPanel();
setPalette(0);
requestAnimationFrame(frame);
