// Physarum simulation core. Pure: no DOM, no globals, so node can test it.
//
// Model (after Jeff Jones, 2010): each agent has three forward sensors. It
// turns toward the strongest signal, steps forward, and deposits chemical on
// its own species' trail map. Trail maps diffuse and decay every step.
//
// Fields:
//   trails[k]  chemical laid by species k
//   food       attractant from food nodes and the lure brush (all species like it)
//   walls      repellent painted by the user; agents cannot enter it
//
// Every step we fold those into one "sense map" per species, so each sensor
// sample is a single array read:
//   sense_k = own_k - repel * (others) + food - WALL_PENALTY * walls

const LUT_SIZE = 4096;
const LUT_MASK = LUT_SIZE - 1;
const TAU = Math.PI * 2;
const LUT_SCALE = LUT_SIZE / TAU;
const COS = new Float32Array(LUT_SIZE);
const SIN = new Float32Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) {
  COS[i] = Math.cos(i / LUT_SCALE);
  SIN[i] = Math.sin(i / LUT_SCALE);
}
const WALL_PENALTY = 200;
const EDGE = -1e4;

export const MAX_SPECIES = 3;

export const DEFAULT_PARAMS = Object.freeze({
  sensorAngle: 0.4,     // radians between the forward and side sensors
  sensorDist: 12,       // cells
  turnSpeed: 0.7,       // radians per step
  stepSize: 1.1,        // cells per step
  deposit: 0.9,         // chemical laid per agent per step
  decay: 0.92,          // trail multiplier per step
  diffuse: 0.55,        // 0 = no blur, 1 = full 3x3 box blur per step
  wander: 0.06,         // random heading jitter (radians)
  foodEmit: 8,          // attractant per food cell per step (at the centre)
  foodRadius: 4,        // cells
  foodDecay: 0.97,      // attractant reach; fades fast enough that removed food stops pulling
  repel: 0.7,           // weight of rival species' trail (species mode)
  wallDecay: 0.996,     // how slowly painted walls fade
  maxTrail: 60,         // clamp, keeps dense spots from saturating
  maxFood: 400,         // food is allowed to outshine any trail
  respawn: 0.006,       // chance per agent per step to be reborn at a random food.
                        // Every food then sends out travellers, which wears
                        // tubes between foods.
  crowd: 0,             // max agents per cell (0 = unlimited). Jones's occupancy
                        // rule: a full cell blocks the move, which spreads the
                        // population into a network instead of one fat strand.
});

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim({ width, height, agentCount = 0, species = 1, seed = 1, params = {}, layout = 'disc' }) {
  width = Math.floor(width);
  height = Math.floor(height);
  if (!(width >= 8 && height >= 8)) throw new RangeError('grid must be at least 8x8');
  if (!(species >= 1 && species <= MAX_SPECIES)) throw new RangeError(`species must be 1..${MAX_SPECIES}`);
  const cells = width * height;
  const sim = {
    width,
    height,
    species,
    params: { ...DEFAULT_PARAMS, ...params },
    rand: mulberry32(seed),
    trails: [],
    senses: [],
    food: new Float32Array(cells),
    walls: new Float32Array(cells),
    wallsActive: false,
    occ: new Uint8Array(cells),
    scratch: new Float32Array(cells),
    count: 0,
    capacity: 0,
    x: null,
    y: null,
    heading: null,
    kind: null,
    foods: [],
    nextFoodId: 1,
    steps: 0,
  };
  for (let s = 0; s < species; s++) {
    sim.trails.push(new Float32Array(cells));
    sim.senses.push(new Float32Array(cells));
  }
  ensureCapacity(sim, agentCount);
  seedAgents(sim, agentCount, layout);
  return sim;
}

function ensureCapacity(sim, n) {
  if (n <= sim.capacity) return;
  const cap = Math.max(n, Math.ceil(sim.capacity * 1.5));
  const grow = (old, Type) => {
    const next = new Type(cap);
    if (old) next.set(old.subarray(0, sim.count));
    return next;
  };
  sim.x = grow(sim.x, Float32Array);
  sim.y = grow(sim.y, Float32Array);
  sim.heading = grow(sim.heading, Float32Array);
  sim.kind = grow(sim.kind, Uint8Array);
  sim.capacity = cap;
}

