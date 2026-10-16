import { createSim, step, setPreset, reseed, resizeSim } from './core/sim.js';
import { paint } from './core/field.js';
import { burst } from './core/agents.js';
import { PRESETS } from './core/presets.js';
import { createRenderer } from './render.js';
import { bindInput } from './input.js';

const MAX_CELLS = 340_000; // simulation grid budget; the grid is upscaled to the screen
const MIN_SCALE = 2;       // at least 2x2 css px per cell
const AGENTS_PER_CELL = 0.55;
const MAX_AGENTS = 200_000;
const START_DENSITY = 0.8; // leave 20% head-room for click bursts
const BURST_SIZE = 1400;
const FOOD_LIMIT = 60;     // clamp for painted food/repellent
const SLOW_FPS = 22;       // below this for ~1.5 s, shed agents
const MIN_AGENT_SHARE = 0.4; // never shed below this share of capacity

const canvas = document.getElementById('stage');
const hud = document.getElementById('hud');
const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const renderer = createRenderer(canvas);
const state = { sim: null, cssW: 0, cssH: 0, paused: false, frame: 0, hudHidden: false };

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const seed = Number.parseInt(p.get('seed') ?? '', 10);
  const preset = Number.parseInt(p.get('p') ?? '', 10);
  return {
    seed: Number.isFinite(seed) && seed > 0 ? seed >>> 0 : (Math.random() * 2 ** 32) >>> 0 || 1,
    preset: Number.isInteger(preset) && preset >= 1 && preset <= PRESETS.length ? preset - 1 : 0,
  };
}

function writeHash() {
  const { seed, presetIndex } = state.sim;
  history.replaceState(null, '', `#seed=${seed}&p=${presetIndex + 1}`);
}

/** Size the canvas backing store to the element and return the simulation grid for it. */
function measure() {
  state.cssW = Math.max(1, canvas.clientWidth);
  state.cssH = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(state.cssW * dpr);
  canvas.height = Math.round(state.cssH * dpr);
  const scale = Math.max(MIN_SCALE, Math.sqrt((state.cssW * state.cssH) / MAX_CELLS));
  return {
    width: Math.max(64, Math.round(state.cssW / scale)),
    height: Math.max(64, Math.round(state.cssH / scale)),
  };
}

function build(seed, preset) {
  const { width, height } = measure();
  const capacity = Math.min(MAX_AGENTS, Math.round(width * height * AGENTS_PER_CELL));
  state.sim = createSim({ width, height, capacity, seed, preset, density: START_DENSITY });
  renderer.resize(width, height);
  renderer.setPalette(state.sim.params);
  updateHud();
  writeHash();
}

const toGrid = (x, y) => [(x / state.cssW) * state.sim.width, (y / state.cssH) * state.sim.height];

function paintSegment(x0, y0, x1, y1, repel) {
  const sim = state.sim;
  const [gx0, gy0] = toGrid(x0, y0);
  const [gx1, gy1] = toGrid(x1, y1);
  const radius = Math.max(4, Math.min(sim.width, sim.height) * 0.025);
  const steps = Math.max(1, Math.ceil(Math.hypot(gx1 - gx0, gy1 - gy0) / (radius * 0.5)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    paint(sim.food, sim.width, sim.height, gx0 + (gx1 - gx0) * t, gy0 + (gy1 - gy0) * t, radius, repel ? -22 : 16, FOOD_LIMIT);
  }
}

function spawnBurst(x, y) {
  const sim = state.sim;
  const [gx, gy] = toGrid(x, y);
  burst(sim.agents, BURST_SIZE, gx, gy, sim.width, sim.height, 3, sim.rng);
  updateHud();
}

function selectPreset(i) {
  setPreset(state.sim, i); // live switch: existing trails morph into the new behaviour
  renderer.setPalette(state.sim.params);
  updateHud();
  writeHash();
}

function newSeed() {
  reseed(state.sim, (Math.random() * 2 ** 32) >>> 0 || 1);
  updateHud();
  writeHash();
}

function togglePause() {
  state.paused = !state.paused;
  updateHud();
}

function toggleHud() {
  state.hudHidden = !state.hudHidden;
  if (state.hudHidden && hud.contains(document.activeElement)) document.activeElement.blur();
  hud.classList.toggle('hidden', state.hudHidden);
}

function savePng() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `physarum-${state.sim.params.name.toLowerCase()}-${state.sim.seed}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function clearFood() {
  state.sim.food.fill(0);
}

// ---------- HUD ----------
const presetButtons = PRESETS.map((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${i + 1} ${p.name}`;
  b.addEventListener('click', () => selectPreset(i));
  $('presets').append(b);
  return b;
});
// mouse clicks should not park focus on a button (Space would then re-press it instead of pausing)
hud.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
$('btn-pause').addEventListener('click', togglePause);
$('btn-seed').addEventListener('click', newSeed);
$('btn-save').addEventListener('click', savePng);
$('btn-clear').addEventListener('click', clearFood);

