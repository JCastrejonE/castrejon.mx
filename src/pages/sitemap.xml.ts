// The sitemap, generated at build time: the home page, the research index and every essay.
// lastmod is the newest modification time of the files each page is built from.
import type { APIRoute } from 'astro';
import { resolve } from 'node:path';
import { site } from '../data/site';
import { getEssays, lastmod } from '../lib/research';

export const prerender = true;

// Paths are relative to the project root, where the build runs.
const src = (p: string) => resolve('src', p);

export const GET: APIRoute = async () => {
  const essays = await getEssays();
  const essayFiles = essays.map((e) => e.filePath && resolve(e.filePath));
  const pages = [
    { loc: '/', lastmod: lastmod(src('data/site.ts'), src('pages/index.astro')) },
    { loc: '/research/', lastmod: lastmod(src('pages/research/index.astro'), ...essayFiles) },
    ...essays.map((e) => ({ loc: `/research/${e.id}/`, lastmod: lastmod(e.filePath && resolve(e.filePath)) })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>\n    <loc>${new URL(p.loc, site.url).href}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
