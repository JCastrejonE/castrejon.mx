// URL hash <-> scene state. Food positions are normalized to 0..1 so a shared
// link works at any window size. Parsing never throws: bad input falls back.
//
//   #p=tokyo&c=agar&f=0.120,0.455;0.500,0.500

const MAX_FOODS = 24;

export function encodeScene({ preset, palette, foods }) {
  const parts = [`p=${encodeURIComponent(preset)}`, `c=${encodeURIComponent(palette)}`];
  // Always write f=, so an emptied dish stays empty when shared.
  parts.push('f=' + (foods || []).slice(0, MAX_FOODS).map((f) => `${f.u.toFixed(3)},${f.v.toFixed(3)}`).join(';'));
  return '#' + parts.join('&');
}

export function decodeScene(hash, { presets, palettes }) {
  const out = { preset: null, palette: null, foods: null };
  if (typeof hash !== 'string') return out;
  let params;
  try {
    params = new URLSearchParams(hash.replace(/^#/, ''));
  } catch {
    return out;
  }
  const p = params.get('p');
  if (p && presets.includes(p)) out.preset = p;
  const c = params.get('c');
  if (c && palettes.includes(c)) out.palette = c;
  const f = params.get('f');
  if (f === '') out.foods = [];
  else if (f) {
    const foods = [];
    for (const pair of f.split(';').slice(0, MAX_FOODS)) {
      const [u, v] = pair.split(',').map(Number);
      if (Number.isFinite(u) && Number.isFinite(v) && u >= 0 && u <= 1 && v >= 0 && v <= 1) foods.push({ u, v });
    }
    if (foods.length) out.foods = foods;
  }
  return out;
}
