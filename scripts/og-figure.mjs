// Builds an essay's Open Graph image from the screenshots of one of its figures: a grid on white, 1200x630.
// Write .jpg for screenshots (photographic content compresses far better than PNG).
// Usage: node scripts/og-figure.mjs <output.jpg|output.png> <columns> <image>...
// The setup bake-off uses Figure 1 (the six generated pages):
//   node scripts/og-figure.mjs public/research/setup-bake-off/og-figure-1.jpg 3 \
//     public/research/setup-bake-off/shots/{a,b,c,d,e2,f}-desktop.webp
import sharp from 'sharp';

const [out, colsArg, ...images] = process.argv.slice(2);
const cols = Number(colsArg);
if (!out || !cols || images.length === 0) {
  console.error('usage: node scripts/og-figure.mjs <output.jpg|output.png> <columns> <image>...');
  process.exit(1);
}

const W = 1200, H = 630, margin = 16, gap = 8;
const rows = Math.ceil(images.length / cols);
const first = await sharp(images[0]).metadata();
const ratio = first.height / first.width;
// Fit the grid to the width, then to the height if it is too tall.
let cellW = Math.floor((W - 2 * margin - (cols - 1) * gap) / cols);
let cellH = Math.round(cellW * ratio);
if (rows * cellH + (rows - 1) * gap > H - 2 * margin) {
  cellH = Math.floor((H - 2 * margin - (rows - 1) * gap) / rows);
  cellW = Math.round(cellH / ratio);
}
const gridW = cols * cellW + (cols - 1) * gap;
const gridH = rows * cellH + (rows - 1) * gap;
const x0 = Math.round((W - gridW) / 2), y0 = Math.round((H - gridH) / 2);

const tiles = await Promise.all(
  images.map(async (file, i) => ({
    input: await sharp(file).resize(cellW, cellH, { fit: 'cover' }).toBuffer(),
    left: x0 + (i % cols) * (cellW + gap),
    top: y0 + Math.floor(i / cols) * (cellH + gap),
  })),
);

const canvas = sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(tiles);
await (out.endsWith('.png') ? canvas.png({ compressionLevel: 9 }) : canvas.jpeg({ quality: 86, mozjpeg: true })).toFile(out);
console.log(`Wrote ${out} (${W}x${H}, ${images.length} images, ${cellW}x${cellH} each)`);
