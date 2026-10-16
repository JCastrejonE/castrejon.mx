const DRAG_THRESHOLD = 6; // css px before a press counts as a drag rather than a click

/**
 * Translates pointer and keyboard events into intents. Coordinates are css px relative to the canvas.
 *   onPaint(x0, y0, x1, y1, repel)  — drag segment
 *   onBurst(x, y)                   — primary-button click / tap
 *   onKey(key, event)               — non-repeating key press
 */
export function bindInput(canvas, { onPaint, onBurst, onKey, onActivity }) {
  let press = null; // only one pointer paints at a time; extra fingers are ignored

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    onActivity();
    if (press) return;
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    press = { id: e.pointerId, button: e.button, x, y, lx: x, ly: y, dragging: false, repel: e.button === 2 || e.shiftKey };
  });

  canvas.addEventListener('pointermove', (e) => {
    onActivity();
    if (!press || press.id !== e.pointerId) return;
    const [x, y] = local(e);
    if (!press.dragging && Math.hypot(x - press.x, y - press.y) > DRAG_THRESHOLD) press.dragging = true;
    if (press.dragging) {
      onPaint(press.lx, press.ly, x, y, press.repel || e.shiftKey);
      press.lx = x; press.ly = y;
    }
  });

  const end = (e) => {
    if (!press || press.id !== e.pointerId) return;
    if (!press.dragging && press.button === 0 && e.type === 'pointerup') onBurst(...local(e));
    press = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // a keyboard-focused button owns Space/Enter; everything else is a global shortcut
    if ((e.key === ' ' || e.key === 'Enter') && e.target instanceof HTMLElement && e.target.closest('button')) return;
    onActivity();
    if (e.repeat) return;
    onKey(e.key.toLowerCase(), e);
  });
}
