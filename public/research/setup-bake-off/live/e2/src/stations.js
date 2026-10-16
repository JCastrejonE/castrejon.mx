// Station model (normalized coords), names, hit testing and network analysis.
import { mulberry32, clamp } from './rng.js';
import { PREFIXES, SUFFIXES } from './names.js';

const BLOCKED = new Set(['BELL END']);

export const MAX_STATIONS = 24;
export const PROBE = 128;
const SAT_FRAC = 0.9;
export const EXPO_K = +(new URLSearchParams(location.search).get("ex") || 2.0);

export class Stations {
  constructor(seed) {
    this.list = [];
    this.dying = [];
    this.version = 0;
    this.nextId = 1;
    this.reset(seed);
  }
  reset(seed) {
    this.seed = seed >>> 0;
    this.rand = mulberry32(this.seed ^ 0x9e3779b9);
    this.used = new Set();
    this.list.length = 0;
    this.version++;
  }
  makeName() {
    for (let tries = 0; tries < 400; tries++) {
      const p = PREFIXES[(this.rand() * PREFIXES.length) | 0];
      const s = SUFFIXES[(this.rand() * SUFFIXES.length) | 0];
      // Run-on forms (MILLBRIDGE) only read well with short prefixes; long ones get a space.
      const n = s[0] !== ' ' && p.length > 6 ? p + ' ' + s : p + s;
      if (BLOCKED.has(n)) continue;
      if (!this.used.has(n)) { this.used.add(n); return n; }
    }
    const n = 'STATION ' + this.nextId; this.used.add(n); return n;
  }
  add(u, v, now = performance.now()) {
    if (this.list.length >= MAX_STATIONS) return null;
    const st = {
      id: this.nextId++, u: clamp(u, 0.01, 0.99), v: clamp(v, 0.01, 0.99), name: this.makeName(),
      born: now, linked: false, everLinked: false, flash: 0, lastAid: now, boost: 1,
    };
    this.list.push(st);
    this.version++;
    return st;
  }
  remove(st, now = performance.now()) {
    const i = this.list.indexOf(st);
    if (i < 0) return;
    this.list.splice(i, 1);
    this.used.delete(st.name);
    this.dying.push({ ...st, died: now });
    this.version++;
  }
  clear(now = performance.now()) {
    for (const st of this.list) this.dying.push({ ...st, died: now });
    this.list.length = 0; this.used.clear(); this.version++;
  }
  move(st, u, v) {
    st.u = clamp(u, 0.01, 0.99); st.v = clamp(v, 0.01, 0.99); this.version++;
  }
  // Loose pentagon with jitter.
  defaultLayout(aspect, now) {
    const r = this.rand;
    const n = 5, rot = r() * Math.PI * 2;
    const rx = aspect >= 1 ? 0.3 / aspect * 1.25 : 0.33, ry = aspect >= 1 ? 0.3 : 0.3 * aspect * 1.1;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
      const rr = 0.75 + r() * 0.4;
      pts.push([0.5 + Math.cos(a) * rx * rr * 1.2, 0.5 + Math.sin(a) * ry * rr]);
    }
    for (const [u, v] of pts) this.add(u, v, now);
  }
  hit(x, y, w, h, radius) {
    let best = null, bd = radius * radius;
    for (const st of this.list) {
      const dx = st.u * w - x, dy = st.v * h - y, d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = st; }
    }
    return best;
  }
  get linkedCount() { let n = 0; for (const s of this.list) if (s.linked) n++; return n; }
}

// Analysis of the 128x128 probe (row 0 = top). R = tone-mapped max, G = argmax, B = sqrt(raw/16).
const labels = new Int32Array(PROBE * PROBE);
const stack = new Int32Array(PROBE * PROBE);
const hist = [];
const mask = new Uint8Array(PROBE * PROBE);

