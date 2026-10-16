// Canvas2D fallback: same rules as the GPU path, on typed arrays at CSS size / 4.
import { mulberry32, gauss, clamp } from './rng.js';
import { TUNE } from './gpu.js';

export const CPU_TIERS = [40000, 30000, 22000, 15000, 8000];
const LUTN = 1024;

export class CPURenderer {
  constructor(canvas) {
    this.kind = 'cpu';
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('no 2d context');
    this.expo = 3;
    this.bloom = false;
    this.seedCounter = 0;
    this.probeData = new Uint8Array(128 * 128 * 4);
    this.pending = null;
    this.lutExpo = -1;
    this.stVersion = -1;
  }

  init(cssW, cssH, opts) {
    this.seed = opts.seed >>> 0;
    this.stationsRef = opts.stations;
    this.rand = mulberry32(this.seed ^ 0x5bd1e995);
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.resize(cssW, cssH, opts.dpr, opts.simScale);
    this.tier = -1;
    this.setAgentTier(opts.tier, true);
    this.reseed('random');
  }

  resize(cssW, cssH, dpr) {
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    // Trail at CSS / 3 (CSS / 4 on very large windows) keeps the tubes crisp enough.
    this.div = cssW * cssH > 2.0e6 ? 4 : 3;
    const TW = Math.max(16, Math.round(cssW / this.div)), TH = Math.max(16, Math.round(cssH / this.div));
    this.k = clamp(cssH / 720, 0.6, 2.0) / this.div;
    if (TW !== this.TW || TH !== this.TH) {
      const old = this.trail, oTW = this.TW, oTH = this.TH;
      const n = TW * TH;
      this.trail = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
      this.tmp = new Float32Array(n);
      this.food = new Float32Array(n);
      this.rep = new Float32Array(n);
      if (old) { // nearest-neighbour rescale of the old trail
        for (let c = 0; c < 3; c++) for (let y = 0; y < TH; y++) {
          const oy = Math.min(oTH - 1, (y * oTH / TH) | 0);
          for (let x = 0; x < TW; x++) this.trail[c][y * TW + x] = old[c][oy * oTW + Math.min(oTW - 1, (x * oTW / TW) | 0)];
        }
        if (this.x) for (let i = 0; i < this.N; i++) { this.x[i] *= TW / oTW; this.y[i] *= TH / oTH; }
      }
      this.TW = TW; this.TH = TH;
      this.off.width = TW; this.off.height = TH;
      this.img = this.offCtx.createImageData(TW, TH);
      this.stVersion = -1;
    }
    this.buildVignette();
  }

  buildVignette() {
    const W = this.canvas.width, H = this.canvas.height;
    const v = document.createElement('canvas'); v.width = W; v.height = H;
    const c = v.getContext('2d');
    const r = Math.hypot(W, H) / 2;
    const g = c.createRadialGradient(W / 2, H / 2, r * 0.5, W / 2, H / 2, r * 1.3);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    this.vignette = v;
  }

  setAgentTier(i) {
    i = clamp(i | 0, 0, CPU_TIERS.length - 1);
    if (i === this.tier) return;
    const N = CPU_TIERS[i];
    const nx = new Float32Array(N), ny = new Float32Array(N), nt = new Float32Array(N);
    const keep = this.x ? Math.min(N, this.N) : 0;
    if (keep) { nx.set(this.x.subarray(0, keep)); ny.set(this.y.subarray(0, keep)); nt.set(this.th.subarray(0, keep)); }
    this.x = nx; this.y = ny; this.th = nt; this.N = N; this.tier = i;
    if (keep < N) this.seedRange('random', keep, N);
  }
  get agentCount() { return this.N; }

