// Mycelia — multi-species Physarum simulation (after Jeff Jones, 2010).
// Agents sense a chemical trail at three points ahead, steer toward the
// strongest, move and deposit. The trail is then blurred and decayed.
// Each species follows its own channel and is repelled by the others';
// a shared food channel attracts every species.

const TAU = Math.PI * 2;

// Heading lookup table: LUT_N steps per full turn. cos(a) = SIN[a + LUT_N/4].
const LUT_N = 4096;
const LUT_MASK = LUT_N - 1;
const LUT_K = LUT_N / TAU;
const SIN = new Float32Array(LUT_N + LUT_N / 4);
for (let i = 0; i < SIN.length; i++) SIN[i] = Math.sin((i / LUT_N) * TAU);
const COS_OFF = LUT_N / 4;

const FOOD_DECAY = 0.996;   // food fades over a few hundred ticks
const FOOD_LIFE = 1500;     // ticks after the last addFood before food is zeroed
const SORT_EVERY = 16;       // ticks between spatial re-sorts of the agent arrays
const FOOD_GAIN = 5;        // sensed food = food * FOOD_GAIN (addFood amount ~0.5..3 is sensible)

export const DEFAULT_PARAMS = {
  agents: 120000,
  species: 3,
  sensorAngle: 0.5,
  sensorDist: 12,
  turnSpeed: 0.35,
  stepSize: 1.2,
  deposit: 0.25,
  decay: 0.92,
  diffuse: 0.5,
  repulsion: 0.8,
};

// `pattern` is the suggested reset() pattern for the preset (optional to use).
export const PRESETS = [
  {
    // three species bloom out of a disc and carve territories of polygonal veins
    name: 'Mycelium',
    pattern: 'disc',
    params: { agents: 150000, species: 3, sensorAngle: 0.45, sensorDist: 16, turnSpeed: 0.5,
      stepSize: 1.2, deposit: 0.2, decay: 0.88, diffuse: 0.2, repulsion: 1.2 },
  },
  {
    // colonies of three species grow branching, antler-like reefs that meet at borders
    name: 'Coral',
    pattern: 'clusters',
    params: { agents: 150000, species: 3, sensorAngle: 0.39, sensorDist: 9, turnSpeed: 0.785,
      stepSize: 1.0, deposit: 0.2, decay: 0.9, diffuse: 0.3, repulsion: 0.4 },
  },
  {
    // soft, strongly diffused braids that swirl through each other
    name: 'Nebula',
    pattern: 'random',
    params: { agents: 150000, species: 3, sensorAngle: 0.35, sensorDist: 28, turnSpeed: 0.2,
      stepSize: 1.6, deposit: 0.2, decay: 0.86, diffuse: 0.9, repulsion: 0.3 },
  },
  {
    // a collapsing ring that sends branching tributaries across the field
    name: 'Rivers',
    pattern: 'ring',
    params: { agents: 150000, species: 2, sensorAngle: 0.25, sensorDist: 20, turnSpeed: 0.12,
      stepSize: 1.5, deposit: 0.2, decay: 0.95, diffuse: 0.4, repulsion: 1.0 },
  },
  {
    // two species from scattered seeds settle into large rounded cells that fence each other in
    name: 'Cells',
    pattern: 'clusters',
    params: { agents: 150000, species: 2, sensorAngle: 0.4, sensorDist: 18, turnSpeed: 0.25,
      stepSize: 1.2, deposit: 0.2, decay: 0.95, diffuse: 0.3, repulsion: 1.0 },
  },
  {
    // one species, long sensors: sparse sweeping threads with fine webbing at the joints
    name: 'Filament',
    pattern: 'random',
    params: { agents: 150000, species: 1, sensorAngle: 0.3, sensorDist: 20, turnSpeed: 0.3,
      stepSize: 1.5, deposit: 0.2, decay: 0.9, diffuse: 0.2, repulsion: 0.0 },
  },
  {
    // three interleaved spiral arms that slowly unwind into a network
    name: 'Vortex',
    pattern: 'spiral',
    params: { agents: 150000, species: 3, sensorAngle: 0.45, sensorDist: 16, turnSpeed: 0.5,
      stepSize: 1.2, deposit: 0.2, decay: 0.88, diffuse: 0.2, repulsion: 0.6 },
  },
];

