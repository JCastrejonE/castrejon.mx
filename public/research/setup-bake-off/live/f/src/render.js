// Mycelia renderer: sim.trail (Float32 w*h*3 interleaved) -> glowing image.
//
// Per frame: each species channel is tone-mapped with 1 - exp(-k*v) through a
// precomputed lookup table, blended onto the palette background (additively,
// or "ink"-style darkening for light palettes), written into a reusable
// ImageData at sim resolution, then scaled up onto the visible canvas with
// high-quality smoothing. A cheap bloom is layered on top from a blurred,
// quarter-size copy. Exposure (k) adapts slowly to the trail's brightness so
// the network never blows out or fades to black whatever the sim's scale.

export const PALETTES = [
  {
    name: 'Bioluminescent',
    bg: [3, 6, 14],
    colors: [[40, 230, 200], [120, 110, 255], [255, 70, 170]],
    glow: 0.55,
  },
  {
    name: 'Ember',
    bg: [10, 4, 3],
    colors: [[255, 120, 30], [255, 205, 90], [200, 30, 40]],
    glow: 0.5,
  },
  {
    name: 'Aurora',
    bg: [2, 8, 12],
    colors: [[70, 255, 140], [60, 170, 255], [210, 90, 255]],
    glow: 0.55,
  },
  {
    name: 'Ink',
    bg: [241, 236, 226],
    colors: [[18, 28, 48], [150, 40, 30], [40, 95, 90]],
    mode: 'ink',
    glow: 0.25,
  },
  {
    name: 'Spectral',
    bg: [6, 5, 10],
    colors: [[255, 80, 80], [80, 255, 120], [90, 130, 255]],
    glow: 0.5,
  },
  {
    name: 'Moonlight',
    bg: [5, 6, 9],
    colors: [[210, 225, 255], [150, 160, 190], [255, 225, 190]],
    glow: 0.45,
  },
];

