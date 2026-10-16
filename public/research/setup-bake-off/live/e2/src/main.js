// Boot, renderer choice, main loop, governor, visibility, resize, keyboard, poster, share.
import { mulberry32, clamp } from './rng.js';
import { Params, PRESETS } from './params.js';
import { Stations, analyzeProbe, MAX_STATIONS, EXPO_K } from './stations.js';
import { GPURenderer, probeWebGL2, capabilities, TIERS } from './gpu.js';
import { CPURenderer, CPU_TIERS } from './cpu.js';
import { Overlay, drawScene } from './overlay.js';
import { attachInput, isFormTarget } from './input.js';
import { createUI, fmtCount } from './ui.js';
import { decodeHash, encodeHash, writeHashDebounced } from './hash.js';
import { audio, toggleSound, chime } from './audio.js';

const qs = new URLSearchParams(location.search);
const FORCE_CPU = ['2d', 'cpu'].includes((qs.get('renderer') || '').toLowerCase());
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const SEED_MODES = ['disc', 'ring', 'nodes', 'random'];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const RAMPS = {
  teal: ['#0a3a40', '#19c3d6', '#f2ffff'],
  amber: ['#3a0a10', '#e08a2a', '#fff3dc'],
  violet: ['#1a1050', '#8a5ae0', '#efe4ff'],
  paper: ['#2a2f38', '#c8c2b0', '#ffffff'],
};
const VARIANTS = ['teal', 'amber', 'violet', 'paper'];

const stage = document.getElementById('stage');
let glCanvas = document.getElementById('gl');
const ovCanvas = document.getElementById('overlay');

// ---------------------------------------------------------------- state
const hashState = decodeHash(location.hash);
const S = {
  seed: (hashState && hashState.seed) || (Date.now() >>> 0),
  params: new Params(),
  stations: null,
  renderer: null,
  paused: false,
  reduced: reducedMQ.matches,
  expo: 4,
  km: 0,
  palVariant: 0,
  bloomUser: true,
  uiHidden: false,
  hover: null, dragging: null, brush: null, focus: null,
  lakes: [], seeds: [],
  seedMode: 3,
  growing: 0,
  lost: false,
  enterCount: 0,
};
S.stations = new Stations(S.seed);
S.params.reduced = S.reduced;
const rand = mulberry32(S.seed ^ 0xabcdef);

if (hashState) {
  S.params.setPreset(hashState.preset || 0, true);
  if (hashState.q) { S.params.sanitize(hashState.q); Object.assign(S.params.cur, hashState.q); }
  if (hashState.species) S.params.species = hashState.species;
} else S.params.setPreset(0, true);

// Sizing
const small = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const G = {
  tier: small ? 3 : 1,
  simScale: small ? 0.5 : 0.75,
  allow2: true, bloomAuto: true,
  ema: 16.7, slow: 0, fast: 0, downgrades: 0, frames: 0,
};
if (qs.has('tier')) G.tier = clamp(parseInt(qs.get('tier'), 10) || 0, 0, 4);
const PIN_TIER = qs.has('tier');
const FORCE_STEPS = clamp(parseInt(qs.get('steps'), 10) || 0, 0, 16); // testing aid
const cssSize = () => [Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight)];
const dprNow = () => Math.min(window.devicePixelRatio || 1, 2);

// Stations from hash or seeded default composition.
{
  const [w, h] = cssSize();
  const now = performance.now();
  if (hashState && hashState.stations) for (const p of hashState.stations) S.stations.add(p.u, p.v, now);
  else S.stations.defaultLayout(w / h, now);
}

// ---------------------------------------------------------------- renderer
function palette() {
  const sp = S.params.species;
  const a = RAMPS[sp === 1 ? VARIANTS[S.palVariant] : 'teal'];
  const ramps = [a, RAMPS.amber, RAMPS.violet].map((r) => r.map(hex));
  return [ramps.map((r) => r[0]), ramps.map((r) => r[1]), ramps.map((r) => r[2])];
}
function applyPalette() { const [a, b, c] = palette(); S.renderer.setPalette(a, b, c); }

function freshCanvas() {
  const c = document.createElement('canvas');
  c.id = 'gl'; c.setAttribute('aria-hidden', 'true');
  glCanvas.replaceWith(c);
  glCanvas = c;
  return c;
}

