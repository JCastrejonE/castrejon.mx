/**
 * Exponential tone-mapping lookup table: lut[i] = 1 - exp(-v * k) for v spanning [0, max].
 * Keeps bright, overlapping trails from clipping to flat white.
 */
export function toneLUT(size, max, k) {
  const lut = new Float32Array(size);
  for (let i = 0; i < size; i++) lut[i] = 1 - Math.exp(-(i / (size - 1)) * max * k);
  return lut;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