export class Sim {
  constructor(width, height, params = {}) {
    this.width = width | 0;
    this.height = height | 0;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.params.species = clampSpecies(this.params.species);
    this.params.agents = Math.max(0, this.params.agents | 0);
    this.species = this.params.species;
    this.agentCount = 0;
    this._cap = 0;
    this._seed = (Math.random() * 0xffffffff) | 1;
    this._burstCursor = 0;
    this._foodTimer = 0;
    this.tick = 0;
    this._allocMaps();
    this._ensureCapacity(this.params.agents);
    this.agentCount = this.params.agents;
    this.reset('disc');
  }

  // ---- allocation ----------------------------------------------------------

  _allocMaps() {
    const n = this.width * this.height;
    this.trail = new Float32Array(n * 3);
    this._rows = [0, 1, 2, 3].map(() => new Float64Array(this.width * 3));
    this.food = new Float32Array(n);
  }

  _ensureCapacity(n) {
    if (n <= this._cap) return;
    const cap = Math.max(n, Math.ceil(this._cap * 1.25));
    const x = new Float32Array(cap), y = new Float32Array(cap), h = new Float32Array(cap);
    const s = new Uint8Array(cap);
    if (this._cap) {
      x.set(this.ax); y.set(this.ay); h.set(this.ah); s.set(this.as);
    }
    this.ax = x; this.ay = y; this.ah = h; this.as = s;
    // spare buffers for the periodic spatial sort
    this._bx = new Float32Array(cap); this._by = new Float32Array(cap);
    this._bh = new Float32Array(cap); this._bs = new Uint8Array(cap);
    this._cap = cap;
  }

  // Counting sort of agents by row so the step loop walks the trail map in
  // memory order (big cache win). Agents move ~1-2 cells/tick, so re-sorting
  // every SORT_EVERY ticks keeps them close to ordered.
  _sortAgents() {
    const n = this.agentCount, h = this.height;
    if (!this._rowCount || this._rowCount.length !== h + 1) this._rowCount = new Uint32Array(h + 1);
    const cnt = this._rowCount;
    cnt.fill(0);
    const ax = this.ax, ay = this.ay, ah = this.ah, as = this.as;
    const bx = this._bx, by = this._by, bh = this._bh, bs = this._bs;
    for (let i = 0; i < n; i++) cnt[(ay[i] | 0) + 1]++;
    for (let r = 1; r <= h; r++) cnt[r] += cnt[r - 1];
    for (let i = 0; i < n; i++) {
      const j = cnt[ay[i] | 0]++;
      bx[j] = ax[i]; by[j] = ay[i]; bh[j] = ah[i]; bs[j] = as[i];
    }
    this.ax = bx; this.ay = by; this.ah = bh; this.as = bs;
    this._bx = ax; this._by = ay; this._bh = ah; this._bs = as;
  }

  _rand() {
    let s = this._seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this._seed = s;
    return (s >>> 0) * 2.3283064365386963e-10;
  }

  _spawnRandom(from, to) {
    const w = this.width, h = this.height, ns = this.species;
    for (let i = from; i < to; i++) {
      this.ax[i] = this._rand() * w;
      this.ay[i] = this._rand() * h;
      this.ah[i] = this._rand() * TAU;
      this.as[i] = i % ns;
    }
  }

  // ---- public API ------------------------------------------------------------

  setParams(partial = {}) {
    const p = this.params;
    const oldSpecies = this.species;
    const oldCount = this.agentCount;
    Object.assign(p, partial);
    p.species = clampSpecies(p.species);
    p.agents = Math.max(0, p.agents | 0);

    if (p.species !== oldSpecies) {
      this.species = p.species;
      const ns = p.species;
      for (let i = 0; i < oldCount; i++) if (this.as[i] >= ns) this.as[i] = i % ns;
      // clear channels no longer in use
      const t = this.trail;
      for (let c = ns; c < 3; c++) for (let i = c; i < t.length; i += 3) t[i] = 0;
    }
    if (p.agents !== oldCount) {
      this._ensureCapacity(p.agents);
      if (p.agents > oldCount) this._spawnRandom(oldCount, p.agents);
      this.agentCount = p.agents;
      if (this._burstCursor >= this.agentCount) this._burstCursor = 0;
    }
  }

