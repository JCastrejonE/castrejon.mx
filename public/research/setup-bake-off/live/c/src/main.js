// Page glue: sizing, the frame loop, adaptive quality, input, HUD, sharing.
import {
  createSim, step, addFood, removeFood, clearFood, findFoodNear, paint,
  setAgentCount, resizeSim, networkCells, seedAgents,
} from './sim.js';
import { createRenderer, setPalette, renderField, snapExposure } from './render.js';
import { PALETTES } from './palettes.js';
import { PRESETS, PRESET_KEYS, pointInPolygon } from './presets.js';
import { minimumSpanningTree } from './mst.js';
import { encodeScene, decodeScene } from './share.js';

window.__physarum = true; // tells the file:// fallback that modules loaded

const $ = (id) => document.getElementById(id);
const canvas = $('dish');
const ui = {
  intro: $('intro'), hint: $('hint'), help: $('help'), helpBtn: $('help-btn'),
  toast: $('toast'), status: $('status'), readout: $('readout'), live: $('live'), debug: $('debug'),
  sceneBtn: $('scene-btn'), paletteBtn: $('palette-btn'), pauseBtn: $('pause-btn'),
};
const hintMarkup = ui.hint.innerHTML;

const MAX_FOODS = 24;
const MIN_AGENTS = 20000;
const SIM_BUDGET_MS = 9;           // target per-frame simulation time
const FOOD_HIT_PX = 22;
const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD_PX = 6;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const query = new URLSearchParams(location.search);
const debug = query.has('debug');
// Debug only: fast-forward N steps at boot (used by QA screenshots).
const warp = debug ? Math.min(5000, Math.max(0, Number(query.get('warp')) || 0)) : 0;
const paletteNames = Object.keys(PALETTES);
// Debug only: ?debug&p.decay=0.9 overrides a sim parameter (for tuning).
const paramOverrides = {};
if (debug) for (const [key, v] of query) if (key.startsWith('p.') && Number.isFinite(Number(v))) paramOverrides[key.slice(2)] = Number(v);

const state = {
  sim: null,
  renderer: createRenderer(canvas),
  presetName: 'first',
  paletteName: 'agar',
  paused: false,
  showMst: false,
  cssW: 0, cssH: 0, dpr: 1, sx: 2, sy: 2, // CSS px per grid cell, per axis
  agentCap: 0,
  simMsEma: SIM_BUDGET_MS,
  frames: 0,
  lastInput: performance.now(),
  introDismissed: false,
  idleTipShown: false,
  fading: [],            // removed foods, shrinking out
  cursor: null,          // keyboard crosshair in CSS px
  pregrow: 0,            // reduced motion: steps left to grow before first paint
  fps: 60, lastFrame: performance.now(), renderMsEma: 0,
  pregrowPauses: false,
  hudFrames: 0,          // counts every frame, paused or not
  tipShowing: false,
};

// ---------- sizing ----------

function gridFor(cssW, cssH, species) {
  const maxCells = species > 1 ? 190000 : 340000;
  const scale = Math.max(1.5, Math.sqrt((cssW * cssH) / maxCells));
  return { W: Math.max(48, Math.round(cssW / scale)), H: Math.max(48, Math.round(cssH / scale)) };
}

// The field is stretched to fill the canvas, so each axis has its own scale.
function syncScale() {
  state.sx = state.cssW / state.sim.width;
  state.sy = state.cssH / state.sim.height;
}

function measure() {
  state.cssW = Math.max(1, window.innerWidth);
  state.cssH = Math.max(1, window.innerHeight);
  state.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(state.cssW * state.dpr);
  canvas.height = Math.round(state.cssH * state.dpr);
}

// Agent density shapes the look: ~0.45 agents per cell gives crisp tubes.
const DENSITY = debug && Number(query.get('density')) > 0 ? Number(query.get('density')) : null;
function densityCap(sim) {
  const d = DENSITY || PRESETS[state.presetName].density || (sim.species > 1 ? 0.55 : 0.45);
  return Math.round(sim.width * sim.height * d);
}

// ---------- scenes ----------

const toGrid = (u, v) => ({ x: u * state.sim.width, y: v * state.sim.height });
const toNorm = (f) => ({ u: f.x / state.sim.width, v: f.y / state.sim.height });
const gridToCss = (x, y) => ({ x: x * state.sx, y: y * state.sy });
const cssToGrid = (x, y) => ({ x: x / state.sx, y: y / state.sy });

