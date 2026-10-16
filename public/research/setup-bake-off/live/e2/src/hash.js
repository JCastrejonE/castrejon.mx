// Versioned URL hash: #v1;p=<preset>;q=<SA,RA,SO,SS,decay,rivalry,species>;s=<u,v pairs>;seed=<n>
import { clamp } from './rng.js';

const Q = 4096;
const enc = (x, scale) => Math.round(x * scale).toString(36);
const dec = (s, scale) => { const n = parseInt(s, 36); if (!Number.isFinite(n)) throw new Error('bad num'); return n / scale; };

export function encodeHash(state) {
  const c = state.params.cur;
  const q = [enc(c.SA, 100), enc(c.RA, 100), enc(c.SO, 100), enc(c.SS, 1000), enc(c.decay, 10000), enc(c.rivalry, 1000), String(state.params.species)].join(',');
  const s = state.stations.list.map((st) => enc(clamp(st.u, 0, 1), Q) + '.' + enc(clamp(st.v, 0, 1), Q)).join(',');
  return `#v1;p=${state.params.preset + 1};q=${q};s=${s};seed=${(state.seed >>> 0).toString(36)}`;
}

export function decodeHash(h) {
  if (!h || h.length < 3) return null;
  try {
    const parts = h.replace(/^#/, '').split(';');
    if (parts[0] !== 'v1') throw new Error('unknown hash version ' + parts[0]);
    const out = {};
    for (const part of parts.slice(1)) {
      const i = part.indexOf('='); if (i < 0) continue;
      const k = part.slice(0, i), v = part.slice(i + 1);
      if (k === 'p') out.preset = clamp((parseInt(v, 10) || 1) - 1, 0, 4);
      else if (k === 'q') {
        const a = v.split(',');
        if (a.length < 7) throw new Error('bad q');
        out.q = { SA: dec(a[0], 100), RA: dec(a[1], 100), SO: dec(a[2], 100), SS: dec(a[3], 1000), decay: dec(a[4], 10000), rivalry: dec(a[5], 1000) };
        out.species = clamp(parseInt(a[6], 10) || 1, 1, 3);
      } else if (k === 's') {
        out.stations = v ? v.split(',').slice(0, 24).map((pair) => {
          const [u, w] = pair.split('.');
          return { u: clamp(dec(u, Q), 0.01, 0.99), v: clamp(dec(w, Q), 0.01, 0.99) };
        }) : [];
      } else if (k === 'seed') out.seed = parseInt(v, 36) >>> 0;
    }
    return out;
  } catch (e) {
    console.warn('[physarum] ignoring URL hash:', e.message);
    return null;
  }
}

let timer = 0;
export function writeHashDebounced(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { history.replaceState(null, '', encodeHash(state)); } catch (e) { /* sandboxed */ }
  }, 500);
}
