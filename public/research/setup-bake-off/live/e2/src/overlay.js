// 2D overlay: station glyphs, labels, hover ring, searching pulse, brush cursor, focus ring.
const FONT = '10.5px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const INK = '#f4f1ea', DARK = '#07080b', ACCENT = '#19c3d6';

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 1; this.h = 1; this.dpr = 1;
    this.hasLS = 'letterSpacing' in this.ctx;
  }
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
  }
  draw(s) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (s.hidden) return;
    drawScene(ctx, this.w, this.h, s, 1, this.hasLS);
  }
}

function label(ctx, text, x, y, align, hasLS, alpha = 1) {
  ctx.font = FONT;
  if (hasLS) ctx.letterSpacing = '0.12em';
  ctx.textAlign = align;
  ctx.globalAlpha = alpha;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(7,8,11,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = 'rgba(244,241,234,0.78)';
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
  if (hasLS) ctx.letterSpacing = '0px';
}

function glyph(ctx, x, y, r, linked, scale = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(7,8,11,0.92)'; ctx.fill();
  ctx.lineWidth = 4.5 * scale; ctx.strokeStyle = DARK; ctx.stroke();
  ctx.lineWidth = 2.5 * scale; ctx.strokeStyle = INK; ctx.stroke();
  if (linked) { ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); }
}

// Shared with the poster (scale = 2).
export function drawScene(ctx, w, h, s, scale, hasLS) {
  const now = s.now;
  ctx.save();
  ctx.scale(scale, scale);
  // Hover sensor ring over empty space.
  if (s.hover && !s.hover.station && s.hover.mouse && !s.dragging) {
    ctx.save();
    ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(244,241,234,0.18)';
    ctx.beginPath(); ctx.arc(s.hover.x, s.hover.y, Math.max(4, s.soCss), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Brush cursor while painting.
  if (s.brush) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = s.brush.kind === 'lake' ? 'rgba(120,170,255,0.55)' : 'rgba(25,195,214,0.55)';
    ctx.setLineDash(s.brush.kind === 'lake' ? [] : [2, 3]);
    ctx.beginPath(); ctx.arc(s.brush.x, s.brush.y, s.brush.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Dying stations shrink.
  for (const d of s.dying) {
    const t = (now - d.died) / 260;
    if (t >= 1) continue;
    ctx.globalAlpha = 1 - t;
    glyph(ctx, d.u * w, d.v * h, 7 * (1 - t) + 0.5, false, scale > 1 ? 1 : 1);
    ctx.globalAlpha = 1;
  }
  for (const st of s.stations) {
    const x = st.u * w, y = st.v * h;
    const hov = s.hover && s.hover.station === st;
    const drag = s.dragging === st;
    let r = hov || drag ? 9 : 7;
    const age = now - st.born;
    if (age < 300 && !s.reduced) r *= 0.4 + 0.6 * (age / 300);
    // Searching pulse for long-unlinked stations.
    if (!st.linked && age > 15000 && s.showAids) {
      ctx.save();
      if (s.reduced) {
        ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(244,241,234,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
      } else {
        const ph = ((now / 1600) % 1);
        ctx.strokeStyle = `rgba(244,241,234,${0.28 * (1 - ph)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 9 + ph * 22, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    // First-link flash.
    if (st.flash && !s.reduced) {
      const t = (now - st.flash) / 900;
      if (t < 1) {
        ctx.save();
        ctx.strokeStyle = `rgba(25,195,214,${0.9 * (1 - t)})`; ctx.lineWidth = 2 * (1 - t) + 0.5;
        ctx.beginPath(); ctx.arc(x, y, 8 + t * 20, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    glyph(ctx, x, y, r, st.linked);
    if (s.focus === st) {
      ctx.save();
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  // Labels after all glyphs: try right, left, above, below; skip spots that collide with a placed
  // label, another station's glyph or the edge. If nothing fits, draw on the right, dimmed.
  ctx.font = FONT;
  const placed = [];
  let cur = null;
  const hits = (r) => r[0] < 4 || r[1] < 4 || r[2] > w - 4 || r[3] > h - 4
    || placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])
    || s.stations.some((o) => o !== cur && Math.abs(o.u * w - (r[0] + r[2]) / 2) < (r[2] - r[0]) / 2 + 10
      && Math.abs(o.v * h - (r[1] + r[3]) / 2) < (r[3] - r[1]) / 2 + 10);
  for (const st of s.stations) {
    cur = st;
    const x = st.u * w, y = st.v * h;
    const tw = ctx.measureText(st.name).width * 1.12;
    const opts = [
      [x + 14, y + 4, 'left', [x + 12, y - 8, x + 16 + tw, y + 7]],
      [x - 17, y + 4, 'right', [x - 19 - tw, y - 8, x - 15, y + 7]],
      [x, y - 16, 'center', [x - tw / 2 - 2, y - 28, x + tw / 2 + 2, y - 13]],
      [x, y + 26, 'center', [x - tw / 2 - 2, y + 14, x + tw / 2 + 2, y + 29]],
    ];
    let pick = opts.find((o) => !hits(o[3]));
    let alpha = 1;
    if (!pick) { pick = x + 14 + tw > w - 8 ? opts[1] : opts[0]; alpha = 0.45; }
    placed.push(pick[3]);
    label(ctx, st.name, pick[0], pick[1], pick[2], hasLS, alpha);
  }
  ctx.restore();
}