// LUT is indexed by x = k*v over [0, X_MAX); 1 - exp(-6) ~ 0.9975, so the
// top of the table is already saturated.
const LEVELS = 2048;
const X_MAX = 6;
const IDX_SCALE = LEVELS / X_MAX;

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.image = null;
    this.pixels = null; // Uint32Array view of image.data

    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d');
    this.glowCtx.filter = 'blur(2px)';
    this.hasFilter = this.glowCtx.filter === 'blur(2px)';
    this.glowCtx.filter = 'none';
    this.glowEnabled = true;

    // Exposure: k is multiplied onto trail values before LUT lookup.
    this.autoExposure = true;
    this.exposure = 1; // user multiplier on top of auto
    this.k = 2.5;
    this._frame = 0;
    this._settle = 30;   // frames of per-frame, fast exposure tracking
    this._lastTick = -1;
    this._samples = new Float32Array(2048);

    // Per species: Int16 contribution per level per channel (r,g,b).
    this.lut = [0, 1, 2].map(() => new Int16Array(LEVELS * 3));
    this.paletteIndex = 0;
    this.palette = PALETTES[0];
    this._vignette = null;
    this._vignetteKey = '';
    this.setPalette(0);
  }

  setPalette(index) {
    const n = PALETTES.length;
    this.paletteIndex = ((index % n) + n) % n;
    const p = (this.palette = PALETTES[this.paletteIndex]);
    const ink = p.mode === 'ink';
    const [br, bg, bb] = p.bg;
    for (let s = 0; s < 3; s++) {
      const [cr, cg, cb] = p.colors[s];
      const t = this.lut[s];
      for (let i = 0; i < LEVELS; i++) {
        const x = (i + 0.5) / IDX_SCALE;
        const a = 1 - Math.exp(-x);
        let r, g, b;
        if (ink) {
          // Pull the paper colour toward the ink colour; dense veins go
          // slightly darker than the ink itself.
          const d = a * (1 + 0.25 * a * a);
          r = (cr - br) * d;
          g = (cg - bg) * d;
          b = (cb - bb) * d;
        } else {
          // Additive light; the hottest cores bleach toward white.
          const w = a * a * a * a * 0.45;
          r = (cr + (255 - cr) * w) * a;
          g = (cg + (255 - cg) * w) * a;
          b = (cb + (255 - cb) * w) * a;
        }
        t[i * 3] = Math.round(r);
        t[i * 3 + 1] = Math.round(g);
        t[i * 3 + 2] = Math.round(b);
      }
    }
    this._vignetteKey = '';
  }

  _ensureSize(w, h) {
    if (!this.image || this.image.width !== w || this.image.height !== h) {
      this.off.width = w;
      this.off.height = h;
      this.image = this.offCtx.createImageData(w, h);
      this.pixels = new Uint32Array(this.image.data.buffer);
      this.glowCanvas.width = Math.max(1, Math.round(w / 4));
      this.glowCanvas.height = Math.max(1, Math.round(h / 4));
    }
  }

  _updateExposure(sim) {
    const trail = sim.trail;
    const cells = sim.width * sim.height;
    const n = this._samples.length;
    const species = sim.species;
    // Deterministic-but-shifting sample positions across frames.
    let idx = (this._frame * 7919) % cells;
    const stride = Math.max(1, Math.floor(cells / n)) | 0;
    let count = 0;
    for (let j = 0; j < n; j++) {
      const o = idx * 3;
      let m = trail[o];
      if (species > 1 && trail[o + 1] > m) m = trail[o + 1];
      if (species > 2 && trail[o + 2] > m) m = trail[o + 2];
      this._samples[count++] = m;
      idx += stride;
      if (idx >= cells) idx -= cells;
    }
    const s = this._samples.subarray(0, count).sort();
    // Veins occupy a minority of cells; map the upper percentile to ~0.65 so cores keep detail.
    const p = s[Math.floor(count * 0.98)];
    if (p > 1e-5 && isFinite(p)) {
      const target = Math.min(200, Math.max(0.2, 1.05 / p));
      // Snap when far off (first frames, reseed); otherwise drift gently.
      const far = target > this.k * 1.5 || target < this.k / 1.5;
      this.k += (target - this.k) * (this._frame === 0 ? 1 : this._settle > 0 || far ? 0.5 : 0.08);
    }
  }

  draw(sim) {
    const w = sim.width, h = sim.height;
    this._ensureSize(w, h);
    // A falling tick counter means the sim was reset: re-settle exposure.
    if (typeof sim.tick === 'number') {
      if (sim.tick < this._lastTick) this._settle = 30;
      this._lastTick = sim.tick;
    }
    if (this.autoExposure && (this._settle > 0 || (this._frame & 3) === 0)) this._updateExposure(sim);
    this._frame++;
    if (this._settle > 0) this._settle--;

    const trail = sim.trail;
    const px = this.pixels;
    const [br, bgc, bb] = this.palette.bg;
    const L0 = this.lut[0], L1 = this.lut[1], L2 = this.lut[2];
    const ks = this.k * this.exposure * IDX_SCALE;
    const maxI = LEVELS - 1;
    const species = sim.species | 0;
    const cells = w * h;
    const A = 255 << 24;

    for (let c = 0, o = 0; c < cells; c++, o += 3) {
      let i0 = (trail[o] * ks) | 0;
      i0 = i0 < 0 ? 0 : i0 > maxI ? maxI : i0;
      i0 *= 3;
      let r = br + L0[i0], g = bgc + L0[i0 + 1], b = bb + L0[i0 + 2];
      if (species > 1) {
        let i1 = (trail[o + 1] * ks) | 0;
        i1 = i1 < 0 ? 0 : i1 > maxI ? maxI : i1;
        i1 *= 3;
        r += L1[i1]; g += L1[i1 + 1]; b += L1[i1 + 2];
        if (species > 2) {
          let i2 = (trail[o + 2] * ks) | 0;
          i2 = i2 < 0 ? 0 : i2 > maxI ? maxI : i2;
          i2 *= 3;
          r += L2[i2]; g += L2[i2 + 1]; b += L2[i2 + 2];
        }
      }
      // Hue-preserving clip: scale an overflowing colour down as a whole
      // rather than flattening each channel to white.
      let m = r > g ? r : g;
      if (b > m) m = b;
      if (m > 255) {
        const f = 255 / m;
        r = (r * f) | 0; g = (g * f) | 0; b = (b * f) | 0;
      }
      r = r < 0 ? 0 : r;
      g = g < 0 ? 0 : g;
      b = b < 0 ? 0 : b;
      px[c] = LITTLE_ENDIAN ? A | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | 255;
    }
    this.offCtx.putImageData(this.image, 0, 0);

    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.off, 0, 0, cw, ch);

    if (this.glowEnabled && this.palette.glow > 0) {
      const g = this.glowCtx, gw = this.glowCanvas.width, gh = this.glowCanvas.height;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'low';
      if (this.hasFilter) g.filter = 'blur(2px)';
      g.drawImage(this.off, 0, 0, gw, gh);
      if (this.hasFilter) g.filter = 'none';
      // Without canvas filters the 4x down/upscale alone gives a soft halo.
      ctx.globalCompositeOperation = this.palette.mode === 'ink' ? 'multiply' : 'lighter';
      ctx.globalAlpha = this.palette.glow;
      ctx.drawImage(this.glowCanvas, 0, 0, cw, ch);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    this._drawVignette(cw, ch);
  }

  _drawVignette(cw, ch) {
    const key = cw + 'x' + ch + ':' + this.paletteIndex;
    if (key !== this._vignetteKey) {
      const ctx = this.ctx;
      const r = Math.hypot(cw, ch) / 2;
      const grad = ctx.createRadialGradient(cw / 2, ch / 2, r * 0.45, cw / 2, ch / 2, r);
      const [br, bg, bb] = this.palette.bg;
      const ink = this.palette.mode === 'ink';
      grad.addColorStop(0, `rgba(${br},${bg},${bb},0)`);
      grad.addColorStop(1, ink ? 'rgba(120,100,80,0.28)' : `rgba(${br},${bg},${bb},0.7)`);
      this._vignette = grad;
      this._vignetteKey = key;
    }
    this.ctx.fillStyle = this._vignette;
    this.ctx.fillRect(0, 0, cw, ch);
  }

  toPNG() {
    return this.canvas.toDataURL('image/png');
  }
}