// layout: 'disc' (a centred disc facing inward; with species, one disc each),
// 'uniform' (anywhere), 'ring' (a thin ring facing inward), or 'foods'
// (spawned around existing food nodes).
export function seedAgents(sim, n, layout = 'disc') {
  const { width: W, height: H, rand } = sim;
  n = Math.max(0, Math.floor(n));
  ensureCapacity(sim, n);
  sim.count = n;
  const cx = W / 2, cy = H / 2;
  const r0 = Math.min(W, H) * 0.32;
  const foods = sim.foods;
  for (let i = 0; i < n; i++) {
    let px, py, a;
    const kind = sim.species > 1 ? i % sim.species : 0;
    if (layout === 'foods' && foods.length) {
      const f = foods[(rand() * foods.length) | 0];
      const r = rand() * 12;
      a = rand() * TAU;
      px = f.x + Math.cos(a) * r;
      py = f.y + Math.sin(a) * r;
    } else if (layout === 'uniform') {
      px = rand() * W;
      py = rand() * H;
      a = rand() * TAU;
    } else if (layout === 'ring') {
      const t = rand() * TAU;
      const r = r0 * (1.1 + rand() * 0.08);
      px = cx + Math.cos(t) * r;
      py = cy + Math.sin(t) * r;
      a = t + Math.PI;
    } else if (sim.species > 1) {
      // One cluster per species, spread around the centre.
      const base = (kind / sim.species) * TAU - Math.PI / 2;
      const ccx = cx + Math.cos(base) * r0 * 0.9;
      const ccy = cy + Math.sin(base) * r0 * 0.9;
      const r = Math.sqrt(rand()) * r0 * 0.45;
      a = rand() * TAU;
      px = ccx + Math.cos(a) * r;
      py = ccy + Math.sin(a) * r;
    } else {
      const r = Math.sqrt(rand()) * r0;
      const t = rand() * TAU;
      px = cx + Math.cos(t) * r;
      py = cy + Math.sin(t) * r;
      a = t + Math.PI; // face inward: the disc collapses into a network
    }
    sim.x[i] = clamp(px, 1, W - 2);
    sim.y[i] = clamp(py, 1, H - 2);
    sim.heading[i] = wrapAngle(a);
    sim.kind[i] = kind;
  }
  rebuildOccupancy(sim);
}

// Recount agents per cell (after seeding, resizing or changing the population).
export function rebuildOccupancy(sim) {
  const occ = sim.occ, W = sim.width;
  occ.fill(0);
  for (let i = 0; i < sim.count; i++) {
    const idx = (sim.y[i] | 0) * W + (sim.x[i] | 0);
    if (occ[idx] < 255) occ[idx]++;
  }
}

// Grow or shrink the live population without disturbing existing agents.
export function setAgentCount(sim, n) {
  n = Math.max(0, Math.floor(n));
  if (n <= sim.count) {
    sim.count = n;
    rebuildOccupancy(sim);
    return;
  }
  ensureCapacity(sim, n);
  const { rand, width: W, height: H, foods } = sim;
  const existing = sim.count;
  for (let i = existing; i < n; i++) {
    // New agents are born on existing agents (or food) so growth looks organic.
    if (existing > 0) {
      const j = (rand() * existing) | 0;
      sim.x[i] = sim.x[j];
      sim.y[i] = sim.y[j];
      sim.kind[i] = sim.kind[j];
    } else {
      const f = foods.length ? foods[(rand() * foods.length) | 0] : null;
      sim.x[i] = f ? f.x : 1 + rand() * (W - 3);
      sim.y[i] = f ? f.y : 1 + rand() * (H - 3);
      sim.kind[i] = sim.species > 1 ? i % sim.species : 0;
    }
    sim.heading[i] = rand() * TAU;
  }
  sim.count = n;
  rebuildOccupancy(sim);
}

