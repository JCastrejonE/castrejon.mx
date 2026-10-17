# castrejon.mx

Personal site of Juan Carlos Castrejón Estrada: a one-page home and a `/research` section of essays, in English and Spanish, built with [Astro](https://astro.build), no client-side JavaScript except the snippet that assembles the email address.

## Run it

Astro 7 needs Node 22.22 or later (`.nvmrc` pins 24). On this Mac the default `node` is v20, so put Homebrew's Node 24 first:

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
npm install
npm run dev          # http://localhost:4321, live reload
npm run build        # static site in dist/
npm run preview      # serve dist/ locally
npm run check:copy   # after a build, every page under dist/, English and Spanish rules by <html lang>
```

## Edit the content

Every English word on the page is in `src/data/site.ts`: intro, Now, selected work, experience, contact, meta description and the OG image text. The Spanish copy is `src/data/site.es.ts`, with the same keys. Change both and rebuild; the markup in `src/components/HomePage.astro` doesn't need to change.

- **Now section:** update `now.date`, `now.datetime` and `now.items`. Items accept inline HTML for links.
- **CV:** replace `public/cv.pdf` with the new export from the CV tooling. It downloads as `Juan-Carlos-Castrejon-Estrada-CV.pdf`.
- **OG image:** built from `ogLines` at build time by `src/lib/og.ts`: `/og.png` from `site.ts`, `/es/og.png` from `site.es.ts`. The line breaks are set by hand so no word is hyphenated; check both images after changing them.
- **Favicons:** `npm run icons` regenerates `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png`. Only needed if the monogram changes.
- **Display font:** the name, section titles and figures use Newsreader Display 600 (OFL-1.1), self-hosted at `public/fonts/newsreader-display-600.woff2` (19.5 KB): a static instance of the variable font at opsz 72, weight 600, made with fonttools' `instancer` from `newsreader-latin-opsz-normal.woff2` in `@fontsource-variable/newsreader`, then subset with `pyftsubset --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2018,U+2019,U+201C,U+201D,U+2026,U+2212" --layout-features='kern,liga,calt,tnum,ss01' --flavor=woff2`. That covers Basic Latin, Latin-1 Supplement (accents, ×, ·, ©) and ‘ ’ “ ” – − …, enough for essay titles and section headings. Newsreader has no ≈ ≤ ≥; in a heading those fall back to Georgia. Body text stays on the system font.
- **Sitemap:** generated at build time by `src/pages/sitemap.xml.ts`: both homes, both research indexes and every essay in each language, each with `lastmod` from the modification time of its source files and, for pages that exist in both languages, `xhtml:link` alternates (`en`, `es`, `x-default` = English).
- **Research essays:** one Markdown file per essay in `src/content/research/<slug>.md`, published at `/research/<slug>/`. The frontmatter schema is in `src/content.config.ts` (title ≤ 70 characters, description ≤ 155, abstract 90–160 words, date `YYYY` or `YYYY-MM`, group `agents` or `academic`, order, repo, optional links); the build fails if a file doesn't match. Figures live in `public/research/<slug>/`. The index labels and intro are under `research` in `src/data/site.ts`.

- **Page weight:** the home page (index.html with its inlined CSS, plus the font and favicon.svg) stays under 50 KB in both languages: 49.2 KB for `/` and 49.8 KB for `/es/` (2026-10-16). Spanish runs about 600 bytes longer, so check `/es/` after adding copy.

Every fact must come from `cv.md` in career-ops. Run `npm run build && npm run check:copy` before publishing.

## The Spanish edition

English stays at `/`, `/research/` and `/research/<slug>/`. Spanish mirrors every page under `/es/` with the same slugs: `/es/`, `/es/research/`, `/es/research/<slug>/`. The live bake-off exhibits under `/research/setup-bake-off/live/` are not translated.

- **How it works:** `src/i18n.ts` exports `getSite(lang)`, which returns `site.ts` or `site.es.ts`. The pages in `src/pages/` and `src/pages/es/` are one-liners that render the shared templates in `src/components/` (`HomePage`, `ResearchIndexPage`, `EssayPage`) with `lang="en"` or `lang="es"`. The build stops if the two data files differ in shape (a missing or extra key, or a list with a different length).
- **Head:** `Base.astro` sets `<html lang="en">` or `<html lang="es-MX">`, the canonical URL in each language, `<link rel="alternate" hreflang>` for `en`, `es` and `x-default` when the page exists in both, `og:locale` (`en_US` / `es_MX`) with `og:locale:alternate`, the language's OG image, and `inLanguage` in the JSON-LD.
- **Toggle:** `LangToggle.astro` puts "EN / ES" at the top right of the column on every page: the current language as text, the other as a link to the same page in that language. An essay without a translation links to the other language's research index.
- **404:** one `404.html` with the English line and then the Spanish one (`lang="es-MX"`), each linking to its home; both strings are `notFound` in the data files.
- **Spanish voice:** first person, Mexican Spanish, "tú" for the reader. Job titles, product names and software jargon stay in English (spec, pipeline, gate, CI/CD, merge, deploy, release, sign-off, tenant). No em dashes or rayas; en dash only between numbers. Numbers as in English with Mexican formatting (1,909; 0.164943812; 53%); dates as "octubre de 2026". 2026 re-runs are described neutrally ("se volvió a ejecutar"). `npm run check:copy` enforces the mechanical rules for pages whose `<html lang>` starts with `es`.

### Translate an essay

1. Copy `src/content/research/<slug>.md` to `src/content/research-es/<slug>.md` (same file name) and translate it. The frontmatter keys are the same (schema `researchEs` in `src/content.config.ts`: title ≤ 80 characters, description ≤ 160, abstract 90–200 words). `repo`, `date`, `group` and `order` stay as they are; `context`, `summary` and the `links` labels are in Spanish, and internal `links` hrefs point to `/es/...`.
2. Figures with text go to `public/research/<slug>/es/<same file name>.svg` and the essay references `/research/<slug>/es/<file>.svg`; images without text (the bake-off screenshots) keep `/research/<slug>/<file>`.
3. Links inside the essay point to `/es/...` pages, except `/research/setup-bake-off/live/...`, which stays as it is. A link to `/es/research/<slug>/` whose translation doesn't exist yet is rewritten to the English essay at build time.
4. `npm run build && npm run check:copy`. The essay appears at `/es/research/<slug>/`, in the Spanish index and in the sitemap, and the English essay's toggle and `hreflang` alternates now point to it. Until then, the Spanish index lists the English version (marked `lang="en"`).

To add a new essay in both languages, write the English file first, then translate it as above.

## Structure

```
src/data/site.ts          all English copy, including the research index labels
src/data/site.es.ts       the Spanish copy, same keys
src/i18n.ts               getSite(lang), language names, the shape check between the two data files
src/layouts/Base.astro    <head>: metadata, hreflang alternates, Open Graph, JSON-LD, icons
src/pages/index.astro     the English home (renders HomePage); src/pages/es/index.astro the Spanish one
src/pages/404.astro       not-found page, both languages
src/pages/research/       the English research index and essays ([slug].astro); src/pages/es/research/ the Spanish ones
src/pages/sitemap.xml.ts  the sitemap, generated at build time
src/content.config.ts     the research and researchEs collections and their frontmatter schema
src/content/research/     the English essays, one Markdown file each; src/content/research-es/ their translations
src/lib/research.ts       sorting, date formatting (both languages), link fallbacks and lastmod for the research pages
src/lib/og.ts             Open Graph image, rendered at build time (satori + resvg; Newsreader name, Inter text);
                          served by src/pages/og.png.ts and src/pages/es/og.png.ts
src/components/           HomePage, ResearchIndexPage, EssayPage (the shared page templates), LangToggle, Section,
                          Email, EmailScript, Arrow and ArrowDefs (SVG arrows and the back chevron, one sprite per page),
                          Prose (wraps essay tables in a scroll container; a table with an empty top-left
                          header cell gets its first column as row headers)
src/styles/global.css     HIG colors and text styles, print styles; inlined on every page
src/styles/research.css   essay typography, tables, figures, code, footnotes, essay print styles; only on /research pages
scripts/icons.mjs         favicon generator
scripts/check-copy.mjs    copy linter
public/                   cv.pdf, fonts/, icons, robots.txt, research/<slug>/ figures (research/<slug>/es/ for translated ones)
                          (research/setup-bake-off/live/ holds unmodified exhibit pages the copy linter skips)
```

## Deploy

`npm run build` produces plain static files in `dist/`, which any static host can serve. `dist/404.html` is picked up automatically by Netlify, Vercel, Cloudflare Pages and GitHub Pages.

The domain's DNS stays at Hostinger. The records each host needs are in the hand-over notes; nothing has been deployed and DNS hasn't been changed.
