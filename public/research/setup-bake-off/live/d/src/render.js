import { toneLUT, hexToRgb } from './core/tone.js';

const LUT_SIZE = 1024;
const LUT_RANGE = 6; // lut covers u = v * exposure in [0, 6]
// a power curve on top of the tone map keeps faint trails dark so filaments read crisply
const LUT = toneLUT(LUT_SIZE, LUT_RANGE, 1).map((v) => v ** 1.6);
const LUT_SCALE = (LUT_SIZE - 1) / LUT_RANGE;
const BLOOM_DOWNSCALE = 4;

/**
 * Draws the trail fields as additive, tone-mapped colour into a grid-sized buffer,
 * then scales it to the screen with a cheap downsample-upsample bloom on top.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const grid = document.createElement('canvas');
  const gctx = grid.getContext('2d');
  const bloom = document.createElement('canvas');
  const bctx = bloom.getContext('2d');
  let image = null, pixels = null;
  let palette = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bg = [0, 0, 0];
  let exposure = 0.1;

  function resize(w, h) {
    grid.width = w; grid.height = h;
    bloom.width = Math.max(1, Math.round(w / BLOOM_DOWNSCALE));
    bloom.height = Math.max(1, Math.round(h / BLOOM_DOWNSCALE));
    image = gctx.createImageData(w, h);
    pixels = new Uint32Array(image.data.buffer); // little-endian: 0xAABBGGRR
  }

  function setPalette(preset) {
    palette = preset.colors.map((c) => hexToRgb(c).map((v) => v / 255));
    bg = hexToRgb(preset.background);
  }

  function draw(sim) {
    const [t0, t1, t2] = sim.trails;
    const food = sim.food;
    const [c0, c1, c2] = palette;
    const n = t0.length;
    const k = exposure * LUT_SCALE;
    const top = LUT_SIZE - 1;
    let litSum = 0, litCount = 0;

    for (let i = 0; i < n; i++) {
      const a = t0[i], b = t1[i], c = t2[i];
      const m = a > b ? (a > c ? a : c) : b > c ? b : c;
      if (m > 0.05) { litSum += m; litCount++; }
      // clamp before truncating so huge values cannot overflow the int conversion
      const ua = a * k, ub = b * k, uc = c * k;
      const ia = ua > top ? top : ua | 0, ib = ub > top ? top : ub | 0, ic = uc > top ? top : uc | 0;
      const ta = LUT[ia], tb = LUT[ib], tc = LUT[ic];

      let r = bg[0] + 255 * (c0[0] * ta + c1[0] * tb + c2[0] * tc);
      let g = bg[1] + 255 * (c0[1] * ta + c1[1] * tb + c2[1] * tc);
      let bl = bg[2] + 255 * (c0[2] * ta + c1[2] * tb + c2[2] * tc);

      const f = food[i];
      if (f > 0.02) { // food glows a soft warm white
        const q = f > 40 ? 40 : f;
        r += q * 2.6; g += q * 2.3; bl += q * 1.8;
      } else if (f < -0.02) { // repellent is a dim violet haze
        const q = f < -40 ? 40 : -f;
        r += q * 1.2; g += q * 0.25; bl += q * 2.4;
      }
      if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255;
      pixels[i] = 0xff000000 | (bl << 16) | (g << 8) | r;
    }

    // auto-exposure: map the mean lit intensity to u = 0.55 on the tone curve, eased over frames
    if (litCount > 0) {
      const target = 0.55 / (litSum / litCount);
      exposure += (target - exposure) * 0.05;
    }

    gctx.putImageData(image, 0, 0);
    const W = canvas.width, H = canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(grid, 0, 0, W, H);

    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(grid, 0, 0, bloom.width, bloom.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32;
    ctx.drawImage(bloom, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  return { resize, setPalette, draw };
}