function initOpts() {
  return { dpr: dprNow(), simScale: G.simScale, tier: G.tier, stations: S.stations.list, seed: S.seed };
}

function startCPU(reason) {
  if (reason) console.info('[physarum] using Canvas2D fallback:', reason);
  try { if (S.renderer) S.renderer.destroy(); } catch (e) { /* ignore */ }
  const c = freshCanvas();
  const r = new CPURenderer(c);
  const [w, h] = cssSize();
  if (!qs.has('tier')) G.tier = small ? 3 : 1;
  r.init(w, h, initOpts());
  S.renderer = r;
  G.downgrades = 0; G.slow = G.fast = 0; G.frames = 0;
  applyPalette();
}

function startGPU() {
  const cap = probeWebGL2(glCanvas);
  if (!cap) throw new Error('WebGL2 + float render targets unavailable');
  const r = new GPURenderer(glCanvas, cap.gl, cap.trail16);
  const [w, h] = cssSize();
  r.init(w, h, initOpts());
  S.renderer = r;
  applyPalette();
  if (!cap.trail16) console.info('[physarum] RGBA16F trail unavailable, using RGBA8');
  glCanvas.addEventListener('webglcontextlost', onLost, false);
  glCanvas.addEventListener('webglcontextrestored', onRestored, false);
}

let lostTimer = 0;
function onLost(e) {
  e.preventDefault();
  S.lost = true;
  cancelAnimationFrame(raf); raf = 0;
  console.info('[physarum] WebGL context lost; waiting for restore');
  lostTimer = setTimeout(() => { if (S.lost) { S.lost = false; startCPU('context not restored within 3 s'); ui.toast('CPU mode'); loopStart(); } }, 3000);
}
function onRestored() {
  if (!S.lost) return;
  clearTimeout(lostTimer);
  S.lost = false;
  try {
    const gl = S.renderer.gl;
    const cap = capabilities(gl);
    if (!cap) throw new Error('capabilities lost');
    const r = new GPURenderer(glCanvas, gl, cap.trail16);
    const [w, h] = cssSize();
    r.init(w, h, initOpts());
    r.bloom = S.renderer.bloom;
    r.expo = S.expo;
    S.renderer = r;
    applyPalette();
    console.info('[physarum] WebGL context restored');
  } catch (err) {
    startCPU('restore failed: ' + err.message);
  }
  loopStart();
}

try {
  if (FORCE_CPU) startCPU('?renderer=' + qs.get('renderer'));
  else startGPU();
} catch (e) {
  startCPU(e.message);
}
S.renderer.expo = S.expo;
S.renderer.reseed(qs.get('seed0') || 'random');

const overlay = new Overlay(ovCanvas);
{ const [w, h] = cssSize(); overlay.resize(w, h, dprNow()); }

// ---------------------------------------------------------------- app actions
const app = {
  mode: 'station',
  snapshot() {
    return {
      cur: S.params.cur, preset: S.params.preset, species: S.params.species, evolve: S.params.evolve,
      sound: audio.enabled, tier: S.renderer.tier, agents: S.renderer.agentCount, reduced: S.reduced,
    };
  },
  interacted() { ui.hideHint(); },
  hitStation(x, y, r) { return S.stations.hit(x, y, overlay.w, overlay.h, r); },
  addStation(u, v) {
    if (S.stations.list.length >= MAX_STATIONS) { ui.toast(`${MAX_STATIONS} stations max`); return null; }
    const st = S.stations.add(u, v);
    if (st) { S.renderer.respawnRing(st.u, st.v, 0.012); ui.announce(`Added ${st.name}`); changed(); }
    return st;
  },
  moveStation(st, u, v) { S.stations.move(st, u, v); changed(); },
  deleteStation(st) {
    S.stations.remove(st);
    if (S.focus === st) S.focus = null;
    ui.announce(`Removed ${st.name}`); changed();
  },
  paintLake(u, v) { S.lakes.push({ u, v, amp: 0.1 }); },
  paintSeed(u, v) { S.seeds.push({ u, v }); },
  setHover(h) { S.hover = h; },
  setDragging(st) { S.dragging = st; },
  setBrush(b) {
    if (b) {
      const k = S.renderer.k, scale = overlay.w / S.renderer.TW;
      b.r = (b.kind === 'lake' ? 28 : 14) * k * scale;
    }
    S.brush = b;
  },
  setPreset(i) {
    const was = S.params.species;
    S.params.setPreset(i);
    if (S.params.species !== was) applyPalette();
    ui.toast(PRESETS[S.params.preset].name);
    changed(); ui.sync();
  },
  setSpecies(n) { S.params.species = clamp(n, 1, 3); applyPalette(); ui.toast(`${S.params.species} species`); changed(); ui.sync(); },
  setParam(k, v) { S.params.set(k, v); changed(); },
  setTier(i) { S.renderer.setAgentTier(i); G.tier = S.renderer.tier; ui.sync(true); },
  reseed() {
    const mode = SEED_MODES[S.seedMode = (S.seedMode + 1) % SEED_MODES.length];
    S.renderer.reseed(mode); ui.toast(`Reseed · ${mode}`);
  },
  clearTrail() { S.renderer.clearTrail(); S.renderer.clearField(); ui.toast('Trails cleared'); },
  toggleEvolve() {
    if (S.reduced) { ui.toast('Evolve is off with reduced motion'); return; }
    S.params.evolve = !S.params.evolve; ui.toast(S.params.evolve ? 'Evolving' : 'Evolve off'); ui.sync();
  },
  toggleSound() { const on = toggleSound(); ui.toast(on ? 'Sound on' : 'Sound off'); ui.sync(); },
  play() { S.paused = false; ui.showPlay(false); ui.toast('Playing'); },
  poster, share,
};

