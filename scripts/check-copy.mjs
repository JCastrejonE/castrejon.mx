// Lints the built pages' visible copy and metadata against the voice and accuracy rules.
// Run after a build: npm run build && npm run check:copy
// It reads every .html file under dist/, except the live bake-off pages, which are exhibits hosted unmodified.
// The language comes from <html lang>: English pages get the English rules, Spanish pages (lang="es…") the Spanish ones.
// The ruled-out claims, "QA", the phone number, the whole email address and the name's accent apply in both.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// voice-dna.md §3A, plus the §3B–§3E phrases most likely to slip in.
const BANNED = `delve realm harness unlock tapestry paradigm cutting-edge revolutionize landscape intricate intricacies
showcasing crucial pivotal surpass meticulously vibrant unparalleled underscore leverage synergy innovative game-changer
testament commendable meticulous highlight emphasize boast groundbreaking align foster showcase enhance holistic garner
accentuate pioneering trailblazing unleash versatile transformative redefine seamless optimize scalable robust
breakthrough empower streamline frictionless elevate adaptive effortless data-driven insightful proactive
mission-critical visionary disruptive reimagine unprecedented intuitive leading-edge synergize democratize accelerate
state-of-the-art dynamic immersive predictive transparent proprietary integrated plug-and-play turnkey future-proof
paradigm-shifting supercharge enduring interplay valuable captivate`.split(/\s+/);

const PHRASES = [
  'serves as', 'stands as', 'marks a', 'represents a', 'boasts a', 'features a', 'offers a',
  "in today's", 'it’s important to note', "it's important to note", 'worth noting', 'in order to',
  'straightforward', 'dive in', 'at the end of the day', 'moving forward', 'in other words', 'nobody',
  'furthermore', 'additionally', 'moreover', 'that said', 'with that in mind', 'on top of that',
  // Contrast reframes (voice-dna §3F)
  'rather than', 'instead of', 'not just', 'not only', 'isn’t', "isn't",
  // Idioms and phrasal verbs from §0
  'under the hood', 'a bit', 'kind of', 'set up', 'find out', 'figure out', 'come up with', 'look into',
  'carry out', 'deal with', 'get rid of', 'put together',
];

// Claims the owner has ruled out for the site (2026-10-15). Checked in visible text, metadata, JSON-LD and alt text.
const FORBIDDEN = [
  [/\bCodex\b/i, 'the Oracle Codex-based migration tool'],
  [/\b85\s?%/, 'the 85% migration figure'],
  [/at least 90\s?%|class-level coverage/i, 'the "at least 90% class-level coverage" figure'],
  [/\b(mentor\w*|pair(?:ed|ing)? with)\b/i, 'mentoring or pairing with the Oracle team'],
  [/\b\d{1,3}(?:,\d{3})+\s+lines\b|\b90,000\b/i, 'a line count for Odoo Launchpad'],
  [/\b(owned|led)\b[^.]{0,60}\b(backend infrastructure|smart contracts)\b/i, '"owned"/"led" for xBacked (use "contributed to")'],
  [/\bauthor\b[^.]{0,30}xbacked-sdk|xbacked-sdk[^.]{0,30}\bauthor\b/i, '"author" of xbacked-sdk (he is a core contributor)'],
  [/contributors reused|wallet-connection layer/i, 'a wallet layer other contributors reused'],
];

// Spanish: the same rules, for the Spanish edition (/es/). Entries match the start of a word, case-insensitive.
// Words banned only "as filler" in the style guide are banned outright here; rephrase if one is ever needed literally.
const BANNED_ES = [
  'robust', 'innovador', 'revolucionari', 'crucial', 'fundamental', 'potenci(?:ar|ado|ada|ando|amos|aron|ó)(?![\\p{L}])',
  'aprovech', 'sinergi', 'holístic', 'disruptiv', 'transformador', 'fluid[oa]s?(?![\\p{L}])', 'integral',
  // The verb "optimizar"; the noun "optimización" stays, it names a field ("optimización combinatoria").
  'optimiz(?:ar|a|an|amos|ado|ada|ados|adas|ando|ó|é|aron)(?![\\p{L}])', 'destac', 'resalt',
];