  step(dt = 1) {
    const p = this.params;
    const w = this.width, h = this.height;
    const fw = w, fh = h;
    const xMax = w - 0.001, yMax = h - 0.001;
    if (this.tick % SORT_EVERY === 0) this._sortAgents();
    const trail = this.trail, food = this.food;
    const ax = this.ax, ay = this.ay, ah = this.ah, as = this.as;
    const n = this.agentCount;

    // single conditional wraps below need offsets smaller than the grid
    const lim = Math.min(w, h) - 1;
    const sd = Math.min(p.sensorDist, lim);
    const saI = Math.round(p.sensorAngle * LUT_K);
    const turn = p.turnSpeed;
    const move = Math.min(p.stepSize * dt, lim);
    const dep = p.deposit * dt;
    const rep = p.repulsion;
    const ownK = 1 + rep;
    const useFood = this._foodTimer > 0;
    let seed = this._seed;

    for (let i = 0; i < n; i++) {
      const x = ax[i], y = ay[i];
      let hd = ah[i];
      const s = as[i];
      const a = (hd * LUT_K) | 0;

      // --- sense: left, center, right
      let ia = (a - saI) & LUT_MASK;
      let sx = (x + SIN[ia + COS_OFF] * sd) | 0;
      let sy = (y + SIN[ia] * sd) | 0;
      if (sx < 0) sx += w; else if (sx >= w) sx -= w;
      if (sy < 0) sy += h; else if (sy >= h) sy -= h;
      let c = sy * w + sx, q = c * 3;
      let vL = ownK * trail[q + s] - rep * (trail[q] + trail[q + 1] + trail[q + 2]);
      if (useFood) vL += food[c] * FOOD_GAIN;

      ia = a & LUT_MASK;
      sx = (x + SIN[ia + COS_OFF] * sd) | 0;
      sy = (y + SIN[ia] * sd) | 0;
      if (sx < 0) sx += w; else if (sx >= w) sx -= w;
      if (sy < 0) sy += h; else if (sy >= h) sy -= h;
      c = sy * w + sx; q = c * 3;
      let vC = ownK * trail[q + s] - rep * (trail[q] + trail[q + 1] + trail[q + 2]);
      if (useFood) vC += food[c] * FOOD_GAIN;

      ia = (a + saI) & LUT_MASK;
      sx = (x + SIN[ia + COS_OFF] * sd) | 0;
      sy = (y + SIN[ia] * sd) | 0;
      if (sx < 0) sx += w; else if (sx >= w) sx -= w;
      if (sy < 0) sy += h; else if (sy >= h) sy -= h;
      c = sy * w + sx; q = c * 3;
      let vR = ownK * trail[q + s] - rep * (trail[q] + trail[q + 1] + trail[q + 2]);
      if (useFood) vR += food[c] * FOOD_GAIN;

      // --- rotate
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const r = (seed >>> 0) * 2.3283064365386963e-10;
      if (vC >= vL && vC >= vR) {
        // keep heading; tiny wobble keeps straight lanes from freezing
        hd += (r - 0.5) * turn * 0.1;
      } else if (vC < vL && vC < vR) {
        hd += (r < 0.5 ? -turn : turn) * (0.5 + r);
      } else if (vL > vR) {
        hd -= turn * (0.75 + r * 0.5);
      } else {
        hd += turn * (0.75 + r * 0.5);
      }
      if (hd < 0) hd += TAU; else if (hd >= TAU) hd -= TAU;

      // --- move (toroidal)
      const b = ((hd * LUT_K) | 0) & LUT_MASK;
      let nx = x + SIN[b + COS_OFF] * move;
      let ny = y + SIN[b] * move;
      if (nx < 0) nx += fw; else if (nx >= fw) nx -= fw;
      if (ny < 0) ny += fh; else if (ny >= fh) ny -= fh;
      if (nx > xMax) nx = 0; // would round up to w when stored as float32
      if (ny > yMax) ny = 0;
      ax[i] = nx; ay[i] = ny; ah[i] = hd;

      // --- deposit
      trail[((ny | 0) * w + (nx | 0)) * 3 + s] += dep;
    }
    this._seed = seed;

    this._diffuseDecay(Math.pow(p.decay, dt), p.diffuse);

    if (useFood) {
      if (--this._foodTimer <= 0) food.fill(0);
      else {
        const fd = FOOD_DECAY;
        for (let i = 0; i < food.length; i++) food[i] *= fd;
      }
    }
    this.tick++;
  }