  seedRange(mode, from, to, center) {
    const rand = mulberry32((this.seed + 7919 * ++this.seedCounter) >>> 0);
    const TW = this.TW, TH = this.TH, mn = Math.min(TW, TH), k = this.k, st = this.stationsRef || [];
    if (mode === 'nodes' && !st.length) mode = 'disc';
    for (let i = from; i < to; i++) {
      let x, y, th;
      if (center) {
        const a = rand() * Math.PI * 2, r = (24 + rand() * 30) * k;
        x = center[0] + Math.cos(a) * r; y = center[1] + Math.sin(a) * r; th = a;
      } else if (mode === 'disc') {
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.35 * mn;
        x = TW / 2 + Math.cos(a) * r; y = TH / 2 + Math.sin(a) * r; th = a;
      } else if (mode === 'ring') {
        const a = rand() * Math.PI * 2, r = 0.4 * mn;
        x = TW / 2 + Math.cos(a) * r; y = TH / 2 + Math.sin(a) * r; th = a + Math.PI;
      } else if (mode === 'nodes') {
        const s = st[i % st.length];
        x = s.u * TW + gauss(rand) * 30 * this.k; y = s.v * TH + gauss(rand) * 30 * this.k; th = rand() * Math.PI * 2;
      } else { x = rand() * TW; y = rand() * TH; th = rand() * Math.PI * 2; }
      this.x[i] = clamp(x, 1, TW - 1); this.y[i] = clamp(y, 1, TH - 1); this.th[i] = th;
    }
  }
  reseed(mode) { this.seedRange(mode, 0, this.N); }
  respawnRing(u, v, frac) {
    const n = Math.ceil(this.N * frac), s = Math.floor(Math.random() * (this.N - n));
    this.seedRange('ring', s, s + n, [u * this.TW, v * this.TH]);
  }
  clearTrail() { for (const c of this.trail) c.fill(0); }
  clearField() { this.rep.fill(0); }

  setPalette(c0, c1, c2) { this.pal = { c0, c1, c2 }; this.lutExpo = -1; }