const PHRASES_ES = [
  'de vanguardia', 'sin fisuras', 'cabe destacar', 'es importante señalar', 'en el panorama actual', 'sin lugar a dudas',
  // Negate-then-assert (voice-dna §3F)
  'no solo', 'no sólo', 'sino también', 'en lugar de', 'en vez de',
];

const PATTERNS_ES = [
  [/\bno es [^.]{1,40}, es /i, 'negate-then-assert "no es X, es Y"'],
  [/\bno\b[^.;:]{1,60}\bsino\b/i, 'negate-then-assert "no X sino Y"'],
  // "clave" as an adjective ("un paso clave", "es clave"); the noun ("la clave de", "clave primaria") is fine.
  [/(?<![\p{L}])(?!(?:la|las|una|unas|su|sus|de|del|en|por|con|y|o|sin|cada|esta|esa|otra|cuya|nueva|palabras?)\s)\p{L}+\s+claves?(?![\p{L}])/iu, '"clave" as adjective filler'],
  // 2026 re-runs are described neutrally ("se volvió a ejecutar el 16 de octubre de 2026"), never in the first person.
  [/(?<![\p{L}])(?:volví a (?:ejecutar|correr|compilar)|re-?ejecuté|recompilé|reproduje)(?![\p{L}])/iu, 'first-person 2026 re-run'],
];

// The ruled-out claims, in Spanish. Spanish pages are checked against these and against FORBIDDEN.
const FORBIDDEN_ES = [
  [/\bal menos (?:un )?90\s?%/i, 'the "at least 90% class-level coverage" figure (al menos 90%)'],
  [/a nivel de clase|\bclass-level\b/i, 'the class-level coverage figure (class-level, a nivel de clase)'],
  [/(?<![\p{L}])(?:mentor|acompañ\p{L}*\s+(?:a|al)\s+(?:los\s+|las\s+)?(?:equipo|ingenier|desarrollador))/iu, 'mentoring the Oracle team (mentor…/acompañé al equipo)'],
  [/(?:l[ií]neas de c[oó]digo|lines of code)[^.]{0,100}Launchpad|Launchpad[^.]{0,100}(?:l[ií]neas de c[oó]digo|lines of code)/i, 'a line count for Odoo Launchpad'],
  [/\b90[\s\u00a0\u202f.]000\b/, 'a line count for Odoo Launchpad (90 000)'],
  [/\b(?:dirig|lider|encabe)\w*[^.]{0,80}\b(?:infraestructura|contratos)|xBacked[^.]{0,120}\b(?:dirig|lider|encabe|fui responsable)\w*|\b(?:dirig|lider|encabe|fui responsable)\w*[^.]{0,120}xBacked/i, '"owned"/"led" for xBacked (dirigí, lideré, encabecé, fui responsable de)'],
  [/\bautor\w*[^.]{0,30}xbacked-sdk|xbacked-sdk[^.]{0,30}\bautor/i, '"author" of xbacked-sdk (autor)'],
  [/reutiliz\w*[^.]{0,60}(?:cartera|wallet)|(?:cartera|wallet)[^.]{0,60}reutiliz/i, 'a wallet layer other contributors reused'],
];

// Words allowed despite a substring match, because they are proper names or the right technical term.
const ALLOW = [/ant colony optimization/i];

const SKIP = [join('dist', 'research', 'setup-bake-off', 'live')];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (SKIP.some((s) => p === s || p.startsWith(s + sep))) return [];
    if (d.isDirectory()) return walk(p);
    return d.isFile() && d.name.endsWith('.html') ? [relative('dist', p)] : [];
  });
}

const pages = walk('dist').sort();
let failures = 0;
const fail = (file, msg) => {
  failures++;
  console.log(`✗ ${file}: ${msg}`);
};