  // Separable 3x3 box blur (toroidal), then trail = lerp(trail, blur, diffuse) * decay.
  _diffuseDecay(decay, diffuse) {
    const r = this._rows;
    blurDecay(this.trail, r[0], r[1], r[2], r[3], this.width, this.height,
      (1 - diffuse) * decay, (diffuse / 9) * decay, this.species);
  }

  addFood(x, y, radius, amount) {
    const w = this.width, h = this.height, food = this.food;
    const r = Math.max(1, radius), r2 = r * r;
    const x0 = Math.floor(x - r), x1 = Math.ceil(x + r);
    const y0 = Math.floor(y - r), y1 = Math.ceil(y + r);
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - y;
      let wy = yy % h; if (wy < 0) wy += h;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        let wx = xx % w; if (wx < 0) wx += w;
        const f = 1 - d2 / r2;
        const c = wy * w + wx;
        const v = food[c] + amount * f * f;
        food[c] = v > 20 ? 20 : v;
      }
    }
    this._foodTimer = FOOD_LIFE;
  }

  repel(x, y, radius, strength = 1) {
    const w = this.width, h = this.height;
    const r = Math.max(1, radius), r2 = r * r;
    const hw = w * 0.5, hh = h * 0.5;
    const ax = this.ax, ay = this.ay, ah = this.ah, n = this.agentCount;
    const push = Math.min(1, Math.max(0, strength));

    for (let i = 0; i < n; i++) {
      let dx = ax[i] - x, dy = ay[i] - y;
      if (dx > hw) dx -= w; else if (dx < -hw) dx += w;
      if (dy > hh) dy -= h; else if (dy < -hh) dy += h;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const d = Math.sqrt(d2);
      let ang;
      if (d < 1e-3) { ang = this._rand() * TAU; } else ang = Math.atan2(dy, dx);
      if (ang < 0) ang += TAU;
      ah[i] = ang;
      const disp = (r - d) * push + this._rand() * 2;
      const nx = ax[i] + Math.cos(ang) * disp;
      const ny = ay[i] + Math.sin(ang) * disp;
      ax[i] = wrapf(nx, w); ay[i] = wrapf(ny, h);
    }

    // dampen trail (and food) inside the radius
    const t = this.trail, food = this.food;
    const x0 = Math.floor(x - r), x1 = Math.ceil(x + r);
    const y0 = Math.floor(y - r), y1 = Math.ceil(y + r);
    const damp = Math.min(1, Math.max(0, strength));
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - y;
      let wy = yy % h; if (wy < 0) wy += h;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        let wx = xx % w; if (wx < 0) wx += w;
        const k = 1 - damp * (1 - d2 / r2);
        const c = wy * w + wx, q = c * 3;
        t[q] *= k; t[q + 1] *= k; t[q + 2] *= k;
        food[c] *= k;
      }
    }
  }

  burst(x, y, n, species = -1) {
    const w = this.width, h = this.height;
    const count = Math.min(n | 0, this.agentCount);
    if (count <= 0) return;
    const ns = this.species;
    const sp = species >= 0 ? Math.min(species | 0, ns - 1) : -1;
    const ringR = 2 + Math.sqrt(count) * 0.08;
    let k = this._burstCursor;
    for (let j = 0; j < count; j++) {
      const ang = (j / count) * TAU + this._rand() * 0.02;
      const rr = ringR * (0.8 + this._rand() * 0.4);
      this.ax[k] = wrapf(x + Math.cos(ang) * rr, w);
      this.ay[k] = wrapf(y + Math.sin(ang) * rr, h);
      this.ah[k] = ang;
      this.as[k] = sp >= 0 ? sp : j % ns;
      if (++k >= this.agentCount) k = 0;
    }
    this._burstCursor = k;
  }

  reset(pattern = 'disc') {
    const w = this.width, h = this.height, n = this.agentCount, ns = this.species;
    const ax = this.ax, ay = this.ay, ah = this.ah, as = this.as;
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    const rnd = () => this._rand();
    const place = (i, x, y, hd) => {
      hd %= TAU; if (hd < 0) hd += TAU;
      ax[i] = wrapf(x, w); ay[i] = wrapf(y, h); ah[i] = hd;
    };
    this.trail.fill(0);
    this.food.fill(0);
    this._foodTimer = 0;
    this._burstCursor = 0;
    this.tick = 0;

    switch (pattern) {
      case 'ring': {
        // thin ring, facing inward: collapses into a web spanning the interior
        const R = m * 0.38;
        for (let i = 0; i < n; i++) {
          const ang = rnd() * TAU;
          const rr = R + (rnd() - 0.5) * m * 0.03;
          place(i, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, ang + Math.PI);
          as[i] = i % ns;
        }
        break;
      }
      case 'random': {
        for (let i = 0; i < n; i++) {
          place(i, rnd() * w, rnd() * h, rnd() * TAU);
          as[i] = i % ns;
        }
        break;
      }
      case 'spiral': {
        // one arm per species (at least 3 arms), agents flowing along the arm
        const arms = Math.max(3, ns);
        const R = m * 0.45, turns = 2.2;
        for (let i = 0; i < n; i++) {
          const arm = i % arms;
          const u = Math.sqrt(rnd());
          const th = u * turns * TAU + (arm / arms) * TAU;
          const rr = u * R + (rnd() - 0.5) * m * 0.02;
          place(i, cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, th + Math.PI * 0.5);
          as[i] = arm % ns;
        }
        break;
      }
      case 'clusters': {
        // several single-species blobs spread across the field, facing outward
        const k = 9;
        const centers = [];
        for (let c = 0; c < k; c++) {
          centers.push([w * (0.1 + 0.8 * rnd()), h * (0.1 + 0.8 * rnd()), m * (0.04 + 0.05 * rnd())]);
        }
        for (let i = 0; i < n; i++) {
          const c = i % k, C = centers[c];
          const ang = rnd() * TAU, rr = Math.sqrt(rnd()) * C[2];
          place(i, C[0] + Math.cos(ang) * rr, C[1] + Math.sin(ang) * rr, ang);
          as[i] = c % ns;
        }
        break;
      }
      case 'disc':
      default: {
        // filled disc split into species sectors, facing outward — blooms into a network
        const R = m * 0.36;
        for (let i = 0; i < n; i++) {
          const ang = rnd() * TAU, rr = Math.sqrt(rnd()) * R;
          place(i, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, ang);
          as[i] = Math.min(ns - 1, ((ang / TAU) * ns) | 0);
        }
        break;
      }
    }
  }

  resize(width, height) {
    width = width | 0; height = height | 0;
    if (width === this.width && height === this.height) return;
    const ow = this.width, oh = this.height, old = this.trail, oldFood = this.food;
    const sx = width / ow, sy = height / oh;
    this.width = width; this.height = height;
    this._allocMaps();

    // nearest-neighbour resample of the maps so the structure survives
    const t = this.trail, f = this.food;
    for (let y = 0; y < height; y++) {
      const oy = Math.min(oh - 1, (y / sy) | 0);
      for (let x = 0; x < width; x++) {
        const ox = Math.min(ow - 1, (x / sx) | 0);
        const c = y * width + x, oc = oy * ow + ox;
        t[c * 3] = old[oc * 3]; t[c * 3 + 1] = old[oc * 3 + 1]; t[c * 3 + 2] = old[oc * 3 + 2];
        f[c] = oldFood[oc];
      }
    }

    const ax = this.ax, ay = this.ay;
    for (let i = 0; i < this.agentCount; i++) {
      let x = ax[i] * sx, y = ay[i] * sy;
      if (x >= width) x = width - 0.001;
      if (y >= height) y = height - 0.001;
      ax[i] = x < 0 ? 0 : x; ay[i] = y < 0 ? 0 : y;
    }
  }
}

