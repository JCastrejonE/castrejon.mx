// Turns the simulation fields into pixels.
//
// Pipeline per frame:
//   trails -> auto exposure (running high percentile) -> tone curve 1-exp(-kv)
//   -> palette LUT -> ImageData on a grid-sized canvas
//   -> smoothed upscale to the screen -> cheap bloom (1/4-scale copy, 'lighter')
// Overlays (food rings, MST, crosshair) are drawn by main.js on top.

import { buildLut, hexToRgb, SPECIES_COLORS } from './palettes.js';

// 1 - exp(-x) for x in [0, TONE_MAX), so the per-pixel loop avoids Math.exp.
const TONE_N = 2048, TONE_MAX = 8, TONE_SCALE = TONE_N / TONE_MAX;
const TONE = new Float32Array(TONE_N + 1);
for (let i = 0; i <= TONE_N; i++) TONE[i] = 1 - Math.exp(-i / TONE_SCALE);
const tone = (x) => TONE[x >= TONE_MAX ? TONE_N : (x * TONE_SCALE) | 0];

const HOT_DARK = [255, 250, 236];
const HOT_LIGHT = [20, 14, 8];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const grid = document.createElement('canvas');
  const gctx = grid.getContext('2d');
  const bloom = document.createElement('canvas');
  const bctx = bloom.getContext('2d');
  const r = {
    canvas, ctx, grid, gctx, bloom, bctx,
    image: null,
    palette: null,
    lut: null,
    bg: [0, 0, 0],
    species: SPECIES_COLORS.map(hexToRgb),
    exposure: 8,   // trail value that maps to ~90% brightness
    frame: 0,
  };
  return r;
}

export function setPalette(r, palette) {
  r.palette = palette;
  r.lut = buildLut(palette.ramp);
  r.bg = hexToRgb(palette.ramp[0]);
}

function ensureSize(r, W, H) {
  if (r.grid.width !== W || r.grid.height !== H) {
    r.grid.width = W;
    r.grid.height = H;
    r.image = r.gctx.createImageData(W, H);
    r.bloom.width = Math.max(1, Math.round(W / 4));
    r.bloom.height = Math.max(1, Math.round(H / 4));
  }
}

// Estimate a high percentile of the combined trail by sampling, and ease the
// exposure toward it so brightness adapts as the network thickens or thins.
const SAMPLE_CAP = 6000;
const samples = new Float32Array(SAMPLE_CAP + 64);

function exposureTarget(r, sim) {
  const { trails, width: W, height: H } = sim;
  const stride = Math.max(1, Math.floor((W * H) / SAMPLE_CAP));
  let n = 0;
  for (let i = (r.frame * 7) % stride; i < W * H && n < samples.length; i += stride) {
    let v = 0;
    for (const t of trails) v += t[i];
    if (v > 0.05) samples[n++] = v;
  }
  if (n < 20) return null;
  const sorted = samples.subarray(0, n).sort();
  return Math.max(2, sorted[Math.floor(n * 0.97)]);
}

function updateExposure(r, sim) {
  const target = exposureTarget(r, sim);
  if (target !== null) r.exposure += (target - r.exposure) * 0.08;
}

// Jump straight to the right exposure (used before showing a still frame).
export function snapExposure(r, sim) {
  const target = exposureTarget(r, sim);
  if (target !== null) r.exposure = target;
}

export function renderField(r, sim, { freezeExposure = false } = {}) {
  const W = sim.width, H = sim.height;
  ensureSize(r, W, H);
  if (!freezeExposure && r.frame % 4 === 0) updateExposure(r, sim);
  r.frame++;

  const data = r.image.data;
  const k = 2.3 / r.exposure; // 1 - exp(-2.3) ~ 0.9 at the exposure point
  const food = sim.food, walls = sim.walls, wallsActive = sim.wallsActive;
  const light = r.palette.light;
  const n = W * H;

  if (sim.species === 1) {
    const t = sim.trails[0];
    const lut = r.lut;
    for (let i = 0; i < n; i++) {
      const v = t[i] + food[i] * 0.04;
      let tn = tone(v * k);
      if (wallsActive && walls[i] > 0.02) tn = tn * (1 - walls[i]) + 0.14 * walls[i];
      const li = ((tn * 255) | 0) * 3;
      const o = i * 4;
      data[o] = lut[li];
      data[o + 1] = lut[li + 1];
      data[o + 2] = lut[li + 2];
      data[o + 3] = 255;
    }
  } else {
    // Each species tints toward its colour; overlaps and dense cores go white-hot
    // (or ink-black on the light palette).
    const [br, bgc, bb] = r.bg;
    const cols = r.species;
    const hot = light ? HOT_LIGHT : HOT_DARK;
    const S = sim.species;
    const trails = sim.trails;
    for (let i = 0; i < n; i++) {
      let cr = br, cg = bgc, cb = bb, sum = 0;
      for (let s = 0; s < S; s++) {
        const tn = tone(trails[s][i] * k);
        sum += tn;
        const c = cols[s];
        cr += (c[0] - br) * tn;
        cg += (c[1] - bgc) * tn;
        cb += (c[2] - bb) * tn;
      }
      const f = tone(food[i] * 0.04 * k);
      const heat = Math.max(0, Math.min(1, sum - 0.85)) * 0.8 + f * 0.5;
      cr += (hot[0] - cr) * heat;
      cg += (hot[1] - cg) * heat;
      cb += (hot[2] - cb) * heat;
      if (wallsActive && walls[i] > 0.02) {
        const w = walls[i] * 0.6;
        cr += (br * 1.8 + 20 - cr) * w;
        cg += (bgc * 1.8 + 20 - cg) * w;
        cb += (bb * 1.8 + 20 - cb) * w;
      }
      const o = i * 4;
      data[o] = cr;
      data[o + 1] = cg;
      data[o + 2] = cb;
      data[o + 3] = 255;
    }
  }
  r.gctx.putImageData(r.image, 0, 0);

  const { ctx, canvas } = r;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(r.grid, 0, 0, canvas.width, canvas.height);

  // Bloom: a quarter-size copy blown back up is a free blur.
  r.bctx.imageSmoothingEnabled = true;
  r.bctx.drawImage(r.grid, 0, 0, r.bloom.width, r.bloom.height);
  ctx.globalCompositeOperation = light ? 'multiply' : 'lighter';
  ctx.globalAlpha = light ? 0.25 : 0.32;
  ctx.drawImage(r.bloom, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}
