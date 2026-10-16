// Dibujo Canvas 2D: estelas, composición aditiva, color por velocidad/ángulo, DPR.
import { colorAt } from "./palettes.js";

const BINS = 32;          // colores discretos: un trazo (path) por color y fotograma
const FADE = 0.07;        // opacidad del velo que borra poco a poco el fotograma anterior
const SPEED_REF = 150;    // px/s que corresponden al extremo alto de la paleta

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let lutFor = null, lut = [], fadeStyle = "", bgStyle = "";
  let bins = new Uint8Array(0);

  function usePalette(palette) {
    if (lutFor === palette) return;
    lutFor = palette;
    lut = Array.from({ length: BINS }, (_, i) => colorAt(palette, i / (BINS - 1)));
    const [r, g, b] = palette.background;
    fadeStyle = `rgba(${r}, ${g}, ${b}, ${FADE})`;
    bgStyle = `rgb(${r}, ${g}, ${b})`;
  }

  const r = {
    ctx,
    dpr: 1,
    width: 0,
    height: 0,

    /** Ajusta el búfer a píxeles físicos y dibuja en píxeles CSS. */
    resize(cssW, cssH, dpr) {
      r.dpr = dpr; r.width = cssW; r.height = cssH;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
    },

    clear(palette) {
      usePalette(palette);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, r.width, r.height);
    },

    draw(particles, palette) {
      usePalette(palette);
      const { count, x, y, px, py, vx, vy } = particles;

      // Estelas: velo semitransparente del color de fondo sobre el fotograma anterior.
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = fadeStyle;
      ctx.fillRect(0, 0, r.width, r.height);

      // Color: sobre todo la velocidad, matizada por la dirección del movimiento.
      if (bins.length < count) bins = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        const s = Math.min(1, Math.hypot(vx[i], vy[i]) / SPEED_REF);
        const a = 0.5 + 0.5 * Math.sin(Math.atan2(vy[i], vx[i]));
        bins[i] = Math.min(BINS - 1, Math.floor((0.7 * s + 0.3 * a) * BINS));
      }

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.2;
      for (let b = 0; b < BINS; b++) {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          if (bins[i] !== b) continue;
          ctx.moveTo(px[i], py[i]);
          ctx.lineTo(x[i] + 0.01, y[i]); // +0.01: un segmento nulo no pinta nada
        }
        ctx.strokeStyle = lut[b];
        ctx.stroke();
      }
    },
  };
  return r;
}