function loadPreset(name, { foods: foodOverride = null, announce = true } = {}) {
  const preset = PRESETS[name];
  state.presetName = name;
  const { W, H } = gridFor(state.cssW, state.cssH, preset.species);
  const seed = (Math.random() * 2 ** 31) | 0;
  const sim = createSim({ width: W, height: H, species: preset.species, seed, params: { ...(preset.params || {}), ...paramOverrides }, agentCount: 0 });
  state.sim = sim;
  syncScale();
  const aspect = state.cssW / state.cssH;
  if (preset.walls) paintPolygons(sim, preset.walls(aspect));
  const foods = foodOverride || preset.foods(aspect, sim.rand);
  for (const f of foods.slice(0, MAX_FOODS)) {
    const g = toGrid(f.u, f.v);
    addFood(sim, g.x, g.y);
  }
  state.agentCap = densityCap(sim);
  const start = Math.min(state.agentCap, Math.max(MIN_AGENTS, state.agentCap * (state.simMsEma > SIM_BUDGET_MS ? 0.6 : 1)));
  seedAgents(sim, start, preset.layout);
  state.fading = [];
  state.renderer.exposure = 8;
  state.pregrowPauses = reducedMotion.matches;
  state.pregrow = reducedMotion.matches ? 450 : 0;
  if (state.pregrow) setPaused(false, { quiet: true });
  syncHash();
  if (announce) {
    toast(preset.label);
    say(`${preset.label}. ${preset.caption || ''}`);
  }
  ui.readout.hidden = !state.showMst;
}

function paintPolygons(sim, polys) {
  const W = sim.width, H = sim.height;
  for (const poly of polys) {
    const pts = poly.map((p) => [p.u * W, p.v * H]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (pointInPolygon(x + 0.5, y + 0.5, pts)) sim.walls[y * W + x] = 1;
      }
    }
  }
  sim.wallsActive = true;
}

let lastHash = '';
function syncHash() {
  const hash = encodeScene({ preset: state.presetName, palette: state.paletteName, foods: state.sim.foods.map(toNorm) });
  lastHash = hash;
  try {
    history.replaceState(null, '', hash);
  } catch {
    // Some sandboxed frames forbid history writes; sharing just won't update.
  }
}

// ---------- food ----------

function toggleFoodAt(cssX, cssY) {
  const sim = state.sim;
  const g = cssToGrid(cssX, cssY);
  const hit = findFoodNear(sim, g.x, g.y, FOOD_HIT_PX / Math.min(state.sx, state.sy));
  if (hit) {
    removeFood(sim, hit.id);
    state.fading.push({ x: hit.x, y: hit.y, t0: performance.now() });
    say(`Food removed. ${sim.foods.length} left.`);
  } else {
    if (sim.foods.length >= MAX_FOODS) {
      const oldest = sim.foods[0];
      removeFood(sim, oldest.id);
      state.fading.push({ x: oldest.x, y: oldest.y, t0: performance.now() });
    }
    addFood(sim, g.x, g.y);
    say(`Food dropped. ${sim.foods.length} sources.`);
  }
  syncHash();
}

// ---------- HUD ----------

let toastTimer = 0;
function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1500);
}

function say(text) {
  ui.live.textContent = '';
  // A fresh text node each time so repeated messages are still announced.
  requestAnimationFrame(() => { ui.live.textContent = text; });
}

function applyPaletteVars() {
  const p = PALETTES[state.paletteName];
  const root = document.documentElement.style;
  root.setProperty('--bg', p.ramp[0]);
  root.setProperty('--ink', p.ink);
  root.setProperty('--ink-dim', p.inkDim);
  root.setProperty('--accent', p.accent);
  document.documentElement.classList.toggle('light', p.light);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', p.ramp[0]);
  setPalette(state.renderer, p);
}

function setPaused(paused, { quiet = false } = {}) {
  state.paused = paused;
  ui.status.textContent = paused ? (reducedMotion.matches ? 'Motion reduced. Press run (or space) to start.' : 'Paused') : '';
  ui.status.classList.toggle('show', paused);
  ui.pauseBtn.textContent = paused ? 'run' : 'pause';
  ui.pauseBtn.setAttribute('aria-pressed', String(paused));
  if (!quiet) say(paused ? 'Paused' : 'Running');
}

function setHelp(open) {
  ui.help.hidden = !open;
  ui.helpBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    dismissIntro();
    ui.help.focus({ preventScroll: true });
  }
}

