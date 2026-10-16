// Generates the favicons once: npm run icons. The outputs in public/ are committed.
// The "JC" monogram is drawn as paths (via satori) so it renders the same everywhere.
import { readFile, writeFile } from 'node:fs/promises';
import satori from 'satori';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const bold = await readFile('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff');

// Monogram paths on a transparent 64x64 canvas.
const glyphSvg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: '-0.04em',
        color: '#000',
      },
      children: 'JC',
    },
  },
  { width: 64, height: 64, fonts: [{ name: 'Inter', data: bold, weight: 700, style: 'normal' }] },
);

const paths = [...glyphSvg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]).join(' ');
if (!paths) throw new Error('satori produced no glyph paths');

// favicon.svg: a black tile with a white monogram, inverted in dark mode.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<style>.t{fill:#000}.g{fill:#fff}@media (prefers-color-scheme:dark){.t{fill:#fff}.g{fill:#000}}</style>
<rect class="t" width="64" height="64" rx="14"/>
<path class="g" d="${paths}"/>
</svg>
`;
await writeFile('public/favicon.svg', favicon);

const tile = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="${rx}" fill="#000"/><path d="${paths}" fill="#fff"/></svg>`;

// Apple touch icon: full square, iOS applies its own corner mask.
await sharp(Buffer.from(tile(0)), { density: 1200 })
  .resize(180, 180)
  .flatten({ background: '#000000' })
  .png()
  .toFile('public/apple-touch-icon.png');

const ico = await Promise.all(
  [16, 32, 48].map((size) => sharp(Buffer.from(tile(14)), { density: 600 }).resize(size, size).png().toBuffer()),
);
await writeFile('public/favicon.ico', await pngToIco(ico));

console.log('Wrote public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png');