export function addFood(sim, x, y, strength = 1) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(strength)) return null;
  const food = {
    id: sim.nextFoodId++,
    x: clamp(x, 1, sim.width - 2),
    y: clamp(y, 1, sim.height - 2),
    strength,
    born: sim.steps,
  };
  sim.foods.push(food);
  return food;
}

export function removeFood(sim, id) {
  const i = sim.foods.findIndex((f) => f.id === id);
  if (i < 0) return null;
  return sim.foods.splice(i, 1)[0];
}

export function clearFood(sim) {
  sim.foods.length = 0;
}

export function findFoodNear(sim, x, y, radius) {
  let best = null;
  let bestD = radius * radius;
  for (const f of sim.foods) {
    const d = (f.x - x) ** 2 + (f.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

// Paint into the field. mode: 'lure' adds attractant, 'wall' adds repellent,
// 'erase' removes walls and chemical.
export function paint(sim, x, y, radius, amount, mode = 'lure') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(amount)) return;
  const { width: W, height: H } = sim;
  const r = Math.max(1, radius);
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.ceil(y + r));
  const r2 = r * r;
  const maxFood = sim.params.maxFood;
  if (mode === 'wall') sim.wallsActive = true;
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const d2 = (xx - x) ** 2 + (yy - y) ** 2;
      if (d2 > r2) continue;
      const falloff = 1 - d2 / r2;
      const idx = yy * W + xx;
      if (mode === 'wall') {
        sim.walls[idx] = Math.min(1, sim.walls[idx] + amount * falloff);
      } else if (mode === 'erase') {
        const keep = 1 - falloff;
        sim.walls[idx] *= keep;
        sim.food[idx] *= keep;
        for (const t of sim.trails) t[idx] *= keep;
      } else {
        sim.food[idx] = Math.min(maxFood, sim.food[idx] + amount * falloff);
      }
    }
  }
}

export function clearField(sim) {
  for (const t of sim.trails) t.fill(0);
  sim.food.fill(0);
  sim.walls.fill(0);
  sim.wallsActive = false;
}

// Resample every field into a new grid size, keeping agents and food at the
// same relative positions. Used on window resize.
export function resizeSim(sim, width, height) {
  width = Math.floor(width);
  height = Math.floor(height);
  if (!(width >= 8 && height >= 8)) throw new RangeError('grid must be at least 8x8');
  if (width === sim.width && height === sim.height) return;
  const oW = sim.width, oH = sim.height;
  const sx = width / oW, sy = height / oH;
  const resample = (src) => {
    const dst = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const oy = Math.min(oH - 1, Math.floor(y / sy)) * oW;
      const row = y * width;
      for (let x = 0; x < width; x++) dst[row + x] = src[oy + Math.min(oW - 1, Math.floor(x / sx))];
    }
    return dst;
  };
  sim.trails = sim.trails.map(resample);
  sim.food = resample(sim.food);
  sim.walls = resample(sim.walls);
  sim.senses = sim.trails.map(() => new Float32Array(width * height));
  sim.scratch = new Float32Array(width * height);
  for (let i = 0; i < sim.count; i++) {
    sim.x[i] = clamp(sim.x[i] * sx, 1, width - 2);
    sim.y[i] = clamp(sim.y[i] * sy, 1, height - 2);
  }
  for (const f of sim.foods) {
    f.x = clamp(f.x * sx, 1, width - 2);
    f.y = clamp(f.y * sy, 1, height - 2);
  }
  sim.width = width;
  sim.height = height;
  sim.occ = new Uint8Array(width * height);
  rebuildOccupancy(sim);
}

export function step(sim) {
  respawnAtFood(sim);
  emitFood(sim);
  buildSenseMaps(sim);
  if (sim.species === 1) moveAgentsSingle(sim);
  else moveAgentsMulti(sim);
  diffuseAndDecay(sim);
  sim.steps++;
}

