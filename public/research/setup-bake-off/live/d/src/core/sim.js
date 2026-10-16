import { createRng } from './rng.js';
import { diffuse, decayField, wrapCoord } from './field.js';
import { createAgents, seedAgents } from './agents.js';
import { PRESETS } from './presets.js';

export const SPECIES = 3;
const FOOD_DECAY = 0.997;

/**
 * Build a simulation. `density` (0..1) is the fraction of `capacity` seeded at start,
 * leaving head-room for click bursts.
 */
export function createSim({ width, height, capacity, seed = 1, preset = 0, density = 1 }) {
  const size = width * height;
  const sim = {
    width, height, seed, density,
    rng: createRng(seed),
    trails: Array.from({ length: SPECIES }, () => new Float32Array(size)),
    scratch: new Float32Array(size),
    food: new Float32Array(size),
    agents: createAgents(capacity),
    params: null,
    presetIndex: 0,
    ticks: 0,
  };
  setPreset(sim, preset);
  reseed(sim, seed);
  return sim;
}

export function setPreset(sim, index) {
  sim.presetIndex = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
  sim.params = { ...PRESETS[sim.presetIndex] };
}

/** Clear all fields and re-lay the agents with the current preset's spawn pattern. */
export function reseed(sim, seed = sim.seed) {
  sim.seed = seed;
  sim.rng = createRng(seed);
  for (const t of sim.trails) t.fill(0);
  sim.food.fill(0);
  const n = Math.round(sim.agents.capacity * sim.density);
  seedAgents(sim.agents, n, sim.width, sim.height, SPECIES, sim.params.spawn, sim.rng);
  sim.ticks = 0;
}

/**
 * Re-grid the simulation (e.g. on window resize) without losing its state:
 * agents are rescaled and every field is resampled nearest-neighbour.
 */
export function resizeSim(sim, width, height) {
  const { width: ow, height: oh } = sim;
  if (ow === width && oh === height) return;
  const resample = (src) => {
    const dst = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const row = Math.min(oh - 1, Math.floor((y * oh) / height)) * ow;
      for (let x = 0; x < width; x++) dst[y * width + x] = src[row + Math.min(ow - 1, Math.floor((x * ow) / width))];
    }
    return dst;
  };
  sim.trails = sim.trails.map(resample);
  sim.food = resample(sim.food);
  sim.scratch = new Float32Array(width * height);
  const { x, y, count } = sim.agents;
  const kx = width / ow, ky = height / oh;
  for (let i = 0; i < count; i++) {
    x[i] = wrapCoord(x[i] * kx, width);
    y[i] = wrapCoord(y[i] * ky, height);
    if (x[i] >= width) x[i] = 0;
    if (y[i] >= height) y[i] = 0;
  }
  sim.width = width;
  sim.height = height;
}

/** One simulation tick: sense → rotate → move → deposit, then diffuse/decay every field. */
export function step(sim) {
  const { width: w, height: h, trails, food, rng } = sim;
  const { sensorAngle: sa, sensorDist: sd, turn, speed, deposit, repel, jitter, foodWeight } = sim.params;
  const { x: ax, y: ay, heading: ah, species: as, count } = sim.agents;
  const t0 = trails[0], t1 = trails[1], t2 = trails[2];

  // weights[s*3+k]: how species s perceives trail k (+1 own, -repel others)
  const wt = new Float32Array(9);
  for (let s = 0; s < 3; s++) for (let k = 0; k < 3; k++) wt[s * 3 + k] = s === k ? 1 : -repel;

  for (let i = 0; i < count; i++) {
    const s = as[i];
    const w0 = wt[s * 3], w1 = wt[s * 3 + 1], w2 = wt[s * 3 + 2];
    const px = ax[i], py = ay[i];
    let a = ah[i];

    // three sensors: forward, left (+angle), right (-angle); sensorDist < grid size so one wrap suffices
    let sx = px + Math.cos(a) * sd, sy = py + Math.sin(a) * sd;
    let j = (wrapCoord(sy, h) | 0) * w + (wrapCoord(sx, w) | 0);
    const F = w0 * t0[j] + w1 * t1[j] + w2 * t2[j] + foodWeight * food[j];

    sx = px + Math.cos(a + sa) * sd; sy = py + Math.sin(a + sa) * sd;
    j = (wrapCoord(sy, h) | 0) * w + (wrapCoord(sx, w) | 0);
    const L = w0 * t0[j] + w1 * t1[j] + w2 * t2[j] + foodWeight * food[j];

    sx = px + Math.cos(a - sa) * sd; sy = py + Math.sin(a - sa) * sd;
    j = (wrapCoord(sy, h) | 0) * w + (wrapCoord(sx, w) | 0);
    const R = w0 * t0[j] + w1 * t1[j] + w2 * t2[j] + foodWeight * food[j];

    if (F > L && F > R) {
      // keep going
    } else if (F < L && F < R) {
      a += rng() < 0.5 ? turn : -turn;
    } else if (L > R) {
      a += turn;
    } else if (R > L) {
      a -= turn;
    }
    if (jitter) a += (rng() - 0.5) * jitter;

    ax[i] = wrapCoord(px + Math.cos(a) * speed, w);
    ay[i] = wrapCoord(py + Math.sin(a) * speed, h);
    // float32 storage can round a value just below the edge up to exactly w or h
    if (ax[i] >= w) ax[i] = 0;
    if (ay[i] >= h) ay[i] = 0;
    const nx = ax[i], ny = ay[i];
    // keep headings bounded so float precision never degrades over long runs
    ah[i] = a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;

    if (deposit) {
      const d = (ny | 0) * w + (nx | 0);
      if (s === 0) t0[d] += deposit; else if (s === 1) t1[d] += deposit; else t2[d] += deposit;
    }
  }

  const { diffuse: rate, decay } = sim.params;
  for (const t of trails) diffuse(t, sim.scratch, w, h, rate, decay);
  decayField(food, FOOD_DECAY);
  sim.ticks++;
}