function changed() { writeHashDebounced(S); updateAria(); }
function updateAria() {
  const n = S.stations.list.length, l = S.stations.linkedCount;
  ovCanvas.setAttribute('aria-label', `Slime-mold network connecting ${n} station${n === 1 ? '' : 's'}, ${l} linked`);
}

const ui = createUI(app);
attachInput(ovCanvas, app);
updateAria();
ui.sync(true);

// ---------------------------------------------------------------- keyboard
let enterN = 0;
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isFormTarget(e.target)) {
    if (e.key === 'Escape' && ui.panelOpen) ui.setPanel(false);
    return;
  }
  if (ui.helpOpen) { if (e.key === 'Escape') ui.closeHelp(); return; }
  const onCanvas = document.activeElement === ovCanvas;
  const list = S.stations.list;

  if (e.key === 'Tab' && onCanvas && list.length) {
    let i = S.focus ? list.indexOf(S.focus) : -1;
    i += e.shiftKey ? -1 : 1;
    if (i >= 0 && i < list.length) {
      e.preventDefault(); S.focus = list[i];
      ui.announce(`${S.focus.name}, ${S.focus.linked ? 'linked' : 'not linked'}. Arrow keys move, Delete removes.`);
      return;
    }
    S.focus = null; return;
  }
  if (onCanvas && S.focus && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const d = e.shiftKey ? 0.05 : 0.01;
    const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
    const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    app.moveStation(S.focus, S.focus.u + dx, S.focus.v + dy);
    return;
  }
  if (onCanvas && S.focus && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault(); app.deleteStation(S.focus); return;
  }
  if (onCanvas && e.key === 'Enter') {
    e.preventDefault();
    const n = enterN++, a = n * 2.39996323, r = n === 0 ? 0 : 0.05 * Math.sqrt(n);
    const st = app.addStation(0.5 + Math.cos(a) * r * (overlay.h / overlay.w), 0.5 + Math.sin(a) * r);
    if (st) S.focus = st;
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  let handled = true;
  switch (k) {
    case '1': case '2': case '3': case '4': case '5': app.setPreset(+k - 1); break;
    case ' ':
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') { handled = false; break; }
      S.paused = !S.paused; ui.toast(S.paused ? 'Paused' : 'Running'); ui.showPlay(S.paused && S.reduced); break;
    case 'r': app.reseed(); break;
    case 'c': app.clearTrail(); break;
    case 'n': S.stations.clear(); S.focus = null; enterN = 0; ui.toast('Stations cleared'); changed(); break;
    case 'e': app.toggleEvolve(); break;
    case 's': app.setSpecies(S.params.species % 3 + 1); break;
    case 'v':
      S.palVariant = (S.palVariant + 1) % VARIANTS.length; applyPalette();
      ui.toast(S.params.species === 1 ? `Palette · ${VARIANTS[S.palVariant]}` : 'Palette variants apply to 1 species'); break;
    case 'p': poster(); break;
    case 'u': share(); break;
    case 'm': app.toggleSound(); break;
    case 'b': S.bloomUser = !S.bloomUser; applyBloom(); ui.toast(S.bloomUser ? 'Bloom on' : 'Bloom off'); break;
    case 'h':
      S.uiHidden = !S.uiHidden; document.body.classList.toggle('ui-hidden', S.uiHidden);
      if (S.uiHidden) ui.setPanel(false);
      break;
    case '?': case '/': ui.openHelp(); break;
    case 'Escape': if (ui.panelOpen) ui.setPanel(false); else S.focus = null; break;
    case '[': app.setTier(S.renderer.tier + 1); ui.toast(`Density · ${fmtCount(S.renderer.agentCount)}`); break;
    case ']': app.setTier(S.renderer.tier - 1); ui.toast(`Density · ${fmtCount(S.renderer.agentCount)}`); break;
    default: handled = false;
  }
  if (handled) { e.preventDefault(); ui.hideHint(); }
});