function dismissIntro() {
  if (state.introDismissed) return;
  state.introDismissed = true;
  ui.intro.classList.add('gone');
  // Hide it from screen readers once the fade is done.
  setTimeout(() => { ui.intro.hidden = true; }, 250);
}

function noteInput() {
  state.lastInput = performance.now();
  if (state.tipShowing) {
    state.tipShowing = false;
    ui.hint.innerHTML = hintMarkup;
  }
  ui.hint.classList.add('show');
}

function updateHint(now) {
  const idle = now - state.lastInput;
  if (!state.idleTipShown && idle > 12000 && state.sim.foods.length > 1) {
    state.idleTipShown = true;
    state.tipShowing = true;
    ui.hint.textContent = 'Try removing a node. Watch its tube wither.';
    ui.hint.classList.add('show');
    state.lastInput = now; // keep the tip up for its own 6s
    return;
  }
  if (idle > 6000) ui.hint.classList.remove('show');
}

function updateAria() {
  const n = state.sim.foods.length;
  const label = n === 0
    ? 'Slime mold simulation, exploring with no food.'
    : `Slime mold simulation: a network growing between ${n} food source${n === 1 ? '' : 's'}.`;
  canvas.setAttribute('aria-label', label);
}

function updateReadout() {
  if (!state.showMst) return;
  const sim = state.sim;
  const pts = sim.foods.map((f) => gridToCss(f.x, f.y));
  const { length } = minimumSpanningTree(pts);
  // Tube area / nominal tube width (~3 cells) approximates total tube length.
  const tubePx = (networkCells(sim, 6) / 3) * Math.sqrt(state.sx * state.sy);
  const ratio = length > 0 ? tubePx / length : 0;
  ui.readout.textContent = sim.foods.length > 1
    ? `dashed: shortest possible tree, ${Math.round(length)} px · organism ≈ ${Math.round(tubePx)} px (${ratio.toFixed(1)}×)`
    : 'drop two or more foods to compare with the shortest tree';
}

// ---------- drawing overlays ----------

function drawOverlay(now) {
  const { ctx } = state.renderer;
  const sim = state.sim;
  const p = PALETTES[state.paletteName];
  ctx.save();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  if (state.showMst && sim.foods.length > 1) {
    const pts = sim.foods.map((f) => gridToCss(f.x, f.y));
    const { edges } = minimumSpanningTree(pts);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (const [a, b] of edges) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Food: a thin ring that breathes on a 2.4s cycle (still under reduced motion).
  const breathe = reducedMotion.matches ? 1 : 1 + 0.08 * Math.sin((now / 2400) * Math.PI * 2);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  for (const f of sim.foods) {
    const c = gridToCss(f.x, f.y);
    ring(ctx, c.x, c.y, 6 * breathe, p);
  }
  state.fading = state.fading.filter((f) => now - f.t0 < 600);
  for (const f of state.fading) {
    const t = (now - f.t0) / 600;
    const c = gridToCss(f.x, f.y);
    ctx.globalAlpha = 1 - t;
    ring(ctx, c.x, c.y, 6 * (1 - t), p);
  }
  ctx.globalAlpha = 1;

  if (state.cursor) {
    const { x, y } = state.cursor;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y); ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 10);
    ctx.stroke();
  }
  ctx.restore();
}

