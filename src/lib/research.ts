// Helpers shared by the research index, the essay pages and the sitemap, in both languages.
// English essays are the 'research' collection; their Spanish translations are 'researchEs', with the same slugs.
import { getCollection, type CollectionEntry } from 'astro:content';
import { statSync } from 'node:fs';
import type { Lang } from '../i18n';

export type Essay = CollectionEntry<'research'> | CollectionEntry<'researchEs'>;

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};

/** 'YYYY' stays as is; 'YYYY-MM' becomes 'October 2026' or 'octubre de 2026'. */
export function formatDate(date: string, lang: Lang = 'en'): string {
  const [y, m] = date.split('-');
  if (!m) return y;
  const month = MONTHS[lang][Number(m) - 1];
  return lang === 'es' ? `${month} de ${y}` : `${month} ${y}`;
}

const rank = { agents: 0, academic: 1 } as const;

/** Essays in one language, sorted by group (agents first) and then by `order`. The Spanish list may be partial or empty. */
export async function getEssays(lang: Lang = 'en'): Promise<Essay[]> {
  const essays: Essay[] = lang === 'es' ? await getCollection('researchEs') : await getCollection('research');
  return essays.sort((a, b) => rank[a.data.group] - rank[b.data.group] || a.data.order - b.data.order);
}

/** Slugs that exist in both languages. */
export async function translatedSlugs(): Promise<Set<string>> {
  const en = new Set((await getEssays('en')).map((e) => e.id));
  return new Set((await getEssays('es')).map((e) => e.id).filter((id) => en.has(id)));
}

/**
 * In Spanish copy, a link to /es/research/<slug>/ whose translation doesn't exist yet points to the English essay,
 * so no link on the Spanish pages ends in a 404 while essays are being translated.
 */
export function fallbackHref(href: string, available: Set<string>): string {
  const m = href.match(/^\/es\/research\/([^/#]+)\/(#.*)?$/);
  return m && !available.has(m[1]) ? `/research/${m[1]}/${m[2] ?? ''}` : href;
}

/** fallbackHref for every href in an HTML string; a link that now leads to English gets hreflang="en". */
export function fallbackLinks(html: string, available: Set<string>): string {
  return html.replace(/href="(\/es\/research\/[^"]+)"/g, (m, href) => {
    const to = fallbackHref(href, available);
    return to === href ? m : `href="${to}" hreflang="en"`;
  });
}

/** Last modification of a source file as YYYY-MM-DD, for the sitemap. Falls back to the build date. */
export function lastmod(...files: (string | undefined)[]): string {
  let latest = 0;
  for (const f of files) {
    if (!f) continue;
    try {
      latest = Math.max(latest, statSync(f).mtimeMs);
    } catch {
      // A missing file just doesn't count.
    }
  }
  return new Date(latest || Date.now()).toISOString().slice(0, 10);
}
