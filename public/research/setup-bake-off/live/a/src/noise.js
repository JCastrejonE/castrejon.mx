// Ruido simplex/Perlin 3D con semilla y campo curl (divergencia nula).
// Simplex 3D según Gustavson (2005), con permutación barajada por mulberry32.

/** PRNG determinista (mulberry32). Devuelve () => número en [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);
const F3 = 1 / 3;
const G3 = 1 / 6;

/** Crea una función noise3(x, y, z) -> [-1, 1] determinista para la semilla. */
export function createNoise3D(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }

  function corner(t, x, y, z, gi) {
    if (t < 0) return 0;
    t *= t;
    const g = gi * 3;
    return t * t * (GRAD3[g] * x + GRAD3[g + 1] * y + GRAD3[g + 2] * z);
  }

  return function noise3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    const n =
      corner(0.5 - x0 * x0 - y0 * y0 - z0 * z0, x0, y0, z0,
        permMod12[ii + perm[jj + perm[kk]]]) +
      corner(0.5 - x1 * x1 - y1 * y1 - z1 * z1, x1, y1, z1,
        permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]) +
      corner(0.5 - x2 * x2 - y2 * y2 - z2 * z2, x2, y2, z2,
        permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]) +
      corner(0.5 - x3 * x3 - y3 * y3 - z3 * z3, x3, y3, z3,
        permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]);
    // Radio 0.5 (no el 0.6 de Gustavson, que es discontinuo y rompe el curl).
    // 76 escala el máximo medido (≈0.0130) a ≈[-1, 1]; el recorte garantiza la cota.
    return Math.max(-1, Math.min(1, 76 * n));
  };
}

/**
 * Campo curl 2D a partir de noise3: devuelve [vx, vy] con divergencia ≈ 0.
 * Usa noise3(x, y, t) como función de corriente ψ: v = (∂ψ/∂y, −∂ψ/∂x),
 * con diferencias centrales de paso eps.
 */
export function curl2(noise3, x, y, t, eps = 1e-4) {
  const dy = noise3(x, y + eps, t) - noise3(x, y - eps, t);
  const dx = noise3(x + eps, y, t) - noise3(x - eps, y, t);
  return [dy / (2 * eps), -dx / (2 * eps)];
}
