// Helpers shared by the research index, the essay pages and the sitemap.
import { getCollection, type CollectionEntry } from 'astro:content';
import { statSync } from 'node:fs';

export type Essay = CollectionEntry<'research'>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 'YYYY' stays as is; 'YYYY-MM' becomes 'October 2026'. */
export function formatDate(date: string): string {
  const [y, m] = date.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

/** Essays sorted by group (agents first) and then by `order`. */
export async function getEssays(): Promise<Essay[]> {
  const rank = { agents: 0, academic: 1 } as const;
  const essays = await getCollection('research');
  return essays.sort((a, b) => rank[a.data.group] - rank[b.data.group] || a.data.order - b.data.order);
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
