// Sistema de partículas con Float32Array (posición, velocidad, edad).

const MIN_LIFE = 3, MAX_LIFE = 9; // s
const INERTIA = 6;                // 1/s: rapidez con que la velocidad sigue al campo

/**
 * @param {number} count
 * @param {number} width
 * @param {number} height
 * @param {() => number} rand
 * API: x, y, px, py, vx, vy, age, life (Float32Array); count; step(field, t, dt); resize(w, h); setCount(n)
 *   (px, py) es la posición del paso anterior, para dibujar el segmento de estela;
 *   al reaparecer coincide con (x, y), así no se traza una raya a través del lienzo.
 */
export function createParticles(count, width, height, rand = Math.random) {
  const p = {
    count, width, height, rand,

    spawn(i, randomAge) {
      p.x[i] = p.px[i] = rand() * p.width;
      p.y[i] = p.py[i] = rand() * p.height;
      p.vx[i] = p.vy[i] = 0;
      p.life[i] = MIN_LIFE + rand() * (MAX_LIFE - MIN_LIFE);
      p.age[i] = randomAge ? rand() * p.life[i] : 0;
    },

    step(field, t, dt) {
      const { x, y, px, py, vx, vy, age, life } = p;
      const a = Math.min(1, dt * INERTIA);
      for (let i = 0; i < p.count; i++) {
        const [fx, fy] = field.sample(x[i], y[i], t);
        vx[i] += (fx - vx[i]) * a;
        vy[i] += (fy - vy[i]) * a;
        px[i] = x[i];
        py[i] = y[i];
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        age[i] += dt;
        if (age[i] > life[i] || !(x[i] >= 0 && x[i] < p.width && y[i] >= 0 && y[i] < p.height)) {
          p.spawn(i, false);
        }
      }
    },

    resize(w, h) { p.width = w; p.height = h; },

    /** Cambia el número de partículas conservando las existentes. */
    setCount(n) {
      n = Math.max(0, Math.floor(n));
      const keep = Math.min(n, p.count);
      for (const k of ["x", "y", "px", "py", "vx", "vy", "age", "life"]) {
        const next = new Float32Array(n);
        next.set(p[k].subarray(0, keep));
        p[k] = next;
      }
      p.count = n;
      for (let i = keep; i < n; i++) p.spawn(i, true);
    },
  };
  for (const k of ["x", "y", "px", "py", "vx", "vy", "age", "life"]) p[k] = new Float32Array(count);
  for (let i = 0; i < count; i++) p.spawn(i, true);
  return p;
}