export function analyzeProbe(px, stations, now, allowLink = true) {
  const N = PROBE;
  // Exposure: p98 of raw over pixels where R > 0.02.
  hist.length = 0;
  let lit = 0;
  // Station splats are always hot; keep them out of the exposure statistics.
  mask.fill(0);
  for (const st of stations.list) {
    const cx = (st.u * N) | 0, cy = (st.v * N) | 0;
    for (let y = Math.max(0, cy - 4); y <= Math.min(N - 1, cy + 4); y++)
      for (let x = Math.max(0, cx - 4); x <= Math.min(N - 1, cx + 4); x++) mask[y * N + x] = 1;
  }
  for (let i = 0; i < N * N; i++) {
    const R = px[i * 4];
    if (R > 5 && !mask[i]) { const b = px[i * 4 + 2] / 255; hist.push(b * b * 16); }
    labels[i] = R > 46 ? -1 : 0; // on if R > 0.18
    if (R > 46) lit++;
  }
  let expoTarget = null;
  if (hist.length > 50) {
    hist.sort((a, b) => a - b);
    const p98 = hist[Math.min(hist.length - 1, Math.floor(hist.length * 0.98))];
    if (p98 > 1e-4) expoTarget = clamp(EXPO_K / p98, 0.02, 40);
  } else expoTarget = 40;
  // Flood-fill connected components (8-connected).
  let next = 1;
  for (let i = 0; i < N * N; i++) {
    if (labels[i] !== -1) continue;
    let sp = 0; stack[sp++] = i; labels[i] = next;
    while (sp) {
      const j = stack[--sp], x = j % N, y = (j / N) | 0;
      if (x > 0 && labels[j - 1] === -1) { labels[j - 1] = next; stack[sp++] = j - 1; }
      if (x < N - 1 && labels[j + 1] === -1) { labels[j + 1] = next; stack[sp++] = j + 1; }
      if (y > 0 && labels[j - N] === -1) { labels[j - N] = next; stack[sp++] = j - N; }
      if (y < N - 1 && labels[j + N] === -1) { labels[j + N] = next; stack[sp++] = j + N; }
      // Diagonals too: thin diagonal tubes are only 8-connected at probe resolution.
      if (x > 0 && y > 0 && labels[j - N - 1] === -1) { labels[j - N - 1] = next; stack[sp++] = j - N - 1; }
      if (x < N - 1 && y > 0 && labels[j - N + 1] === -1) { labels[j - N + 1] = next; stack[sp++] = j - N + 1; }
      if (x > 0 && y < N - 1 && labels[j + N - 1] === -1) { labels[j + N - 1] = next; stack[sp++] = j + N - 1; }
      if (x < N - 1 && y < N - 1 && labels[j + N + 1] === -1) { labels[j + N + 1] = next; stack[sp++] = j + N + 1; }
    }
    next++;
  }
  const stLabel = [];
  const counts = new Map();
  for (const st of stations.list) {
    const cx = clamp((st.u * N) | 0, 0, N - 1), cy = clamp((st.v * N) | 0, 0, N - 1);
    let lab = 0, bd = 1e9;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const l = labels[y * N + x], d = dx * dx + dy * dy;
      if (l > 0 && d < bd) { bd = d; lab = l; }
    }
    stLabel.push(lab);
    if (lab) counts.set(lab, (counts.get(lab) || 0) + 1);
  }
  const newly = [], searching = [];
  // A near-uniformly lit field (the opening haze) has no tubes yet: nothing counts as linked.
  const saturated = !allowLink || lit > N * N * SAT_FRAC;
  stations.list.forEach((st, i) => {
    const l = stLabel[i];
    const linked = !saturated && l > 0 && counts.get(l) >= 2;
    if (linked && !st.everLinked) { st.everLinked = true; st.flash = now; newly.push({ st, index: i }); }
    st.linked = linked;
    if (linked) st.boost = 1;
    else if (now - st.born > 15000 && now - st.lastAid > 5000) { st.lastAid = now; st.boost = 1.5; searching.push(st); }
  });
  const km = Math.round(lit * (100 / N) / 1.6);
  return { expoTarget, km, newly, searching, litFrac: lit / (N * N) };
}