function applyBloom() {
  S.renderer.bloom = S.renderer.kind === 'gpu' && S.bloomUser && G.bloomAuto && S.renderer.tier < TIERS.length - 1;
}

// ---------------------------------------------------------------- poster & share
function poster() {
  try {
    const img = S.renderer.posterPixels();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.putImageData(img, 0, 0);
    const scale = img.width / overlay.w;
    drawScene(ctx, overlay.w, overlay.h, { stations: S.stations.list, dying: [], now: performance.now(), reduced: true, showAids: false }, scale, 'letterSpacing' in ctx);
    // Cartouche.
    ctx.save(); ctx.scale(scale, scale);
    const W = overlay.w, H = overlay.h, bw = 272, bh = 74, x = W - bw - 20, y = H - bh - 20;
    ctx.fillStyle = 'rgba(12,14,18,0.82)'; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, bw, bh, 8) : ctx.rect(x, y, bw, bh); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#19c3d6'; ctx.fillRect(x + 14, y + 16, 3, bh - 32);
    ctx.font = '11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.14em';
    ctx.fillStyle = '#f4f1ea';
    ctx.fillText(`PHYSARUM · ${PRESETS[S.params.preset].name.toUpperCase()}`, x + 26, y + 26);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillText(new Date().toISOString().slice(0, 10), x + 26, y + 43);
    ctx.fillText(`NETWORK ≈ ${S.km} KM · ${S.stations.list.length} STN`, x + 26, y + 60);
    ctx.restore();
    c.toBlob((blob) => {
      if (!blob) { ui.toast('Poster failed'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `physarum-transit-${S.seed.toString(36)}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.toast('Poster saved');
    }, 'image/png');
  } catch (e) {
    console.warn('[physarum] poster failed', e); ui.toast('Poster failed');
  }
}

function share() {
  try { history.replaceState(null, '', encodeHash(S)); } catch (e) { /* ignore */ }
  const url = location.href;
  const fallback = () => {
    const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    t.remove(); ui.toast('Link copied');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => ui.toast('Link copied'), fallback);
  else fallback();
}

// ---------------------------------------------------------------- resize
let resizePending = 0;
function doResize() {
  resizePending = 0;
  const [w, h] = cssSize(), dpr = dprNow();
  if (S.lost) return;
  S.renderer.resize(w, h, dpr, G.simScale);
  overlay.resize(w, h, dpr);
  S.renderer.render(); // no black flash
  analysisNow = true;
}
new ResizeObserver(() => { if (!resizePending) resizePending = requestAnimationFrame(doResize); }).observe(stage);
function watchDpr() {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mq.addEventListener('change', () => { if (!resizePending) resizePending = requestAnimationFrame(doResize); watchDpr(); }, { once: true });
}
watchDpr();

// ---------------------------------------------------------------- reduced motion
function setReduced(on, initial) {
  S.reduced = on; S.params.reduced = on;
  if (on) {
    S.params.evolve = false;
    if (PRESETS[S.params.preset].pulse) S.params.setPreset(0, true);
    if (initial) { S.growing = 400; ui.growing(true); } else { S.paused = true; ui.showPlay(true); }
  } else { ui.showPlay(false); if (S.paused && !initial) S.paused = false; }
  ui.sync(true);
}
reducedMQ.addEventListener('change', (e) => setReduced(e.matches, false));
if (S.reduced) setReduced(true, true);

// ---------------------------------------------------------------- governor
function governor(interval) {
  G.frames++;
  if (G.frames <= 30 || S.growing) return;
  G.ema += (interval - G.ema) * 0.05;
  G.slow = G.ema > 18.5 ? G.slow + 1 : 0;
  G.fast = G.ema < 14 ? G.fast + 1 : 0;
  const maxTier = S.renderer.kind === 'gpu' ? TIERS.length - 1 : CPU_TIERS.length - 1;
  if (G.slow >= 60) {
    G.slow = 0; G.fast = 0;
    let did = true;
    if (G.allow2) G.allow2 = false;
    else if (G.bloomAuto && S.renderer.kind === 'gpu') { G.bloomAuto = false; applyBloom(); }
    else if (S.renderer.tier < maxTier && !PIN_TIER) { S.renderer.setAgentTier(S.renderer.tier + 1); G.tier = S.renderer.tier; }
    else if (G.simScale > 0.5 && S.renderer.kind === 'gpu') { G.simScale = 0.5; doResize(); }
    else did = false;
    if (did) { G.downgrades++; G.ema = 16.7; ui.sync(); }
  } else if (G.fast >= 240 && G.downgrades < 2) {
    G.fast = 0;
    if (G.simScale < 0.75 && !small && S.renderer.kind === 'gpu') { G.simScale = 0.75; doResize(); }
    else if (S.renderer.tier > (small ? 3 : 0)) { S.renderer.setAgentTier(S.renderer.tier - 1); G.tier = S.renderer.tier; }
    else if (!G.bloomAuto) { G.bloomAuto = true; applyBloom(); }
    else if (!G.allow2) G.allow2 = true;
    ui.sync();
  }
}

// ---------------------------------------------------------------- main loop
let raf = 0, lastT = 0, frameNo = 0, simTime = 0, analysisAt = 0, analysisNow = true, settleUntil = performance.now() + 3000;
let fpsAcc = 0, fpsN = 0, fps = 60, hudAt = 0, stepAcc = 0, simSteps = 0;
// The random seed needs ~1 s (at 120 steps/s) to condense into tubes; linking before that is noise.
const LINK_AFTER_STEPS = 120;
// Exposure fades in over the first 180 sim steps (~1.5 s at 120 steps/s) so the opening is a dark
// field that strands grow out of, tied to sim progress so slow devices do not show the raw haze.

function loopStart() { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }

function frame(t) {
  raf = requestAnimationFrame(frame);
  const interval = lastT ? t - lastT : 16.7;
  lastT = t;
  const dt = Math.min(0.1, interval / 1000);
  const now = performance.now();
  frameNo++;
  fpsAcc += interval; fpsN++;
  if (fpsAcc > 500) { fps = Math.round((1000 * fpsN) / fpsAcc); fpsAcc = 0; fpsN = 0; }
  governor(interval);
  applyBloom();

  const R = S.renderer;
  S.params.update(dt, rand);

  // Continuous stamping while a brush is held.
  if (S.brush) (S.brush.kind === 'lake' ? S.lakes : S.seeds).push({ u: S.brush.u, v: S.brush.v, amp: 0.06 });

  let steps = 0;
  if (S.growing > 0) {
    steps = Math.min(40, S.growing); S.growing -= steps;
    if (S.growing <= 0) { ui.growing(false); S.paused = true; ui.showPlay(true); settleUntil = now + 2500; }
  } else if (!S.paused) {
    if (S.reduced) steps = frameNo % 2 ? 0 : 1;
    else if (FORCE_STEPS) steps = FORCE_STEPS;
    else {
      // Fixed sim rate (120 or 60 steps/s) independent of display refresh; capped per frame
      // so a slow frame degrades speed instead of piling on more work.
      const rate = G.allow2 ? 120 : 60, cap = G.allow2 && fps >= 58 ? 2 : 1;
      stepAcc = Math.min(stepAcc + dt * rate, cap + 1);
      steps = Math.min(cap, Math.floor(stepAcc));
      stepAcc -= steps;
    }
  }
  const world = {
    stations: S.stations.list, stationsVersion: S.stations.version,
    lakes: S.lakes.splice(0, 16), seeds: S.seeds.splice(0, 16),
    level: clamp(EXPO_K / S.expo, 0.05, 40),
  };
  if (S.lakes.length > 64) S.lakes.length = 64;
  if (S.seeds.length > 64) S.seeds.length = 64;
  if (steps) {
    R.step(S.params.sim(simTime), world, steps);
    simTime += dt; simSteps += steps;
  }

  // Analysis: once per second (every frame while settling), async on the GPU.
  if (analysisNow || now - analysisAt > (now < settleUntil ? 100 : 1000)) {
    analysisNow = false; analysisAt = now;
    try { R.requestProbe(); } catch (e) { console.warn('[physarum] probe failed', e); }
  }
  let data = null;
  try { data = R.pollProbe(); } catch (e) { /* ignore */ }
  if (data) {
    try {
      S.lastProbe = data;
      const res = analyzeProbe(data, S.stations, now, simSteps >= LINK_AFTER_STEPS);
      if (res.expoTarget) S.expo += (res.expoTarget - S.expo) * (now < settleUntil ? 0.35 : 0.2);
      S.km = res.km; S.litFrac = res.litFrac;
      for (const n of res.newly) {
        try { chime(n.index, n.st.u); } catch (e) { /* audio is optional */ }
        ui.announce(`${n.st.name} joined the network`);
      }
      if (!S.paused) for (const st of res.searching) R.respawnRing(st.u, st.v, 0.02);
      updateAria();
    } catch (e) { console.warn('[physarum] analysis failed', e); }
  }
  R.staticGrain = S.reduced;
  const fin = S.reduced ? 1 : Math.min(1, simSteps / 180), fade = 0.15 + 0.85 * fin * fin * (3 - 2 * fin);
  R.expo = S.expo * fade * (R.kind === 'cpu' ? 0.55 : 1); // coarse CPU tubes saturate sooner
  R.render();

  // Overlay.
  S.stations.dying = S.stations.dying.filter((d) => now - d.died < 300);
  const soCss = S.params.cur.SO * R.k * (overlay.w / R.TW);
  overlay.draw({
    stations: S.stations.list, dying: S.stations.dying, now, hover: S.hover, dragging: S.dragging,
    brush: S.brush, focus: document.activeElement === ovCanvas ? S.focus : null, soCss,
    reduced: S.reduced, showAids: true,
  });

  if (now - hudAt > 250) {
    hudAt = now;
    const name = PRESETS[S.params.preset].name.toUpperCase();
    const mode = R.kind === 'cpu' ? ' · CPU MODE' : '';
    const st = S.stations.list.length;
    const state = S.growing > 0 ? 'GROWING…' : S.paused ? 'PAUSED' : S.params.evolve ? 'EVOLVING' : '';
    ui.hud([
      `${name} · ${fmtCount(R.agentCount)} AGENTS · ${fps} FPS${mode}`,
      `NETWORK ≈ ${S.km} KM (EST.) · LINKED ${S.stations.linkedCount}/${st}`,
      state,
    ]);
    ui.sync();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
  else if (!S.lost) loopStart();
});

// Debug/test hook (read-only snapshot).
window.__physarum = {
  // Luminance variance of the current frame (rendered and read in the same task).
  pixelVariance() {
    S.renderer.render();
    const c = document.createElement('canvas'); c.width = 160; c.height = 100;
    const x = c.getContext('2d'); x.drawImage(glCanvas, 0, 0, 160, 100);
    const d = x.getImageData(0, 0, 160, 100).data; let s = 0, s2 = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; }
    return s2 / n - (s / n) ** 2;
  },
  probeURL() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), im = x.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) { const r = S.lastProbe[i * 4]; im.data[i * 4] = r; im.data[i * 4 + 1] = r > 46 ? 255 : 0; im.data[i * 4 + 2] = 0; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); return c.toDataURL();
  },
  get state() {
    return {
      renderer: S.renderer.kind, stations: S.stations.list.length, linked: S.stations.linkedCount, km: S.km,
      expo: S.expo, litFrac: S.litFrac, fps, ema: G.ema, tier: S.renderer.tier, agents: S.renderer.agentCount, paused: S.paused,
      preset: S.params.preset, species: S.params.species, cur: { ...S.params.cur }, lost: S.lost,
      names: S.stations.list.map((s) => s.name), pos: S.stations.list.map((s) => [s.u, s.v]),
    };
  },
};

loopStart();