// Blur + decay in one sweep. Horizontal 3-tap sums are kept in small row
// buffers (cache resident): r0 permanently holds row 0 (overwritten before the
// last row needs it), the other three rotate as up / current / down.
// Only the first `nch` interleaved channels are touched (unused ones stay 0).
function blurDecay(t, r0, r1, r2, r3, w, h, keep, mix, nch) {
  const row = w * 3;
  hsum(t, 0, r0, row, nch);
  hsum(t, (h - 1) * row, r1, row, nch);
  let up = r1, cur = r0;
  for (let y = 0; y < h; y++) {
    let dn = r0;
    if (y < h - 1) {
      dn = up !== r1 && cur !== r1 ? r1 : up !== r2 && cur !== r2 ? r2 : r3;
      hsum(t, (y + 1) * row, dn, row, nch);
    }
    const o = y * row;
    if (nch === 3) {
      for (let j = 0; j < row; j += 3) {
        const i = o + j;
        t[i] = t[i] * keep + (up[j] + cur[j] + dn[j]) * mix;
        t[i + 1] = t[i + 1] * keep + (up[j + 1] + cur[j + 1] + dn[j + 1]) * mix;
        t[i + 2] = t[i + 2] * keep + (up[j + 2] + cur[j + 2] + dn[j + 2]) * mix;
      }
    } else {
      for (let k = 0; k < nch; k++) {
        for (let j = k; j < row; j += 3) {
          t[o + j] = t[o + j] * keep + (up[j] + cur[j] + dn[j]) * mix;
        }
      }
    }
    up = cur; cur = dn;
  }
}