function respawnAtFood(sim) {
  const { foods, rand, count } = sim;
  const rate = sim.params.respawn;
  if (!(rate > 0) || foods.length === 0 || count === 0) return;
  // Expected number of rebirths this step, with the fractional part sampled.
  const expected = count * rate;
  let n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
  const W = sim.width, occ = sim.occ, r = sim.params.foodRadius;
  while (n-- > 0) {
    const i = (rand() * count) | 0;
    const f = foods[(rand() * foods.length) | 0];
    const a = rand() * TAU;
    const d = rand() * r;
    const oldIdx = (sim.y[i] | 0) * W + (sim.x[i] | 0);
    if (occ[oldIdx] > 0) occ[oldIdx]--;
    sim.x[i] = clamp(f.x + Math.cos(a) * d, 1, W - 2);
    sim.y[i] = clamp(f.y + Math.sin(a) * d, 1, sim.height - 2);
    sim.heading[i] = a;
    const idx = (sim.y[i] | 0) * W + (sim.x[i] | 0);
    if (occ[idx] < 255) occ[idx]++;
  }
}

function emitFood(sim) {
  const { foodEmit, foodRadius } = sim.params;
  for (const f of sim.foods) paint(sim, f.x, f.y, foodRadius, foodEmit * f.strength, 'lure');
}

export function buildSenseMaps(sim) {
  const { species, trails, senses, food, walls, wallsActive } = sim;
  const n = food.length;
  if (species === 1) {
    const t = trails[0], s = senses[0];
    if (wallsActive) for (let i = 0; i < n; i++) s[i] = t[i] + food[i] - WALL_PENALTY * walls[i];
    else for (let i = 0; i < n; i++) s[i] = t[i] + food[i];
    return;
  }
  // sense_k = own_k*(1+repel) - repel*total + food - penalty*walls
  const repel = sim.params.repel;
  const own = 1 + repel;
  const total = sim.scratch;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < species; k++) sum += trails[k][i];
    total[i] = food[i] - repel * sum - (wallsActive ? WALL_PENALTY * walls[i] : 0);
  }
  for (let k = 0; k < species; k++) {
    const t = trails[k], s = senses[k];
    for (let i = 0; i < n; i++) s[i] = t[i] * own + total[i];
  }
}

// Sample a sense map. Off-grid sensors read a strong negative so agents turn
// away from the edges.
function sample(map, W, H, px, py) {
  if (px < 0 || py < 0 || px >= W || py >= H) return EDGE;
  return map[(py | 0) * W + (px | 0)];
}

function moveAgentsSingle(sim) {
  moveLoop(sim, sim.senses[0], sim.trails[0], null, null);
}

function moveAgentsMulti(sim) {
  moveLoop(sim, null, null, sim.senses, sim.trails);
}

