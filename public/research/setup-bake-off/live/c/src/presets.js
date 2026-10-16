// Scenes. Food positions are normalized (u, v in 0..1 of the dish) so they
// work at any window size. `walls` are polygons in the same space.

// Greater Tokyo, roughly the city set Tero et al. (2010) fed their slime mold.
// [name, longitude, latitude]
const TOKYO_STATIONS = [
  ['Tokyo', 139.767, 35.681], ['Shinjuku', 139.700, 35.690], ['Yokohama', 139.622, 35.466],
  ['Kawasaki', 139.697, 35.531], ['Chiba', 140.123, 35.613], ['Omiya', 139.624, 35.906],
  ['Kawagoe', 139.486, 35.909], ['Hachioji', 139.339, 35.656], ['Tachikawa', 139.414, 35.698],
  ['Machida', 139.445, 35.542], ['Fujisawa', 139.487, 35.339], ['Yokosuka', 139.668, 35.282],
  ['Kashiwa', 139.971, 35.862], ['Funabashi', 139.985, 35.702], ['Narita', 140.318, 35.776],
  ['Tsukuba', 140.111, 36.083], ['Kisarazu', 139.917, 35.381], ['Odawara', 139.155, 35.256],
  ['Hon-Atsugi', 139.364, 35.440], ['Kasukabe', 139.752, 35.980], ['Ome', 139.256, 35.790],
  ['Tokorozawa', 139.469, 35.799],
];
// Tokyo Bay and Sagami Bay as coastline walls (lon, lat).
const TOKYO_BAY = [
  [139.775, 35.640], [139.880, 35.655], [140.030, 35.635], [140.100, 35.585], [140.030, 35.500],
  [139.940, 35.420], [139.880, 35.330], [139.840, 35.240], [139.760, 35.200], [139.715, 35.260],
  [139.690, 35.330], [139.650, 35.410], [139.660, 35.470], [139.710, 35.520], [139.745, 35.590],
];
const SAGAMI_BAY = [
  [139.050, 35.160], [139.090, 35.200], [139.180, 35.230], [139.330, 35.300], [139.480, 35.312],
  [139.590, 35.290], [139.630, 35.230], [139.640, 35.160],
];
const LON0 = 139.05, LON1 = 140.45, LAT0 = 35.16, LAT1 = 36.12;
// Longitude degrees are shorter than latitude degrees at 35.6N.
const MAP_ASPECT = ((LON1 - LON0) * Math.cos((35.6 * Math.PI) / 180)) / (LAT1 - LAT0);

// Fit the map box into a dish of the given aspect ratio, with a margin.
function tokyoProjector(dishAspect) {
  const margin = 0.07;
  let w = 1 - margin * 2, h = 1 - margin * 2;
  if (dishAspect > MAP_ASPECT) w = (h * MAP_ASPECT) / dishAspect;
  else h = (w * dishAspect) / MAP_ASPECT;
  const u0 = (1 - w) / 2, v0 = (1 - h) / 2;
  return ([lon, lat]) => ({
    u: u0 + ((lon - LON0) / (LON1 - LON0)) * w,
    v: v0 + (1 - (lat - LAT0) / (LAT1 - LAT0)) * h,
  });
}

// Circle positions in normalized space. `radius` is a fraction of the shorter
// side, and each axis is corrected so the ring is round on screen in both
// landscape and portrait.
function ring(n, radius, aspect, phase = -Math.PI / 2) {
  const ru = radius * Math.min(1, 1 / aspect);
  const rv = radius * Math.min(1, aspect);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    out.push({ u: 0.5 + Math.cos(a) * ru, v: 0.5 + Math.sin(a) * rv });
  }
  return out;
}

// Poisson-ish scatter: rejection-sample points with a minimum spacing.
function scatter(n, rand, aspect) {
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 2000; tries++) {
    const p = { u: 0.1 + rand() * 0.8, v: 0.12 + rand() * 0.76 };
    const ok = pts.every((q) => Math.hypot((q.u - p.u) * aspect, q.v - p.v) > 0.2);
    if (ok) pts.push(p);
  }
  return pts;
}

export const PRESETS = {
  first: {
    label: 'First light',
    species: 1,
    layout: 'disc',
    foods: (aspect) => ring(3, 0.24, aspect, -Math.PI / 2 + 0.3),
  },
  tokyo: {
    label: 'Tokyo, 2010',
    species: 1,
    layout: 'uniform',
    params: { wallDecay: 1 },
    foods: (aspect) => TOKYO_STATIONS.map(([, lon, lat]) => tokyoProjector(aspect)([lon, lat])),
    walls: (aspect) => [TOKYO_BAY, SAGAMI_BAY].map((poly) => poly.map(tokyoProjector(aspect))),
    caption: 'Food on 22 Greater Tokyo stations; the bays are walls.',
  },
  ring: {
    label: 'Ring road',
    species: 1,
    layout: 'disc',
    foods: (aspect) => [{ u: 0.5, v: 0.5 }, ...ring(8, 0.34, aspect)],
  },
  scatter: {
    label: 'Scatter',
    species: 1,
    layout: 'uniform',
    foods: (aspect, rand) => scatter(9, rand, aspect),
  },
  rivals: {
    label: 'Rival colonies',
    species: 3,
    layout: 'disc',
    foods: (aspect) => ring(6, 0.3, aspect, 0),
    caption: 'Three species. Each follows its own trail and avoids the others.',
  },
  bloom: {
    label: 'Bloom',
    species: 1,
    layout: 'uniform',
    density: 0.3,
    params: { crowd: 3 },
    foods: () => [],
    caption: 'No food at all: the organism just explores.',
  },
};

// Keyboard order for 1-5.
export const PRESET_KEYS = ['tokyo', 'ring', 'scatter', 'rivals', 'bloom'];

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