// Horizontal 3-tap sum (toroidal) of one interleaved RGB row starting at t[o].
function hsum(t, o, dst, row, nch) {
  if (nch === 3) {
    hsum3(t, o, dst, row);
    return;
  }
  const last = row - 3;
  for (let k = 0; k < nch; k++) {
    let a = t[o + last + k], b = t[o + k];
    const f = b;
    for (let i = k; i < last; i += 3) {
      const c = t[o + i + 3];
      dst[i] = a + b + c;
      a = b; b = c;
    }
    dst[last + k] = a + b + f;
  }
}

// All three channels at once with a rolling window: one load per output.
function hsum3(t, o, dst, row) {
  const last = row - 3;
  let a0 = t[o + last], a1 = t[o + last + 1], a2 = t[o + last + 2];
  let b0 = t[o], b1 = t[o + 1], b2 = t[o + 2];
  const f0 = b0, f1 = b1, f2 = b2;
  for (let i = 0; i < last; i += 3) {
    const c0 = t[o + i + 3], c1 = t[o + i + 4], c2 = t[o + i + 5];
    dst[i] = a0 + b0 + c0; dst[i + 1] = a1 + b1 + c1; dst[i + 2] = a2 + b2 + c2;
    a0 = b0; a1 = b1; a2 = b2;
    b0 = c0; b1 = c1; b2 = c2;
  }
  dst[last] = a0 + b0 + f0; dst[last + 1] = a1 + b1 + f1; dst[last + 2] = a2 + b2 + f2;
}

// Toroidal wrap into [0, n), kept safely below n after float32 rounding.
function wrapf(v, n) {
  v %= n;
  if (v < 0) v += n;
  return v > n - 0.001 ? 0 : v;
}

function clampSpecies(s) {
  s = s | 0;
  return s < 1 ? 1 : s > 3 ? 3 : s;
}