// One loop for both modes; the `single*` arguments avoid per-agent array
// lookups when there's one species.
function moveLoop(sim, singleSense, singleTrail, senses, trails) {
  const { width: W, height: H, rand } = sim;
  const p = sim.params;
  const sd = p.sensorDist, turn = p.turnSpeed;
  const stepSize = p.stepSize, dep = p.deposit, wander = p.wander, maxTrail = p.maxTrail;
  const saI = (p.sensorAngle * LUT_SCALE) | 0;
  const xs = sim.x, ys = sim.y, hs = sim.heading, ks = sim.kind;
  const walls = sim.walls, wallsActive = sim.wallsActive;
  const occ = sim.occ, crowd = p.crowd > 0 ? Math.min(255, p.crowd) : 256;
  const n = sim.count;
  const maxX = W - 1, maxY = H - 1;

  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    const sense = singleSense || senses[ks[i]];
    let h = hs[i];
    const hi = (h * LUT_SCALE) | 0;
    const fi = hi & LUT_MASK;
    const li = (hi - saI) & LUT_MASK;
    const ri = (hi + saI) & LUT_MASK;

    const F = sample(sense, W, H, x + COS[fi] * sd, y + SIN[fi] * sd);
    const L = sample(sense, W, H, x + COS[li] * sd, y + SIN[li] * sd);
    const R = sample(sense, W, H, x + COS[ri] * sd, y + SIN[ri] * sd);

    // One random draw drives both the turn choice and the wander jitter.
    const r = rand();
    if (F >= L && F >= R) {
      // straight ahead is best
    } else if (F < L && F < R) {
      h += r < 0.5 ? -turn : turn;
    } else if (L > R) {
      h -= turn * (0.6 + 0.4 * r);
    } else {
      h += turn * (0.6 + 0.4 * r);
    }
    h += (r - 0.5) * wander;

    const di = ((h * LUT_SCALE) | 0) & LUT_MASK;
    const nx = x + COS[di] * stepSize;
    const ny = y + SIN[di] * stepSize;

    let blocked = nx < 1 || ny < 1 || nx >= maxX || ny >= maxY;
    let idx = 0;
    if (!blocked) {
      idx = (ny | 0) * W + (nx | 0);
      if (wallsActive && walls[idx] > 0.5) blocked = true;
      else if (occ[idx] >= crowd && idx !== (y | 0) * W + (x | 0)) blocked = true;
    }
    if (blocked) {
      // Bounce: turn around with some spread, stay in place this step.
      h += Math.PI + (r - 0.5) * 1.2;
    } else {
      const trail = singleTrail || trails[ks[i]];
      const v = trail[idx] + dep;
      trail[idx] = v > maxTrail ? maxTrail : v;
      const oldIdx = (y | 0) * W + (x | 0);
      if (oldIdx !== idx) {
        if (occ[oldIdx] > 0) occ[oldIdx]--;
        if (occ[idx] < 255) occ[idx]++;
      }
      xs[i] = nx;
      ys[i] = ny;
    }
    if (h >= TAU) h -= TAU;
    if (h >= TAU) h -= TAU;
    if (h < 0) h += TAU;
    hs[i] = h;
  }
}

// Separable 3-tap box blur, blended with the original, then decayed.
function blurDecay(t, tmp, W, H, diffuse, decay) {
  const keep = 1 - diffuse;
  const third = 1 / 3;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    tmp[row] = (t[row] * 2 + t[row + 1]) * third;
    for (let x = 1; x < W - 1; x++) {
      const i = row + x;
      tmp[i] = (t[i - 1] + t[i] + t[i + 1]) * third;
    }
    const last = row + W - 1;
    tmp[last] = (t[last - 1] + t[last] * 2) * third;
  }
  for (let y = 0; y < H; y++) {
    const row = y * W;
    const up = y > 0 ? row - W : row;
    const down = y < H - 1 ? row + W : row;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      const blurred = (tmp[up + x] + tmp[i] + tmp[down + x]) * third;
      t[i] = (t[i] * keep + blurred * diffuse) * decay;
    }
  }
}

function diffuseAndDecay(sim) {
  const { width: W, height: H } = sim;
  const { decay, diffuse, foodDecay, wallDecay } = sim.params;
  for (const t of sim.trails) blurDecay(t, sim.scratch, W, H, diffuse, decay);
  blurDecay(sim.food, sim.scratch, W, H, 0.8, foodDecay);
  if (sim.wallsActive) {
    const walls = sim.walls;
    let any = false;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w !== 0) {
        if (w < 0.01) walls[i] = 0;
        else {
          walls[i] = w * wallDecay;
          any = true;
        }
      }
    }
    sim.wallsActive = any;
  }
}

// Total chemical in trail map s. Handy for tests and diagnostics.
export function totalTrail(sim, s = 0) {
  let sum = 0;
  const t = sim.trails[s];
  for (let i = 0; i < t.length; i++) sum += t[i];
  return sum;
}

// Rough network size: number of cells whose combined trail is above a
// threshold, sampled on a stride to stay cheap.
export function networkCells(sim, threshold = 6, stride = 2) {
  const { width: W, height: H, trails } = sim;
  let count = 0;
  for (let y = 0; y < H; y += stride) {
    const row = y * W;
    for (let x = 0; x < W; x += stride) {
      let v = 0;
      for (const t of trails) v += t[row + x];
      if (v > threshold) count++;
    }
  }
  return count * stride * stride;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapAngle(a) {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}
