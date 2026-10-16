// Paletas de color: cada una con un fondo y una rampa de paradas RGB.
// `name` va en el hash de la URL (ASCII); `label` es el nombre que se muestra.

/** Cada paleta: { name, label, background: [r,g,b], stops: [[r,g,b], ...] }. */
export const PALETTES = [
  {
    name: "aurora", label: "aurora", background: [3, 6, 14],
    stops: [[18, 42, 110], [22, 150, 160], [90, 230, 150], [190, 120, 255]],
  },
  {
    name: "brasa", label: "brasa", background: [10, 4, 3],
    stops: [[80, 8, 12], [200, 50, 18], [250, 140, 36], [255, 228, 160]],
  },
  {
    name: "oceano", label: "océano", background: [2, 7, 16],
    stops: [[8, 34, 84], [16, 96, 160], [48, 176, 212], [196, 242, 255]],
  },
  {
    name: "monocromo", label: "monocromo", background: [6, 6, 7],
    stops: [[48, 48, 52], [130, 130, 136], [228, 228, 232]],
  },
  {
    name: "neon", label: "neón", background: [7, 2, 12],
    stops: [[120, 20, 150], [240, 40, 130], [60, 120, 255], [40, 230, 240]],
  },
];

/** Color CSS para u en [0, 1] dentro de la paleta (interpolación lineal entre paradas). */
export function colorAt(palette, u) {
  const { stops } = palette;
  const f = Math.max(0, Math.min(1, u)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const k = f - i;
  const a = stops[i], b = stops[i + 1];
  const c = (j) => Math.round(a[j] + (b[j] - a[j]) * k);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}
