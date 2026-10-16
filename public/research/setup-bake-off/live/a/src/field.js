// Campo vectorial: ruido curl animado + perturbaciones del usuario.
// Unidades: posiciones en píxeles CSS, tiempo en segundos, velocidades en px/s.
import { curl2 } from "./noise.js";

export const MAX_WELLS = 8;
const MAX_DRAGS = 64;
const DRAG_LIFE = 0.8;     // s hasta que un tirón del puntero se desvanece
const DRAG_RADIUS = 110;   // px
const VORTEX_RADIUS = 160; // px
const VORTEX_SPEED = 260;  // px/s en el borde del núcleo
const WELL_RADIUS = 220;   // px
const WELL_SPEED = 180;    // px/s
const WELL_RAMP = 0.6;     // s en que un pozo recién plantado alcanza su fuerza

/**
 * @param {{ noise3: Function, scale?: number, speed?: number, strength?: number }} opts
 *   scale: frecuencia espacial del ruido (1/px); speed: evolución temporal;
 *   strength: px/s por unidad de curl.
 * API: sample(x, y, t) -> [vx, vy]; addDrag(x, y, dx, dy); setVortex(id, x, y, dir|null);
 *      addWell(x, y, kind: "attractor"|"repulsor"); clearWells(); update(dt);
 *      wells; drags; vortices; dragEnergy
 */
export function createField({ noise3, scale = 0.004, speed = 0.06, strength = 25 }) {
  const wells = [];
  const drags = [];
  const vortices = new Map();

  return {
    wells,
    drags,
    vortices,

    /** Suma de la fuerza viva de los arrastres: 0 cuando no hay perturbación. */
    get dragEnergy() {
      let e = 0;
      for (const d of drags) e += Math.hypot(d.dx, d.dy) * (d.life / DRAG_LIFE);
      return e;
    },

    sample(x, y, t) {
      const [cx, cy] = curl2(noise3, x * scale, y * scale, t * speed);
      let vx = cx * strength;
      let vy = cy * strength;

      for (const d of drags) {
        const rx = x - d.x, ry = y - d.y;
        const k = Math.exp(-(rx * rx + ry * ry) / (DRAG_RADIUS * DRAG_RADIUS)) * (d.life / DRAG_LIFE);
        vx += d.dx * k;
        vy += d.dy * k;
      }

      for (const v of vortices.values()) {
        const rx = x - v.x, ry = y - v.y;
        const r = Math.hypot(rx, ry) + 1e-6;
        const k = VORTEX_SPEED * v.strength * v.dir * Math.exp(-(r * r) / (VORTEX_RADIUS * VORTEX_RADIUS)) / r;
        vx += -ry * k;
        vy += rx * k;
      }

      for (const w of wells) {
        const rx = w.x - x, ry = w.y - y;
        const r = Math.hypot(rx, ry) + 1e-6;
        const sign = w.kind === "attractor" ? 1 : -1;
        // Se anula en el centro para que las partículas orbiten en vez de amontonarse.
        const k = sign * WELL_SPEED * Math.min(1, w.age / WELL_RAMP)
          * Math.exp(-(r * r) / (WELL_RADIUS * WELL_RADIUS)) * Math.min(1, r / 30) / r;
        vx += rx * k;
        vy += ry * k;
      }

      return [vx, vy];
    },

    /** Tirón del puntero: (dx, dy) es su velocidad en px/s. */
    addDrag(x, y, dx, dy) {
      drags.push({ x, y, dx, dy, life: DRAG_LIFE });
      if (drags.length > MAX_DRAGS) drags.shift();
    },

    /** Remolino por puntero (id); dir 1 = antihorario, -1 = horario, null lo suelta. */
    setVortex(id, x, y, dir) {
      if (dir === null) {
        const v = vortices.get(id);
        if (v) v.released = true;
        return;
      }
      const v = vortices.get(id);
      if (v) Object.assign(v, { x, y, dir, released: false });
      else vortices.set(id, { x, y, dir, strength: 0, released: false });
    },

    addWell(x, y, kind) {
      wells.push({ x, y, kind, age: 0 });
      if (wells.length > MAX_WELLS) wells.shift();
    },

    clearWells() { wells.length = 0; },

    /** Envejece las perturbaciones: los arrastres se apagan, los remolinos crecen o se disipan. */
    update(dt) {
      for (let i = drags.length - 1; i >= 0; i--) {
        drags[i].life -= dt;
        if (drags[i].life <= 0) drags.splice(i, 1);
      }
      for (const [id, v] of vortices) {
        v.strength += (v.released ? -dt : dt) * 2;
        if (v.strength > 1) v.strength = 1;
        if (v.strength <= 0 && v.released) vortices.delete(id);
      }
      for (const w of wells) w.age += dt;
    },
  };
}
