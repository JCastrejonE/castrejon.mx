// Arranque, bucle rAF, entrada (puntero/táctil/teclado), hash de URL, FPS adaptativo.
import { createNoise3D, mulberry32 } from "./noise.js";
import { createField } from "./field.js";
import { createParticles } from "./particles.js";
import { createRenderer } from "./render.js";
import { PALETTES } from "./palettes.js";

const MAX_DT = 1 / 20;          // s: paso acotado (pestaña en segundo plano, tirones)
const FPS_TARGET = 50;          // por debajo, el control adaptativo quita partículas
const MIN_PARTICLES = 400;
const MAX_PARTICLES = 20000;
const LONG_PRESS = 550;         // ms para plantar un atractor en táctil
const DRAG_GAIN = 0.6;          // fracción de la velocidad del puntero que se transmite
const DRAG_MAX = 900;           // px/s

const canvas = document.getElementById("flow");
const help = document.getElementById("help");
const status = document.getElementById("status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const timeScale = reducedMotion ? 0.45 : 1;

const renderer = createRenderer(canvas);
let seed, paletteIndex, field, particles;
let paused = false;
let simTime = 0;
let density;                    // densidad pedida (partículas); el adaptativo puede quedarse por debajo

function defaultDensity() {
  const area = innerWidth * innerHeight / (1440 * 900);
  const n = Math.round(Math.min(9000, Math.max(1500, 5000 * area)));
  return reducedMotion ? Math.round(n * 0.4) : n;
}

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const s = Number.parseInt(h.get("seed"), 10);
  const p = PALETTES.findIndex((q) => q.name === h.get("palette"));
  return { seed: Number.isFinite(s) ? s >>> 0 : null, palette: p };
}

function writeHash() {
  history.replaceState(null, "", `#seed=${seed}&palette=${PALETTES[paletteIndex].name}`);
  status.textContent = `semilla ${seed} · paleta ${PALETTES[paletteIndex].label}`;
}

/** Nueva composición: ruido, campo y partículas a partir de la semilla. */
function compose(newSeed) {
  seed = newSeed >>> 0;
  field = createField({ noise3: createNoise3D(seed) });
  const n = particles ? particles.count : density;
  particles = createParticles(n, innerWidth, innerHeight, mulberry32(seed ^ 0x9e3779b9));
  simTime = 0;
  renderer.clear(PALETTES[paletteIndex]);
  writeHash();
}

function randomSeed() { return Math.floor(Math.random() * 2 ** 31); }

function resize() {
  renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  particles.resize(innerWidth, innerHeight);
  renderer.clear(PALETTES[paletteIndex]);
}

// --- Arranque ---------------------------------------------------------------
{
  const h = readHash();
  paletteIndex = h.palette >= 0 ? h.palette : 0;
  density = defaultDensity();
  renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  compose(h.seed ?? randomSeed());
}
addEventListener("resize", resize);
addEventListener("hashchange", () => {
  const h = readHash();
  if (h.palette >= 0) paletteIndex = h.palette;
  if (h.seed !== null && h.seed !== seed) compose(h.seed);
  else writeHash();
});

// --- Puntero (ratón, lápiz, táctil y multitáctil) --------------------------
const pointers = new Map(); // id -> { x, y, t, lastDragX, lastDragY, down, timer }

function pos(e) { return [e.clientX, e.clientY]; }

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e) => {
  const [x, y] = pos(e);
  const p = { x, y, t: e.timeStamp, lastDragX: x, lastDragY: y, down: false, timer: 0 };
  pointers.set(e.pointerId, p);
  if (e.button === 2) {
    field.addWell(x, y, "attractor");
  } else if (e.button === 0 && e.altKey) {
    field.addWell(x, y, "repulsor");
  } else if (e.button === 0) {
    p.down = true;
    canvas.setPointerCapture(e.pointerId);
    field.setVortex(e.pointerId, x, y, e.shiftKey ? -1 : 1);
    if (e.pointerType === "touch") {
      p.timer = setTimeout(() => {
        field.addWell(p.x, p.y, "attractor");
        field.setVortex(e.pointerId, 0, 0, null);
        p.down = false;
      }, LONG_PRESS);
    }
  }
});