function ring(ctx, x, y, r, p) {
  if (r <= 0.2) return;
  // A dark halo keeps the ring legible on top of white-hot tubes.
  ctx.strokeStyle = p.ramp[0];
  ctx.globalCompositeOperation = 'source-over';
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.55;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---------- frame loop ----------

function adapt() {
  const sim = state.sim;
  if (state.frames % 20 !== 0) return;
  const ema = state.simMsEma;
  const floor = Math.min(MIN_AGENTS, state.agentCap);
  if (ema > SIM_BUDGET_MS * 1.15 && sim.count > floor) {
    setAgentCount(sim, Math.max(floor, sim.count * 0.88));
  } else if (ema < SIM_BUDGET_MS * 0.7 && sim.count < state.agentCap) {
    setAgentCount(sim, Math.min(state.agentCap, sim.count * 1.06 + 500));
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const sim = state.sim;
  const dt = now - state.lastFrame;
  state.lastFrame = now;
  if (dt > 0 && dt < 250) state.fps += (1000 / dt - state.fps) * 0.05;

  if (state.pregrow > 0) {
    // Reduced motion: grow the network off-screen, then show one still frame.
    const t0 = performance.now();
    while (state.pregrow > 0 && performance.now() - t0 < 14) {
      step(sim);
      state.pregrow--;
    }
    if (state.pregrow > 0) {
      const { ctx } = state.renderer;
      ctx.fillStyle = PALETTES[state.paletteName].ramp[0];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    snapExposure(state.renderer, sim);
    if (state.pregrowPauses) setPaused(true);
  } else if (!state.paused) {
    const t0 = performance.now();
    step(sim);
    let ms = performance.now() - t0;
    // Spare budget: take a second step so growth keeps pace on fast machines.
    if (ms < SIM_BUDGET_MS * 0.45) {
      step(sim);
      ms = (performance.now() - t0) / 2;
    }
    state.simMsEma += (ms - state.simMsEma) * 0.1;
    state.frames++;
    adapt();
  }

  const r0 = performance.now();
  renderField(state.renderer, sim, { freezeExposure: state.paused });
  drawOverlay(now);
  state.renderMsEma += (performance.now() - r0 - state.renderMsEma) * 0.1;

  if (state.hudFrames++ % 60 === 0) {
    updateAria();
    updateReadout();
  }
  updateHint(now);
  if (debug) {
    ui.debug.textContent = `${Math.round(state.fps)} fps · ${sim.count.toLocaleString()} agents · ${sim.width}×${sim.height} grid · sim ${state.simMsEma.toFixed(1)} ms · draw ${state.renderMsEma.toFixed(1)} ms · step ${sim.steps}`;
  }
}

// ---------- input ----------

let pointer = null; // the one pointer we track

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  noteInput();
  dismissIntro();
  if (pointer) return; // ignore extra fingers
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
  canvas.setPointerCapture(e.pointerId);
  pointer = {
    id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
    moved: false, mode: e.button === 2 || e.shiftKey ? 'wall' : null, timer: 0,
  };
  if (e.pointerType !== 'mouse') {
    pointer.timer = setTimeout(() => {
      if (pointer && !pointer.moved) {
        pointer.mode = 'wall';
        toast('Wall');
        if (navigator.vibrate) navigator.vibrate(12);
      }
    }, LONG_PRESS_MS);
  }
  if (pointer.mode === 'wall') brush(e.clientX, e.clientY, e.clientX, e.clientY);
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  noteInput();
  const dist = Math.hypot(e.clientX - pointer.x0, e.clientY - pointer.y0);
  if (!pointer.moved && dist > DRAG_THRESHOLD_PX) {
    pointer.moved = true;
    if (!pointer.mode) pointer.mode = 'lure';
  }
  if (pointer.moved || pointer.mode === 'wall') brush(pointer.x, pointer.y, e.clientX, e.clientY);
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

function endPointer(e, cancelled) {
  if (!pointer || e.pointerId !== pointer.id) return;
  clearTimeout(pointer.timer);
  if (!cancelled && !pointer.moved && pointer.mode !== 'wall') toggleFoodAt(e.clientX, e.clientY);
  pointer = null;
}
canvas.addEventListener('pointerup', (e) => endPointer(e, false));
canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
canvas.addEventListener('lostpointercapture', (e) => endPointer(e, true));

// Paint along the segment so fast drags leave a continuous stroke.
function brush(x0, y0, x1, y1) {
  const sim = state.sim;
  const a = cssToGrid(x0, y0), b = cssToGrid(x1, y1);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(len / 1.5));
  const wall = pointer && pointer.mode === 'wall';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (wall) paint(sim, x, y, 4, 1, 'wall');
    else paint(sim, x, y, 3, 25, 'lure');
  }
}

function moveCursor(dx, dy) {
  if (!state.cursor) state.cursor = { x: state.cssW / 2, y: state.cssH / 2 };
  state.cursor.x = Math.min(state.cssW - 4, Math.max(4, state.cursor.x + dx));
  state.cursor.y = Math.min(state.cssH - 4, Math.max(4, state.cursor.y + dy));
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.repeat && !e.key.startsWith('Arrow')) return;
  const tag = document.activeElement && document.activeElement.tagName;
  const onButton = tag === 'BUTTON';
  const k = e.key;
  let handled = true;
  const big = e.shiftKey ? 64 : 16;
  if (k === ' ' && !onButton) setPaused(!state.paused);
  else if (k >= '1' && k <= '5') loadPreset(PRESET_KEYS[Number(k) - 1]);
  else if (k === 'p' || k === 'P') nextPalette(); else if (k === 'c' || k === 'C') {
    for (const f of state.sim.foods) state.fading.push({ x: f.x, y: f.y, t0: performance.now() });
    clearFood(state.sim);
    syncHash();
    toast('Food cleared');
    say('All food removed.');
  } else if (k === 'r' || k === 'R') loadPreset(state.presetName);
  else if (k === 's' || k === 'S') save();
  else if (k === 'm' || k === 'M') {
    state.showMst = !state.showMst;
    ui.readout.hidden = !state.showMst;
    updateReadout();
    say(state.showMst ? 'Showing the shortest possible tree between foods.' : 'Tree hidden.');
  } else if (k === 'h' || k === 'H' || k === '?') setHelp(ui.help.hidden);
  else if (k === 'Escape') setHelp(false);
  else if (k === 'ArrowLeft') moveCursor(-big, 0);
  else if (k === 'ArrowRight') moveCursor(big, 0);
  else if (k === 'ArrowUp') moveCursor(0, -big);
  else if (k === 'ArrowDown') moveCursor(0, big);
  else if (k === 'Enter' && !onButton) {
    if (!state.cursor) moveCursor(0, 0);
    toggleFoodAt(state.cursor.x, state.cursor.y);
  } else handled = false;
  if (handled) {
    e.preventDefault();
    noteInput();
    if (k !== 'h' && k !== 'H' && k !== '?') dismissIntro();
  }
});

