// The sitemap, generated at build time: both homes, both research indexes and every essay in each language.
// A page that exists in both languages lists both versions as xhtml:link alternates (English is x-default).
// lastmod is the newest modification time of the files each page is built from.
import type { APIRoute } from 'astro';
import { resolve } from 'node:path';
import { getSite } from '../i18n';
import { getEssays, lastmod } from '../lib/research';

export const prerender = true;

// Paths are relative to the project root, where the build runs.
const src = (p: string) => resolve('src', p);
const abs = (p: string) => new URL(p, getSite('en').url).href;

type Page = { loc: string; lastmod: string; alternates?: { en: string; es: string } };

export const GET: APIRoute = async () => {
  const [essays, essaysEs] = await Promise.all([getEssays('en'), getEssays('es')]);
  const file = (e: { filePath?: string }) => e.filePath && resolve(e.filePath);
  const es = new Map(essaysEs.map((e) => [e.id, e]));
  const [en, es_] = [getSite('en'), getSite('es')];
  const home = { en: en.paths.home, es: es_.paths.home };
  const index = { en: en.paths.research, es: es_.paths.research };
  const essayPath = (lang: 'en' | 'es', id: string) => `${index[lang]}${id}/`;
  const pair = (id: string) => (es.has(id) ? { en: essayPath('en', id), es: essayPath('es', id) } : undefined);

  const pages: Page[] = [
    { loc: home.en, lastmod: lastmod(src('data/site.ts'), src('components/HomePage.astro')), alternates: home },
    { loc: home.es, lastmod: lastmod(src('data/site.es.ts'), src('components/HomePage.astro')), alternates: home },
    { loc: index.en, lastmod: lastmod(src('components/ResearchIndexPage.astro'), ...essays.map(file)), alternates: index },
    { loc: index.es, lastmod: lastmod(src('components/ResearchIndexPage.astro'), src('data/site.es.ts'), ...essaysEs.map(file)), alternates: index },
    ...essays.map((e) => ({ loc: essayPath('en', e.id), lastmod: lastmod(file(e)), alternates: pair(e.id) })),
    ...essaysEs.map((e) => ({ loc: essayPath('es', e.id), lastmod: lastmod(file(e)), alternates: pair(e.id) })),
  ];

  const url = (p: Page) => {
    const links = p.alternates
      ? [
          ['en', p.alternates.en],
          ['es', p.alternates.es],
          ['x-default', p.alternates.en],
        ].map(([lang, href]) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${abs(href)}"/>`)
      : [];
    return `  <url>\n    <loc>${abs(p.loc)}</loc>\n    <lastmod>${p.lastmod}</lastmod>${links.join('')}\n  </url>`;
  };

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.map(url).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
