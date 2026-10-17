// The site in two languages. English lives at /, Spanish mirrors every page under /es/ with the same slugs.
// Copy comes from src/data/site.ts (English) and src/data/site.es.ts (Spanish), which must have the same shape:
// the build stops if a key is missing, extra, or an array has a different length.
import { site as en } from './data/site';
import { site as es } from './data/site.es';

export type Lang = 'en' | 'es';
export type Site = typeof en;

export const LANGS: Lang[] = ['en', 'es'];
export const other = (lang: Lang): Lang => (lang === 'en' ? 'es' : 'en');

/** Each language's name in itself, for the toggle's accessible names. */
export const ENDONYM: Record<Lang, string> = { en: 'English', es: 'Español' };
/** BCP 47 tags for hreflang. */
export const HREFLANG: Record<Lang, string> = { en: 'en', es: 'es' };

const SITES: Record<Lang, Site> = { en, es };

export function getSite(lang: Lang): Site {
  return SITES[lang];
}

/** '/research/x/' in a language: English paths are unprefixed, Spanish ones start with /es. */
export function localize(path: string, lang: Lang): string {
  return lang === 'es' ? `/es${path}` : path;
}

// Shape check: same keys at every level, same array lengths. Runs once at build time.
function shape(a: unknown, b: unknown, at: string): string[] {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return [`${at}: array in one file only`];
    if (a.length !== b.length) return [`${at}: ${a.length} items in site.ts, ${b.length} in site.es.ts`];
    return a.flatMap((x, i) => shape(x, b[i], `${at}[${i}]`));
  }
  const isObj = (x: unknown) => typeof x === 'object' && x !== null;
  if (isObj(a) || isObj(b)) {
    if (!isObj(a) || !isObj(b)) return [`${at}: object in one file only`];
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    const errs = [
      ...ka.filter((k) => !kb.includes(k)).map((k) => `${at}.${k}: missing in site.es.ts`),
      ...kb.filter((k) => !ka.includes(k)).map((k) => `${at}.${k}: not in site.ts`),
    ];
    return errs.concat(ka.filter((k) => kb.includes(k)).flatMap((k) => shape((a as any)[k], (b as any)[k], `${at}.${k}`)));
  }
  return typeof a === typeof b ? [] : [`${at}: ${typeof a} in site.ts, ${typeof b} in site.es.ts`];
}

const mismatch = shape(en, es, 'site');
if (mismatch.length) throw new Error(`site.ts and site.es.ts differ in shape:\n${mismatch.join('\n')}`);
