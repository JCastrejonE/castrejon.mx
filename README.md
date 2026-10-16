# castrejon.mx

Personal site of Juan Carlos Castrejón Estrada: a one-page home and a `/research` section of essays, built with [Astro](https://astro.build), no client-side JavaScript except the snippet that assembles the email address.

## Run it

Astro 7 needs Node 22.22 or later (`.nvmrc` pins 24). On this Mac the default `node` is v20, so put Homebrew's Node 24 first:

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
npm install
npm run dev          # http://localhost:4321, live reload
npm run build        # static site in dist/
npm run preview      # serve dist/ locally
npm run check:copy   # after a build, every page under dist/: em dashes, banned words, "QA", phone number, name accent
```

## Edit the content

Every word on the page is in `src/data/site.ts`: intro, Now, selected work, experience, contact, meta description and the OG image text. Change it there and rebuild; the markup in `src/pages/index.astro` doesn't need to change.

- **Now section:** update `now.date`, `now.datetime` and `now.items`. Items accept inline HTML for links.
- **CV:** replace `public/cv.pdf` with the new export from the CV tooling. It downloads as `Juan-Carlos-Castrejon-Estrada-CV.pdf`.
- **OG image:** built from `ogLines` at build time by `src/pages/og.png.ts`. The line breaks are set by hand so no word is hyphenated.
- **Favicons:** `npm run icons` regenerates `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png`. Only needed if the monogram changes.
- **Display font:** the name, section titles and figures use Newsreader Display 600 (OFL-1.1), self-hosted at `public/fonts/newsreader-display-600.woff2` (19.5 KB): a static instance of the variable font at opsz 72, weight 600, made with fonttools' `instancer` from `newsreader-latin-opsz-normal.woff2` in `@fontsource-variable/newsreader`, then subset with `pyftsubset --unicodes="U+0020-007E,U+00A0-00FF,U+2013,U+2018,U+2019,U+201C,U+201D,U+2026,U+2212" --layout-features='kern,liga,calt,tnum,ss01' --flavor=woff2`. That covers Basic Latin, Latin-1 Supplement (accents, ×, ·, ©) and ‘ ’ “ ” – − …, enough for essay titles and section headings. Newsreader has no ≈ ≤ ≥; in a heading those fall back to Georgia. Body text stays on the system font.
- **Sitemap:** generated at build time by `src/pages/sitemap.xml.ts`: the home page, `/research/` and every essay, each with `lastmod` from the modification time of its source files.
- **Research essays:** one Markdown file per essay in `src/content/research/<slug>.md`, published at `/research/<slug>/`. The frontmatter schema is in `src/content.config.ts` (title ≤ 70 characters, description ≤ 155, abstract 90–160 words, date `YYYY` or `YYYY-MM`, group `agents` or `academic`, order, repo, optional links); the build fails if a file doesn't match. Figures live in `public/research/<slug>/`. The index labels and intro are under `research` in `src/data/site.ts`.

Every fact must come from `cv.md` in career-ops. Run `npm run build && npm run check:copy` before publishing.

## Adding things later

- **Spanish version:** copy `src/data/site.ts` to `site.es.ts`, translate the strings, and add `src/pages/es/index.astro` rendering the same components with the Spanish data. Add `hreflang` alternates in `Base.astro`.

## Structure

```
src/data/site.ts          all copy, including the research index labels
src/layouts/Base.astro    <head>: metadata, Open Graph, JSON-LD, icons
src/pages/index.astro     the home page
src/pages/404.astro       not-found page
src/pages/research/       the research index and the essay template ([slug].astro)
src/pages/sitemap.xml.ts  the sitemap, generated at build time
src/content.config.ts     the research collection and its frontmatter schema
src/content/research/     the essays, one Markdown file each
src/lib/research.ts       sorting, date formatting and lastmod for the research pages
src/pages/og.png.ts       Open Graph image, rendered at build time (satori + resvg; Newsreader name, Inter text)
src/components/           Section, Email, EmailScript, Arrow (SVG arrows and the back chevron), Prose (wraps essay tables in a scroll container)
src/styles/global.css     HIG colors and text styles, print styles; inlined on every page
src/styles/research.css   essay typography, tables, figures, code, footnotes, essay print styles; only on /research pages
scripts/icons.mjs         favicon generator
scripts/check-copy.mjs    copy linter
public/                   cv.pdf, fonts/, icons, robots.txt, research/<slug>/ figures
                          (research/setup-bake-off/live/ holds unmodified exhibit pages the copy linter skips)
```

## Deploy

`npm run build` produces plain static files in `dist/`, which any static host can serve. `dist/404.html` is picked up automatically by Netlify, Vercel, Cloudflare Pages and GitHub Pages.

The domain's DNS stays at Hostinger. The records each host needs are in the hand-over notes; nothing has been deployed and DNS hasn't been changed.