function updateHud() {
  const sim = state.sim;
  $('preset-name').textContent = sim.params.name;
  $('agents').textContent = sim.agents.count.toLocaleString();
  $('seed').textContent = sim.seed;
  $('btn-pause').textContent = state.paused ? 'Play' : 'Pause';
  $('btn-pause').setAttribute('aria-pressed', String(state.paused));
  presetButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === sim.presetIndex)));
  document.documentElement.style.setProperty('--accent', sim.params.colors[0]);
}

let idleTimer = 0;
function onActivity() {
  hud.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => hud.classList.add('idle'), 3500);
}

// ---------- input ----------
bindInput(canvas, {
  onPaint: paintSegment,
  onBurst: spawnBurst,
  onActivity,
  onKey(key, e) {
    if (key === ' ') { e.preventDefault(); togglePause(); }
    else if (key === 'r') newSeed();
    else if (key === 's') savePng();
    else if (key === 'h') toggleHud();
    else if (key === 'c') clearFood();
    else if (key >= '1' && key <= String(PRESETS.length)) selectPreset(Number(key) - 1);
  },
});

// resize (incl. mobile URL-bar and DPR changes): re-grid in place so the piece keeps growing
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const { width, height } = measure();
    if (width !== state.sim.width || height !== state.sim.height) {
      resizeSim(state.sim, width, height);
      renderer.resize(width, height);
    }
  }, 150);
});

// ---------- loop ----------
let last = performance.now(), fpsAvg = 60, slowFrames = 0;

function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  fpsAvg += (1000 / Math.max(dt, 1) - fpsAvg) * 0.05;
  state.frame++;

  const sim = state.sim;
  // reduced motion: half the simulation rate, so the growth is slower and calmer
  if (!state.paused && (!reducedMotion.matches || state.frame % 2 === 0)) step(sim);
  renderer.draw(sim);

  // adaptive load: shed agents when the machine cannot keep up
  if (!state.paused && fpsAvg < SLOW_FPS && sim.agents.count > sim.agents.capacity * MIN_AGENT_SHARE) {
    if (++slowFrames > 90) {
      sim.agents.count = Math.floor(sim.agents.count * 0.85);
      sim.agents.cursor = 0;
      slowFrames = 0;
      updateHud();
    }
  } else {
    slowFrames = 0;
  }

  if (state.frame % 20 === 0) $('fps').textContent = Math.round(fpsAvg);
  requestAnimationFrame(frame);
}

// shared links: editing the #seed=…&p=… hash rebuilds that exact piece
window.addEventListener('hashchange', () => {
  const { seed, preset } = readHash();
  setPreset(state.sim, preset);
  reseed(state.sim, seed);
  renderer.setPalette(state.sim.params);
  updateHud();
  writeHash();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now(); // avoid a giant dt after the tab returns
});

const initial = readHash();
build(initial.seed, initial.preset);
onActivity();
requestAnimationFrame(frame);
