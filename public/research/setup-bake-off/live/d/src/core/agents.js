const TAU = Math.PI * 2;

/** Structure-of-arrays agent pool: no per-agent objects, so the step loop never allocates. */
export function createAgents(capacity) {
  return {
    capacity,
    count: 0,
    cursor: 0, // next slot to recycle once the pool is full
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    heading: new Float32Array(capacity),
    species: new Uint8Array(capacity),
  };
}

function place(a, i, x, y, heading, species, w, h) {
  a.x[i] = x < 0 ? x + w : x >= w ? x - w : x;
  a.y[i] = y < 0 ? y + h : y >= h ? y - h : y;
  // guard against float rounding landing exactly on the far edge
  if (a.x[i] >= w) a.x[i] = 0;
  if (a.y[i] >= h) a.y[i] = 0;
  a.heading[i] = heading;
  a.species[i] = species;
}

/** Replace the pool contents with `n` agents laid out by `mode`. */
export function seedAgents(a, n, w, h, speciesCount, mode, rng) {
  n = Math.min(n, a.capacity);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
  const hubs = [];
  for (let s = 0; s < speciesCount; s++) {
    const ang = (s / speciesCount) * TAU - Math.PI / 2;
    hubs.push([cx + Math.cos(ang) * R * 0.55, cy + Math.sin(ang) * R * 0.55]);
  }
  for (let i = 0; i < n; i++) {
    const s = i % speciesCount;
    const t = rng() * TAU;
    let x, y, heading;
    if (mode === 'disc') {
      const r = Math.sqrt(rng()) * R;
      x = cx + Math.cos(t) * r; y = cy + Math.sin(t) * r;
      heading = t + Math.PI; // face the centre
    } else if (mode === 'ring') {
      const r = R * (0.92 + rng() * 0.08);
      x = cx + Math.cos(t) * r; y = cy + Math.sin(t) * r;
      heading = t + Math.PI / 2; // swirl around
    } else if (mode === 'clusters') {
      const r = Math.sqrt(rng()) * R * 0.35;
      x = hubs[s][0] + Math.cos(t) * r; y = hubs[s][1] + Math.sin(t) * r;
      heading = t; // explode outward
    } else {
      x = rng() * w; y = rng() * h;
      heading = t;
    }
    place(a, i, x, y, heading, s, w, h);
  }
  a.count = n;
  a.cursor = 0;
}

/** Spawn `n` agents radiating from (x, y). Once full, overwrite the oldest slots round-robin. */
export function burst(a, n, x, y, w, h, speciesCount, rng) {
  for (let k = 0; k < n; k++) {
    let i;
    if (a.count < a.capacity) {
      i = a.count++;
    } else {
      i = a.cursor;
      a.cursor = (a.cursor + 1) % a.capacity;
    }
    const t = rng() * TAU;
    const r = rng() * 2;
    place(a, i, x + Math.cos(t) * r, y + Math.sin(t) * r, t, Math.floor(rng() * speciesCount), w, h);
  }
}
