// Presets, morphing and the evolve random walk.
import { clamp, lerp, smoothstep, gauss } from './rng.js';

const D = Math.PI / 180;
export const PRESETS = [
  { name: 'Transit',  SA: 22.5, RA: 30, SO: 18, SS: 1.1, decay: 0.955, diffuse: 1.0, species: 1, rivalry: 0 },
  { name: 'Coral',    SA: 60,   RA: 30, SO: 9,  SS: 0.9, decay: 0.95,  diffuse: 1.0, species: 1, rivalry: 0 },
  { name: 'Nebula',   SA: 30,   RA: 40, SO: 12, SS: 1.2, decay: 0.95,  diffuse: 1.0, species: 3, rivalry: 1.0 },
  { name: 'Mycelium', SA: 20,   RA: 25, SO: 22, SS: 0.8, decay: 0.985, diffuse: 0.5, species: 2, rivalry: 0.3 },
  { name: 'Pulse',    SA: 28,   RA: 35, SO: 14, SS: 1.0, decay: 0.95,  diffuse: 1.0, species: 1, rivalry: 0, pulse: true },
];

// Bounds for UI sliders, evolve and hash sanitising. Angles in degrees.
export const BOUNDS = {
  SA: [5, 90], RA: [5, 90], SO: [2, 40], SS: [0.3, 2.5], decay: [0.85, 0.995], diffuse: [0, 1], rivalry: [0, 1.5],
};
const EVOLVE = { SA: [15, 60], RA: [15, 70], SO: [5, 28], SS: [0.6, 1.6], decay: [0.92, 0.985] };
export const KEYS = ['SA', 'RA', 'SO', 'SS', 'decay', 'diffuse', 'rivalry'];

export class Params {
  constructor() {
    this.preset = 0;
    this.cur = { ...PRESETS[0] };
    this.species = 1;
    this.morph = null;
    this.evolve = false;
    this.pulse = false;
    this.reduced = false;
  }
  sanitize(o) {
    for (const k of KEYS) if (k in o) o[k] = clamp(Number(o[k]) || 0, BOUNDS[k][0], BOUNDS[k][1]);
    return o;
  }
  setPreset(i, instant = false) {
    i = clamp(i | 0, 0, PRESETS.length - 1);
    let p = PRESETS[i];
    if (this.reduced && p.pulse) { i = 0; p = PRESETS[0]; }
    this.preset = i;
    this.species = p.species;
    this.pulse = !!p.pulse;
    if (instant) { for (const k of KEYS) this.cur[k] = p[k]; this.morph = null; return; }
    const from = {}; for (const k of KEYS) from[k] = this.cur[k];
    this.morph = { from, to: { ...p }, t: 0, dur: this.reduced ? 4 : 2 };
  }
  set(k, v) {
    this.cur[k] = clamp(v, BOUNDS[k][0], BOUNDS[k][1]);
    if (this.morph) delete this.morph.to[k], delete this.morph.from[k];
  }
  update(dt, rand) {
    if (this.morph) {
      const m = this.morph; m.t += dt;
      const s = smoothstep(m.t / m.dur);
      for (const k in m.from) this.cur[k] = lerp(m.from[k], m.to[k], s);
      if (m.t >= m.dur) this.morph = null;
    }
    if (this.evolve && !this.reduced && !this.morph) {
      const p = PRESETS[this.preset];
      for (const k in EVOLVE) {
        const [a, b] = EVOLVE[k]; const range = b - a;
        let v = this.cur[k];
        v += gauss(rand) * 0.02 * range * Math.sqrt(dt) * 1.5;
        v += (p[k] - v) * 0.01 * dt;
        this.cur[k] = clamp(v, a, b);
      }
    }
  }
  // Values for the simulation (radians, pulse applied).
  sim(t) {
    const c = this.cur;
    let SO = c.SO;
    if (this.pulse && !this.reduced) SO *= 1 + 0.35 * Math.sin(t * 0.8);
    return {
      SA: c.SA * D, RA: c.RA * D, SO, SS: c.SS, decay: c.decay, diffuse: c.diffuse,
      rivalry: this.species > 1 ? c.rivalry : 0, species: this.species,
    };
  }
}
