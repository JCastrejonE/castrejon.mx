// Lints the built pages' visible copy and metadata against the voice and accuracy rules.
// Run after a build: npm run build && npm run check:copy
import { readFileSync, readdirSync } from 'node:fs';

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

// Words allowed despite a substring match, because they are proper names or the right technical term.
const ALLOW = [/ant colony optimization/i];

const pages = readdirSync('dist').filter((f) => f.endsWith('.html'));
let failures = 0;
const fail = (file, msg) => {
  failures++;
  console.log(`✗ ${file}: ${msg}`);
};

for (const file of pages) {
  const html = readFileSync(`dist/${file}`, 'utf8');
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
    .replace(/\s+/g, ' ');
  let text = `${body}\n${meta}\n${jsonld}`;
  for (const re of ALLOW) text = text.replace(re, '');

  if (text.includes('—')) fail(file, 'em dash found');
  for (const m of text.matchAll(/(\D)–|–(\D)/g)) {
    if (!/–present/.test(text.slice(m.index - 5, m.index + 9))) fail(file, `en dash outside a range: "…${text.slice(m.index - 15, m.index + 15)}…"`);
  }
  for (const w of BANNED) {
    const re = new RegExp(`\\b${w.replace(/-/g, '[- ]')}\\w*`, 'i');
    const m = text.match(re);
    if (m) fail(file, `banned word "${m[0]}"`);
  }
  for (const p of PHRASES) {
    const re = new RegExp(`\\b${p.replace(/[’']/g, "['’]")}\\b`, 'i');
    if (re.test(text)) fail(file, `banned phrase "${p}"`);
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
console.log(`✓ ${pages.length} page(s) pass: no em dashes, banned words or phrases, "QA", phone number, or unaccented name.`);
