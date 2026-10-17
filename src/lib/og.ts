// Text-only Open Graph image, rendered at build time from the site data: /og.png in English, /es/og.png in Spanish.
// Newsreader sets the name, as on the page; Inter stands in for SF Pro, which can't be used outside Apple platforms.
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getSite, type Lang } from '../i18n';

const font = (weight: number) =>
  readFile(`${process.cwd()}/node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`);

export async function ogImage(lang: Lang): Promise<Response> {
  const site = getSite(lang);
  const [regular, bold, display] = await Promise.all([
    font(400),
    font(700),
    readFile(`${process.cwd()}/public/fonts/newsreader-display-600.woff2`),
  ]);

  const node = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 88px',
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontFamily: 'Newsreader', fontSize: 72, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.05 },
            children: site.name,
          },
        },
        {
          type: 'div',
          props: {
            style: { marginTop: 24, display: 'flex', flexDirection: 'column', fontSize: 40, lineHeight: 1.35, color: '#6e6e73' },
            children: site.ogLines.map((line) => ({ type: 'div', props: { children: line } })),
          },
        },
        {
          type: 'div',
          props: { style: { marginTop: 56, fontSize: 30, color: '#3730a3' }, children: 'castrejon.mx' },
        },
      ],
    },
  };

  const svg = await satori(node as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: bold, weight: 700, style: 'normal' },
      { name: 'Newsreader', data: display, weight: 600, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
