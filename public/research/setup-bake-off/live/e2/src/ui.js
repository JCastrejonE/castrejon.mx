// DOM UI: HUD, panel, help dialog, hint pill, toasts, mobile mode toggle.
import { PRESETS, BOUNDS } from './params.js';

const $ = (id) => document.getElementById(id);

const SLIDERS = [
  { key: 'SA', label: 'Sensor angle', step: 0.5, fmt: (v) => v.toFixed(1) + '°' },
  { key: 'SO', label: 'Sensor distance', step: 0.5, fmt: (v) => v.toFixed(1) + ' px' },
  { key: 'RA', label: 'Turn rate', step: 0.5, fmt: (v) => v.toFixed(1) + '°' },
  { key: 'SS', label: 'Speed', step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'decay', label: 'Decay', step: 0.001, fmt: (v) => v.toFixed(3) },
  { key: 'rivalry', label: 'Rivalry', step: 0.05, fmt: (v) => v.toFixed(2) },
];

export function fmtCount(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}

export function createUI(app) {
  const panel = $('panel'), toggle = $('panelToggle'), help = $('help');
  const inputs = {};

  // Preset chips.
  const chips = $('presetChips');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = `${i + 1} ${p.name}`; b.dataset.preset = i;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => app.setPreset(i));
    chips.appendChild(b);
  });

  // Sliders.
  const box = $('sliders');
  const mk = (key, label, min, max, step, onInput) => {
    const wrap = document.createElement('div'); wrap.className = 'slider';
    const id = 'r_' + key;
    const l = document.createElement('label'); l.htmlFor = id; l.textContent = label;
    const out = document.createElement('output'); out.htmlFor = id;
    const inp = document.createElement('input');
    Object.assign(inp, { type: 'range', id, min, max, step });
    inp.addEventListener('input', () => onInput(parseFloat(inp.value)));
    wrap.append(l, out, inp); box.appendChild(wrap);
    return { inp, out };
  };
  for (const s of SLIDERS) {
    const [min, max] = BOUNDS[s.key];
    inputs[s.key] = { ...mk(s.key, s.label, min, max, s.step, (v) => { app.setParam(s.key, v); inputs[s.key].out.value = s.fmt(v); }), fmt: s.fmt };
  }
  inputs.tier = { ...mk('tier', 'Density', 0, 4, 1, (v) => app.setTier(4 - v)), fmt: null };

  document.querySelectorAll('#speciesSeg button').forEach((b) => b.addEventListener('click', () => app.setSpecies(+b.dataset.species)));
  document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
    app.mode = b.dataset.mode;
    document.querySelectorAll('#modeSeg button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  }));
  $('bReseed').addEventListener('click', () => app.reseed());
  $('bClear').addEventListener('click', () => app.clearTrail());
  $('bEvolve').addEventListener('click', () => app.toggleEvolve());
  $('bPoster').addEventListener('click', () => app.poster());
  $('bShare').addEventListener('click', () => app.share());
  $('bSound').addEventListener('click', () => app.toggleSound());
  $('playBtn').addEventListener('click', () => app.play());

  const setPanel = (open) => {
    // Closing while focus is inside the panel would drop focus to <body>; hand it to the toggle.
    const hadFocus = !open && panel.contains(document.activeElement);
    panel.hidden = !open;
    if (hadFocus) toggle.focus();
    toggle.setAttribute('aria-expanded', String(open));
    if (open) api.sync(true);
  };
  toggle.addEventListener('click', () => setPanel(panel.hidden));
  $('panelClose').addEventListener('click', () => setPanel(false));

  const openHelp = () => {
    if (help.open) return;
    try { help.showModal(); } catch (e) { help.setAttribute('open', ''); }
    $('helpClose').focus();
  };
  const closeHelp = () => { if (help.open) help.close(); };
  $('helpBtn').addEventListener('click', openHelp);
  $('helpClose').addEventListener('click', closeHelp);
  help.addEventListener('click', (e) => { if (e.target === help) closeHelp(); });
  // Focus trap (showModal already makes the page inert; this keeps Tab cycling inside).
  help.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...help.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Hint pill.
  const hint = $('hint');
  const mobile = matchMedia('(pointer: coarse)').matches;
  hint.textContent = mobile
    ? 'tap: station · drag: reroute · 2 fingers: lake · ?: help'
    : 'tap to place stations · drag to reroute · right-drag / two fingers for lakes · ? for help';
  let hintGone = false;
  const hideHint = () => { if (hintGone) return; hintGone = true; hint.classList.remove('show'); };
  setTimeout(() => { if (!hintGone) hint.classList.add('show'); }, 800);
  setTimeout(hideHint, 7000);

  const toasts = $('toasts');
  const sr = $('sr');
  const hud = [$('hud1'), $('hud2'), $('hud3')];
  const last = ['', '', ''];

  const api = {
    hideHint,
    get panelOpen() { return !panel.hidden; },
    get helpOpen() { return help.open; },
    setPanel, openHelp, closeHelp,
    toggleHelp() { help.open ? closeHelp() : openHelp(); },
    toast(msg) {
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
      toasts.appendChild(t);
      while (toasts.children.length > 3) toasts.firstChild.remove();
      setTimeout(() => t.remove(), 1650);
    },
    announce(msg) { sr.textContent = ''; setTimeout(() => { sr.textContent = msg; }, 30); },
    hud(lines) {
      for (let i = 0; i < 3; i++) if (lines[i] !== last[i]) { hud[i].textContent = lines[i]; last[i] = lines[i]; }
    },
    growing(on) { $('growing').hidden = !on; },
    showPlay(on) { $('playBtn').hidden = !on; document.body.classList.toggle('play-visible', on); },
    // Reflect state into the panel. Skips the control that currently has focus.
    sync(force) {
      if (!force && panel.hidden) return;
      const s = app.snapshot();
      for (const k in s.cur) {
        const c = inputs[k]; if (!c) continue;
        if (document.activeElement !== c.inp) c.inp.value = s.cur[k];
        c.out.value = c.fmt(s.cur[k]);
      }
      if (document.activeElement !== inputs.tier.inp) inputs.tier.inp.value = 4 - s.tier;
      inputs.tier.out.value = fmtCount(s.agents);
      inputs.rivalry.inp.disabled = s.species === 1;
      chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.preset === s.preset)));
      document.querySelectorAll('#speciesSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.species === s.species)));
      $('bEvolve').setAttribute('aria-pressed', String(s.evolve));
      $('bSound').setAttribute('aria-pressed', String(s.sound));
      $('bEvolve').disabled = s.reduced;
    },
  };
  return api;
}
