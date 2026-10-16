// Optional pentatonic chime. Lazy AudioContext; off by default.
let ctx = null, comp = null, voices = 0, last = 0;
export const audio = { enabled: false };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  return ctx;
}

export function toggleSound() {
  try {
    audio.enabled = !audio.enabled;
    if (audio.enabled) { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
  } catch (e) { console.warn('[physarum] audio unavailable', e); audio.enabled = false; }
  return audio.enabled;
}

const DEG = [0, 2, 4, 7, 9];
export function chime(index, u) {
  if (!audio.enabled || !ctx) return;
  try {
    const now = ctx.currentTime;
    if (voices >= 6 || now - last < 0.15) return;
    last = now;
    const semis = DEG[index % 5] + 12 * (Math.floor(index / 5) % 3);
    const f = 220 * Math.pow(2, semis / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    let out = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, u * 2 - 1)); g.connect(p); out = p; }
    out.connect(comp);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    o1.start(now); o2.start(now); o1.stop(now + 1.25); o2.stop(now + 1.25);
    voices++;
    o1.onended = () => { voices--; try { out.disconnect(); } catch (e) {} };
  } catch (e) { console.warn('[physarum] chime failed', e); }
}