  splat(arr, cx, cy, sigma, amp, max = Infinity) {
    const TW = this.TW, TH = this.TH, R = Math.ceil(sigma * 3);
    const x0 = Math.max(0, (cx - R) | 0), x1 = Math.min(TW - 1, (cx + R) | 0);
    const y0 = Math.max(0, (cy - R) | 0), y1 = Math.min(TH - 1, (cy + R) | 0);
    const inv = 1 / (2 * sigma * sigma);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, i = y * TW + x;
      arr[i] = Math.min(max, arr[i] + amp * Math.exp(-(dx * dx + dy * dy) * inv));
    }
  }

  step(p, world, substeps) {
    const TW = this.TW, TH = this.TH, k = this.k, n = TW * TH;
    const st = world.stations, L = world.level, WF = TUNE.wfood * L, WR = TUNE.wrep * L;
    // Field: food recomputed when stations change; repellent decays.
    if (world.stationsVersion !== this.stVersion) {
      this.stVersion = world.stationsVersion;
      const f = this.food; f.fill(0);
      const sig = TUNE.fsig * k, inv = 1 / (2 * sig * sig), R = sig * 3;
      for (const s of st) {
        const cx = s.u * TW, cy = s.v * TH;
        for (let y = Math.max(0, (cy - R) | 0); y < Math.min(TH, cy + R); y++)
          for (let x = Math.max(0, (cx - R) | 0); x < Math.min(TW, cx + R); x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, v = Math.exp(-(dx * dx + dy * dy) * inv), i = y * TW + x;
            if (v > f[i]) f[i] = v;
          }
      }
    }
    const rep = this.rep;
    for (let i = 0; i < n; i++) if (rep[i] > 0) rep[i] = rep[i] > 0.002 ? rep[i] * 0.992 : 0;
    for (const l of world.lakes) this.splat(rep, l.u * TW, l.v * TH, 28 * k * 0.55, l.amp, 1);
    for (const s of world.seeds) for (let c = 0; c < p.species; c++) this.splat(this.trail[c], s.u * TW, s.v * TH, 14 * k * 0.5, 1.0 * L);

    const SA = p.SA, RA = p.RA, SO = p.SO * k, SS = p.SS * k, jit = 0.05, spc = p.species, riv = p.rivalry;
    const T = this.trail, food = this.food, rand = this.rand, N = this.N;
    const X = this.x, Y = this.y, TH_ = this.th;
    const dep = 0.35, sat = TUNE.sat / L;
    // Churn (see gpu.js).
    const nc = Math.floor(N * TUNE.churn * substeps + rand());
    if (nc > 0) { const s0 = Math.floor(rand() * (N - nc)); this.seedRange('random', s0, s0 + nc); }
    // One sensor closure per step() call (not per agent): reads the loop's x, y, sp.
    let x = 0, y = 0, th = 0, sp = 0;
    const sense = (a) => {
      let px = (x + Math.cos(a) * SO) | 0, py = (y + Math.sin(a) * SO) | 0;
      if (px < 0) px = 0; else if (px >= TW) px = TW - 1;
      if (py < 0) py = 0; else if (py >= TH) py = TH - 1;
      const j = py * TW + px;
      let v;
      const t0 = T[0][j] / (1 + T[0][j] * sat);
      if (spc === 1) v = t0;
      else {
        const t1 = T[1][j] / (1 + T[1][j] * sat), t2 = T[2][j] / (1 + T[2][j] * sat);
        const ts = sp === 0 ? t0 : sp === 1 ? t1 : t2;
        v = (1 + riv) * ts - riv * (t0 + t1 + t2);
      }
      return v + WF * food[j] - WR * rep[j];
    };
    for (let sub = 0; sub < substeps; sub++) {
      for (let i = 0; i < N; i++) {
        sp = i % spc;
        x = X[i]; y = Y[i]; th = TH_[i];
        const F = sense(th), FL = sense(th + SA), FR = sense(th - SA);
        const r1 = rand();
        if (F > FL && F > FR) { /* straight */ }
        else if (F < FL && F < FR) th += r1 < 0.5 ? RA : -RA;
        else if (FL > FR) th += RA;
        else if (FR > FL) th -= RA;
        th += (rand() - 0.5) * jit;
        x += SS * Math.cos(th); y += SS * Math.sin(th);
        if (!(x === x) || !(y === y) || !(th === th)) { x = rand() * TW; y = rand() * TH; th = rand() * 6.283; }
        else if (x < 1 || y < 1 || x > TW - 1 || y > TH - 1) {
          x = clamp(x, 1, TW - 1); y = clamp(y, 1, TH - 1); th = rand() * Math.PI * 2;
        }
        X[i] = x; Y[i] = y; TH_[i] = th;
        T[sp][(y | 0) * TW + (x | 0)] += dep;
      }
      for (const s of st) for (let c = 0; c < spc; c++) this.splat(T[c], s.u * TW, s.v * TH, Math.max(1.5, 6 * k), TUNE.samp * L * (1 - p.decay) * (s.boost || 1) / spc);
      // Diffuse + decay: separable 3x3 box.
      const tmp = this.tmp, dec = p.decay, df = p.diffuse * 0.4; // coarser grid: less blur per step
      for (let c = 0; c < 3; c++) {
        const a = T[c];
        for (let y = 0; y < TH; y++) {
          const r = y * TW;
          tmp[r] = (a[r] * 2 + a[r + 1]) / 3;
          for (let x = 1; x < TW - 1; x++) tmp[r + x] = (a[r + x - 1] + a[r + x] + a[r + x + 1]) / 3;
          tmp[r + TW - 1] = (a[r + TW - 2] + a[r + TW - 1] * 2) / 3;
        }
        for (let y = 0; y < TH; y++) {
          const up = y > 0 ? -TW : 0, dn = y < TH - 1 ? TW : 0, r = y * TW;
          for (let x = 0; x < TW; x++) {
            const i = r + x;
            const b = (tmp[i + up] + tmp[i] + tmp[i + dn]) / 3;
            let v = (a[i] + (b - a[i]) * df) * dec;
            a[i] = v > 50 ? 50 : v < 1e-4 ? 0 : v;
          }
        }
      }
    }
  }

  buildLUT() {
    this.lutExpo = this.expo;
    const rawMax = 7 / this.expo;
    this.lutScale = LUTN / rawMax;
    const { c0, c1, c2 } = this.pal;
    this.luts = [0, 1, 2].map((s) => {
      const L = new Float32Array(LUTN * 3);
      for (let i = 0; i < LUTN; i++) {
        const v = 1 - Math.exp(-this.expo * (i / this.lutScale));
        let col;
        if (v < 0.55) { const t = sm(v / 0.55); col = mix3(c0[s], c1[s], t); }
        else { const t = sm((v - 0.55) / 0.45); col = mix3(c1[s], c2[s], t); }
        L[i * 3] = col[0] * v; L[i * 3 + 1] = col[1] * v; L[i * 3 + 2] = col[2] * v;
      }
      return L;
    });
    this.clip = new Uint8Array(LUTN);
    for (let i = 0; i < LUTN; i++) this.clip[i] = Math.round(255 * (1 - Math.exp(-(i / LUTN) * 3 * 1.35)));
  }

  render() {
    if (Math.abs(this.lutExpo - this.expo) > 1e-3) this.buildLUT();
    const d = this.img.data, T = this.trail, n = this.TW * this.TH, s = this.lutScale, cl = this.clip;
    const L0 = this.luts[0], L1 = this.luts[1], L2 = this.luts[2], M = LUTN - 1, cs = LUTN / 3;
    const bg = [0.027, 0.031, 0.043];
    for (let i = 0; i < n; i++) {
      let r = bg[0], g = bg[1], b = bg[2];
      let a = T[0][i];
      if (a > 0) { const j = Math.min(M, (a * s) | 0) * 3; r += L0[j]; g += L0[j + 1]; b += L0[j + 2]; }
      a = T[1][i];
      if (a > 0) { const j = Math.min(M, (a * s) | 0) * 3; r += L1[j]; g += L1[j + 1]; b += L1[j + 2]; }
      a = T[2][i];
      if (a > 0) { const j = Math.min(M, (a * s) | 0) * 3; r += L2[j]; g += L2[j + 1]; b += L2[j + 2]; }
      const o = i * 4;
      d[o] = cl[Math.min(M, (r * cs) | 0)]; d[o + 1] = cl[Math.min(M, (g * cs) | 0)]; d[o + 2] = cl[Math.min(M, (b * cs) | 0)]; d[o + 3] = 255;
    }
    this.offCtx.putImageData(this.img, 0, 0);
    this.draw(this.ctx, this.canvas.width, this.canvas.height);
  }
  draw(ctx, W, H) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.off, 0, 0, W, H);
    ctx.drawImage(this.vignette, 0, 0, W, H);
  }

  requestProbe() {
    const N = 128, TW = this.TW, TH = this.TH, T = this.trail, P = this.probeData, e = this.expo;
    for (let py = 0; py < N; py++) {
      const y0 = Math.floor(py * TH / N), y1 = Math.max(y0 + 1, Math.floor((py + 1) * TH / N));
      for (let px = 0; px < N; px++) {
        const x0 = Math.floor(px * TW / N), x1 = Math.max(x0 + 1, Math.floor((px + 1) * TW / N));
        let m0 = 0, m1 = 0, m2 = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = y * TW + x;
          if (T[0][i] > m0) m0 = T[0][i]; if (T[1][i] > m1) m1 = T[1][i]; if (T[2][i] > m2) m2 = T[2][i];
        }
        const raw = Math.max(m0, m1, m2), o = (py * N + px) * 4;
        P[o] = Math.round(255 * (1 - Math.exp(-e * raw)));
        P[o + 1] = m0 >= raw ? 0 : m1 >= raw ? 128 : 255;
        P[o + 2] = Math.round(255 * Math.sqrt(Math.min(raw / 16, 1)));
        P[o + 3] = 255;
      }
    }
    this.pending = P;
  }
  pollProbe() { const p = this.pending; this.pending = null; return p; }
  analyze() { this.requestProbe(); return this.pollProbe(); }

  posterPixels() {
    let W = this.canvas.width * 2, H = this.canvas.height * 2;
    const f = Math.min(1, 4096 / Math.max(W, H)); W = Math.round(W * f); H = Math.round(H * f);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    this.draw(ctx, W, H);
    return ctx.getImageData(0, 0, W, H);
  }
  destroy() {}
}

function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