function nextPalette() {
  state.paletteName = paletteNames[(paletteNames.indexOf(state.paletteName) + 1) % paletteNames.length];
  applyPaletteVars();
  toast(PALETTES[state.paletteName].label);
  say(`Palette: ${PALETTES[state.paletteName].label}`);
  syncHash();
}

function nextScene() {
  const i = PRESET_KEYS.indexOf(state.presetName);
  loadPreset(PRESET_KEYS[(i + 1) % PRESET_KEYS.length]);
}

// On-screen controls, for touch (no keyboard). A mouse click shouldn't leave
// focus on the button, or space/enter would press it again.
function control(button, action) {
  button.addEventListener('click', (e) => {
    action();
    noteInput();
    dismissIntro();
    if (e.detail > 0) button.blur();
  });
}
control(ui.helpBtn, () => setHelp(ui.help.hidden));
control(ui.sceneBtn, nextScene);
control(ui.paletteBtn, nextPalette);
control(ui.pauseBtn, () => setPaused(!state.paused));

// ---------- save ----------

function save() {
  // Re-render without overlays; toBlob snapshots the bitmap synchronously.
  renderField(state.renderer, state.sim);
  const name = `physarum-${state.paletteName}.png`;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Saved ${name}`);
    say(`Saved ${name}`);
  }, 'image/png');
}

// ---------- resize / visibility ----------

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    measure();
    const sim = state.sim;
    const { W, H } = gridFor(state.cssW, state.cssH, sim.species);
    resizeSim(sim, W, H);
    syncScale();
    state.agentCap = densityCap(sim);
    if (sim.count > state.agentCap) setAgentCount(sim, state.agentCap);
    state.cursor = null;
  }, 150);
});

document.addEventListener('visibilitychange', () => {
  // Timing right after a tab comes back is noise; don't let it shrink the population.
  if (!document.hidden) state.simMsEma = Math.min(state.simMsEma, SIM_BUDGET_MS);
});

reducedMotion.addEventListener?.('change', () => {
  if (reducedMotion.matches) setPaused(true);
});

// Pasting a different scene link into the same tab.
window.addEventListener('hashchange', () => {
  if (location.hash === lastHash) return;
  loadScene(location.hash, { announce: true });
});

// ---------- boot ----------

function loadScene(hash, { announce }) {
  const scene = decodeScene(hash, { presets: Object.keys(PRESETS), palettes: paletteNames });
  if (scene.palette) state.paletteName = scene.palette;
  applyPaletteVars();
  loadPreset(scene.preset || 'first', { foods: scene.foods, announce });
}

function boot() {
  measure();
  loadScene(location.hash, { announce: false });
  if (debug) {
    ui.debug.hidden = false;
    window.__physarumState = state; // for the browser QA suite
  }
  if (warp) state.pregrow = warp;
  ui.hint.classList.add('show');
  updateAria();
  requestAnimationFrame(frame);
}

boot();