addEventListener("pointermove", (e) => {
  const [x, y] = pos(e);
  let p = pointers.get(e.pointerId);
  if (!p) {
    p = { x, y, t: e.timeStamp, lastDragX: x, lastDragY: y, down: false, timer: 0 };
    pointers.set(e.pointerId, p);
    return;
  }
  const dt = Math.max(1 / 240, (e.timeStamp - p.t) / 1000);
  let vx = (x - p.x) / dt * DRAG_GAIN, vy = (y - p.y) / dt * DRAG_GAIN;
  const v = Math.hypot(vx, vy);
  if (v > DRAG_MAX) { vx *= DRAG_MAX / v; vy *= DRAG_MAX / v; }
  p.x = x; p.y = y; p.t = e.timeStamp;
  if (Math.hypot(x - p.lastDragX, y - p.lastDragY) >= 4) {
    field.addDrag(x, y, vx, vy);
    p.lastDragX = x; p.lastDragY = y;
    if (p.timer) { clearTimeout(p.timer); p.timer = 0; } // se movió: no es pulsación larga
  }
  if (p.down) field.setVortex(e.pointerId, x, y, e.shiftKey ? -1 : 1);
});

function release(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  clearTimeout(p.timer);
  if (p.down) field.setVortex(e.pointerId, 0, 0, null);
  // El ratón sigue presente tras soltar: conserva su posición para el arrastre.
  if (e.pointerType === "mouse") { p.down = false; p.timer = 0; } else pointers.delete(e.pointerId);
}
addEventListener("pointerup", release);
addEventListener("pointercancel", release);

// --- Teclado ----------------------------------------------------------------
function setDensity(n) {
  density = Math.round(Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, n)));
  particles.setCount(density);
}

function savePNG() {
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `campo-de-flujo-${seed}-${PALETTES[paletteIndex].name}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}

addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) return;
  switch (e.key.toLowerCase()) {
    case " ": paused = !paused; break;
    case "r": compose(randomSeed()); break;
    case "p": paletteIndex = (paletteIndex + 1) % PALETTES.length; writeHash(); break;
    case "c": field.clearWells(); break;
    case "s": savePNG(); break;
    case "h": help.hidden = !help.hidden; break;
    case "+": case "=": setDensity(density * 1.25); break;
    case "-": case "_": setDensity(density / 1.25); break;
    default: return;
  }
  e.preventDefault();
});

// --- Bucle y control adaptativo --------------------------------------------
let last = performance.now();
let fpsFrames = 0, fpsStart = last, fps = 60, warmup = 1; // la primera ventana no cuenta

function frame(now) {
  const dt = Math.min(MAX_DT, (now - last) / 1000);
  last = now;
  if (!paused) {
    const sdt = dt * timeScale;
    simTime += sdt;
    field.update(sdt);
    particles.step(field, simTime, sdt);
    renderer.draw(particles, PALETTES[paletteIndex]);

    fpsFrames++;
    if (now - fpsStart >= 1000) {
      fps = fpsFrames * 1000 / (now - fpsStart);
      if (warmup > 0) warmup--;
      else if (fps < FPS_TARGET && particles.count > MIN_PARTICLES) {
        particles.setCount(Math.max(MIN_PARTICLES, particles.count * 0.85));
      } else if (fps > 58 && particles.count < density) {
        particles.setCount(Math.min(density, particles.count * 1.1));
      }
      fpsFrames = 0; fpsStart = now;
    }
  } else {
    fpsFrames = 0; fpsStart = now; // en pausa no se mide
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Estado expuesto para las pruebas de humo -------------------------------
window.__flow = {
  get seed() { return seed; },
  get paletteName() { return PALETTES[paletteIndex].name; },
  get paused() { return paused; },
  get particleCount() { return particles.count; },
  get density() { return density; },
  get wellCount() { return field.wells.length; },
  get dragEnergy() { return field.dragEnergy; },
  get vortexCount() { return field.vortices.size; },
  get reducedMotion() { return reducedMotion; },
  get timeScale() { return timeScale; },
  get fps() { return fps; },
  get dpr() { return renderer.dpr; },
  get canvasSize() { return [canvas.width, canvas.height]; },
};