for (const file of pages) {
  const html = readFileSync(join('dist', file), 'utf8');
  const meta = [...html.matchAll(/<(?:meta|title)[^>]*?(?:content="([^"]*)"|>([^<]*)<\/title>)/g)]
    .map((m) => m[1] ?? m[2] ?? '')
    .join('\n');
  const jsonld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const body = html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/\s+/g, ' ');
  const attrs = [...html.matchAll(/\s(?:alt|title|aria-label)="([^"]*)"/g)].map((m) => m[1]).join('\n');
  let text = `${body}\n${meta}\n${jsonld}\n${attrs}`;
  const lang = (html.match(/<html[^>]*\blang="([^"]*)"/) || [])[1] || 'en';
  const spanish = /^es\b/i.test(lang);

  for (const [re, what] of spanish ? [...FORBIDDEN, ...FORBIDDEN_ES] : FORBIDDEN) {
    const m = text.match(re);
    if (m) fail(file, `ruled-out claim (${what}): "${m[0]}"`);
  }
  for (const re of ALLOW) text = text.replace(re, '');

  if (/[—―]/.test(text)) fail(file, spanish ? 'em dash or raya found' : 'em dash found');
  for (const m of text.matchAll(/(\D)–|–(\D)/g)) {
    // English allows "2026–present"; Spanish allows the en dash only between digits ("2017–2019").
    if (spanish || !/–present/.test(text.slice(m.index - 5, m.index + 9))) {
      fail(file, `en dash outside a range: "…${text.slice(m.index - 15, m.index + 15)}…"`);
    }
  }

  if (spanish) {
    // Quotations (“…”, "…", «…») are other people's words or a source's original text, kept verbatim, so the
    // style rules skip them; the ruled-out claims above were checked on the whole text.
    const unquoted = body.replace(/“[^”]{0,600}”|"[^"]{0,600}"|«[^»]{0,600}»/g, ' ');
    const own = `${unquoted}\n${meta}\n${jsonld}\n${attrs}`;
    for (const w of BANNED_ES) {
      const m = own.match(new RegExp(`(?<![\\p{L}])${w}[\\p{L}]*`, 'iu'));
      if (m) fail(file, `banned word "${m[0]}"`);
    }
    for (const p of PHRASES_ES) {
      if (new RegExp(`(?<![\\p{L}])${p}(?![\\p{L}])`, 'iu').test(own)) fail(file, `banned phrase "${p}"`);
    }
    for (const [re, what] of PATTERNS_ES) {
      const m = own.match(re);
      if (m) fail(file, `${what}: "${m[0]}"`);
    }
  } else {
    for (const w of BANNED) {
      const re = new RegExp(`\\b${w.replace(/-/g, '[- ]')}\\w*`, 'i');
      const m = text.match(re);
      if (m) fail(file, `banned word "${m[0]}"`);
    }
    for (const p of PHRASES) {
      const re = new RegExp(`\\b${p.replace(/[’']/g, "['’]")}\\b`, 'i');
      if (re.test(text)) fail(file, `banned phrase "${p}"`);
    }
  }
  if (/\bQA\b/.test(text)) fail(file, '"QA" found');
  if (/\+?52[\s\d]{8,}|\b55 ?4178/.test(text)) fail(file, 'phone number found');
  if (/Sustentum/i.test(text)) fail(file, 'Sustentum mentioned');
  if (/jcastrejone@gmail\.com/.test(html)) fail(file, 'email address appears whole in the HTML');
  // His name carries the accent everywhere except the domain, URLs and file names.
  const unaccented = text.replace(/castrejon\.mx|Castrejon-Estrada-CV\.pdf|JCastrejonE|jcastrejone|https?:\/\/\S+/gi, '').match(/\bCastrejon\b/);
  if (unaccented) fail(file, 'name without the accent: "Castrejon"');
}

if (failures) {
  console.log(`\n${failures} problem(s) in ${pages.length} page(s).`);
  process.exit(1);
}
const es = pages.filter((f) => /<html[^>]*\blang="es/.test(readFileSync(join('dist', f), 'utf8'))).length;
console.log(`✓ ${pages.length} page(s) pass (${pages.length - es} English, ${es} Spanish): no em dashes, banned words or phrases, ruled-out claims, "QA", phone number, or unaccented name.`);
