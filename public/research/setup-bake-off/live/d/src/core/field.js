/** Toroidal index wrap that is correct for negative inputs. */
export function wrap(i, n) {
  return ((i % n) + n) % n;
}

/**
 * Wrap a float coordinate that is at most one grid length out of range.
 * The second check catches float rounding, e.g. -1e-15 + 64 === 64.
 */
export function wrapCoord(v, n) {
  v = v < 0 ? v + n : v >= n ? v - n : v;
  return v >= n || v < 0 ? 0 : v;
}

/**
 * In-place diffuse + decay of a toroidal scalar field.
 * A separable 3x3 box blur is mixed with the original by `rate`, then scaled by `decay`.
 * `scratch` must be the same length as `field`.
 */
export function diffuse(field, scratch, w, h, rate, decay) {
  const third = 1 / 3;
  // horizontal pass: field -> scratch
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let left = field[row + w - 1];
    let mid = field[row];
    for (let x = 0; x < w; x++) {
      const right = field[row + (x + 1 === w ? 0 : x + 1)];
      scratch[row + x] = (left + mid + right) * third;
      left = mid;
      mid = right;
    }
  }
  // vertical pass: scratch -> field (each write only reads field at the same index)
  const keep = (1 - rate) * decay;
  const blur = rate * decay * third;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const up = (y === 0 ? h - 1 : y - 1) * w;
    const down = (y + 1 === h ? 0 : y + 1) * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      field[i] = field[i] * keep + (scratch[up + x] + scratch[i] + scratch[down + x]) * blur;
    }
  }
}

/**
 * Add a soft circular brush of `amount` (may be negative) centred on (cx, cy), wrapping at edges.
 * Values are clamped to [-limit, limit] so scribbling on one spot cannot drown out the trails.
 */
export function paint(field, w, h, cx, cy, radius, amount, limit = Infinity) {
  const r = Math.ceil(radius);
  const r2 = radius * radius;
  const ix = Math.round(cx), iy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const y = wrap(iy + dy, h) * w;
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const k = 1 - d2 / r2;
      const i = y + wrap(ix + dx, w);
      const v = field[i] + amount * k * k;
      field[i] = v > limit ? limit : v < -limit ? -limit : v;
    }
  }
}

export function decayField(field, decay) {
  for (let i = 0; i < field.length; i++) field[i] *= decay;
}
