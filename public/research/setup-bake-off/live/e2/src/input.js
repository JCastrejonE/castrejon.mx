// Pointer Events gesture state machine (keyed by pointerId) + keyboard dispatch.
const TAP_MOVE = 8, TAP_MS = 350, LONG_MS = 500, DBL_MS = 350, MULTI_MS = 300;

export function attachInput(el, app) {
  const ptrs = new Map();
  let lastTap = null;

  const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };

  function paintAlong(g, x, y, w, h) {
    const kind = g.kind === 'lake2' ? 'lake' : g.kind;
    const lx = g.px ?? x, ly = g.py ?? y;
    const d = Math.hypot(x - lx, y - ly), n = Math.min(12, Math.max(1, Math.ceil(d / 7)));
    for (let i = 1; i <= n; i++) {
      const t = i / n, px = lx + (x - lx) * t, py = ly + (y - ly) * t;
      if (kind === 'lake') app.paintLake(px / w, py / h); else app.paintSeed(px / w, py / h);
    }
    g.px = x; g.py = y;
    app.setBrush({ kind, x, y, u: x / w, v: y / h });
  }

  function twoFingerCentroid() {
    let sx = 0, sy = 0, n = 0;
    for (const g of ptrs.values()) if (g.kind === 'lake2') { sx += g.x; sy += g.y; n++; }
    return n ? [sx / n, sy / n] : null;
  }

  el.addEventListener('pointerdown', (e) => {
    const [x, y, w, h] = pos(e);
    const now = performance.now();
    app.interacted();
    const ae = document.activeElement;
    if (ae && ae !== el && ae !== document.body && ae.blur) ae.blur();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const touch = e.pointerType !== 'mouse';
    const g = { id: e.pointerId, type: e.pointerType, x0: x, y0: y, x, y, t0: now, kind: 'pending', station: null, moved: false, timer: 0 };

    // Second touch within 300 ms converts to a two-finger lake paint.
    if (touch) {
      const others = [...ptrs.values()].filter((o) => o.type !== 'mouse');
      if (others.length === 1 && now - others[0].t0 < MULTI_MS) {
        const o = others[0];
        clearTimeout(o.timer);
        if (o.kind === 'drag' && o.station && o.startUV) app.moveStation(o.station, o.startUV[0], o.startUV[1]);
        o.kind = 'lake2'; g.kind = 'lake2';
        app.setDragging(null);
        ptrs.set(e.pointerId, g);
        const c = twoFingerCentroid(); const gg = { kind: 'lake2' };
        paintAlong(gg, c[0], c[1], w, h); g.px = c[0]; g.py = c[1];
        e.preventDefault();
        return;
      }
    }
    if (e.pointerType === 'mouse' && e.button === 2) g.kind = 'lake';
    else if (e.pointerType === 'mouse' && e.button !== 0) return;
    else if (e.shiftKey && !touch) g.kind = 'seed';
    else {
      const st = app.hitStation(x, y, touch ? 18 : 12);
      if (st) {
        if (lastTap && lastTap.station === st && now - lastTap.t < DBL_MS) {
          app.deleteStation(st); lastTap = null; g.kind = 'none';
        } else {
          g.kind = 'drag'; g.station = st; g.startUV = [st.u, st.v];
          g.off = [st.u * w - x, st.v * h - y];
          app.setDragging(st);
          if (touch) g.timer = setTimeout(() => {
            if (!g.moved && g.kind === 'drag') { app.deleteStation(st); g.kind = 'none'; app.setDragging(null); }
          }, LONG_MS);
        }
      } else if (touch && app.mode === 'lake') g.kind = 'lake';
      else if (touch && app.mode === 'seed') g.kind = 'seed';
    }
    ptrs.set(e.pointerId, g);
    if (g.kind === 'lake' || g.kind === 'seed') paintAlong(g, x, y, w, h);
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    const [x, y, w, h] = pos(e);
    const g = ptrs.get(e.pointerId);
    if (!g) {
      if (e.pointerType === 'mouse') {
        const st = app.hitStation(x, y, 12);
        app.setHover({ x, y, station: st, mouse: true });
        el.style.cursor = st ? 'grab' : 'crosshair';
      }
      return;
    }
    g.x = x; g.y = y;
    if (!g.moved && Math.hypot(x - g.x0, y - g.y0) > TAP_MOVE) { g.moved = true; clearTimeout(g.timer); }
    if (g.kind === 'drag') {
      if (g.moved) { app.moveStation(g.station, (x + g.off[0]) / w, (y + g.off[1]) / h); el.style.cursor = 'grabbing'; }
    } else if (g.kind === 'lake' || g.kind === 'seed') paintAlong(g, x, y, w, h);
    else if (g.kind === 'lake2') {
      const c = twoFingerCentroid();
      const lead = [...ptrs.values()].find((o) => o.kind === 'lake2');
      if (c && lead === g) paintAlong(g, c[0], c[1], w, h);
    } else if (g.kind === 'pending' && g.moved) g.kind = 'none';
    if (e.pointerType === 'mouse') app.setHover({ x, y, station: g.station, mouse: true });
  });

  function end(e, cancelled) {
    const g = ptrs.get(e.pointerId);
    if (!g) return;
    ptrs.delete(e.pointerId);
    clearTimeout(g.timer);
    const now = performance.now();
    const [x, y, w, h] = pos(e);
    if (!cancelled) {
      if (g.kind === 'pending' && !g.moved && now - g.t0 < TAP_MS) app.addStation(x / w, y / h);
      if (g.kind === 'drag') { if (!g.moved) lastTap = { station: g.station, t: now }; else lastTap = null; }
    }
    if (g.kind === 'drag') app.setDragging(null);
    if (g.kind === 'lake2') for (const [id, o] of ptrs) if (o.kind === 'lake2') o.kind = 'none';
    if (![...ptrs.values()].some((o) => o.kind === 'lake' || o.kind === 'seed' || o.kind === 'lake2')) app.setBrush(null);
    if (e.pointerType === 'mouse') el.style.cursor = app.hitStation(x, y, 12) ? 'grab' : 'crosshair';
  }
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ptrs.has(e.pointerId)) app.setHover(null); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('dblclick', (e) => e.preventDefault());
  return { get activeCount() { return ptrs.size; } };
}

export function isFormTarget(t) {
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
