// Palettes: a 5-stop ramp from background to peak, plus HUD ink colours.
// Species colours are shared by every palette.

export const PALETTES = {
  agar: {
    label: 'Agar',
    ramp: ['#0e0c08', '#3a2a0f', '#c98a1b', '#f2d98a', '#fff8e6'],
    ink: '#f2e6c8', inkDim: '#a8966e', accent: '#e0a526', light: false,
  },
  lichen: {
    label: 'Lichen',
    ramp: ['#0b0f0c', '#1f3a2b', '#6fa36a', '#d8e6b8', '#f7faee'],
    ink: '#e4eed6', inkDim: '#8fa88a', accent: '#9fcf8a', light: false,
  },
  cyanotype: {
    label: 'Cyanotype',
    ramp: ['#0a1628', '#123e6b', '#3f7fb5', '#bfd9ee', '#f4f8fc'],
    ink: '#dce9f5', inkDim: '#86a4c4', accent: '#7fb6e6', light: false,
  },
  ink: {
    label: 'Ink on paper',
    ramp: ['#ede6d6', '#b9ae95', '#5a4e3a', '#231c12', '#0b0806'],
    ink: '#1d160c', inkDim: '#5e5240', accent: '#8a3b1c', light: true,
  },
};

export const SPECIES_COLORS = ['#e0a526', '#3fa7a0', '#c4553f'];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 256 RGB triples, piecewise-linear through the ramp stops.
export function buildLut(ramp) {
  const stops = ramp.map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  const segs = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segs;
    const s = Math.min(segs - 1, Math.floor(t));
    const f = t - s;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(stops[s][c] + (stops[s + 1][c] - stops[s][c]) * f);
  }
  return lut;
}
