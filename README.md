# castrejon.mx

Personal site of Juan Carlos Castrejón Estrada. One static page built with [Astro](https://astro.build), no client-side JavaScript except the snippet that assembles the email address.

## Run it

Astro 7 needs Node 22.22 or later (`.nvmrc` pins 24). On this Mac the default `node` is v20, so put Homebrew's Node 24 first:

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
npm install
npm run dev          # http://localhost:4321, live reload
npm run build        # static site in dist/
npm run preview      # serve dist/ locally
npm run check:copy   # after a build: em dashes, banned words, "QA", phone number, name accent
```

## Edit the content

Every word on the page is in `src/data/site.ts`: intro, Now, selected work, experience, contact, meta description and the OG image text. Change it there and rebuild; the markup in `src/pages/index.astro` doesn't need to change.

- **Now section:** update `now.date`, `now.datetime` and `now.items`. Items accept inline HTML for links.
- **CV:** replace `public/cv.pdf` with the new export from the CV tooling. It downloads as `Juan-Carlos-Castrejon-Estrada-CV.pdf`.
- **OG image:** built from `ogLines` at build time by `src/pages/og.png.ts`. The line breaks are set by hand so no word is hyphenated.
- **Favicons:** `npm run icons` regenerates `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png`. Only needed if the monogram changes.
- **Display font:** the name, section titles and figures use Newsreader Display 600 (OFL-1.1), self-hosted at `public/fonts/newsreader-display-600.woff2` and subset to the characters the site uses (Basic Latin, á é í ó ú, © · – ’ −). If a heading or figure needs another character, re-subset from `@fontsource-variable/newsreader` with `pyftsubset` (fonttools). Body text stays on the system font.
- **Sitemap:** `public/sitemap.xml` is hand-written; update `lastmod` when the content changes meaningfully.

Every fact must come from `cv.md` in career-ops. Run `npm run build && npm run check:copy` before publishing.

## Adding things later

- **Writing section:** add `src/pages/writing/index.astro` and posts under `src/content/` (Astro content collections), reuse `src/layouts/Base.astro`, and add each URL to `sitemap.xml`.
- **Spanish version:** copy `src/data/site.ts` to `site.es.ts`, translate the strings, and add `src/pages/es/index.astro` rendering the same components with the Spanish data. Add `hreflang` alternates in `Base.astro`.

## Structure

```
src/data/site.ts          all copy
src/layouts/Base.astro    <head>: metadata, Open Graph, JSON-LD, icons
src/pages/index.astro     the page
src/pages/404.astro       not-found page
src/pages/og.png.ts       Open Graph image, rendered at build time (satori + resvg; Newsreader name, Inter text)
src/components/           Section, Email, EmailScript, Arrow (SVG direction arrows)
src/styles/global.css     the only stylesheet: HIG colors and text styles, print styles
scripts/icons.mjs         favicon generator
scripts/check-copy.mjs    copy linter
public/                   cv.pdf, fonts/, icons, robots.txt, sitemap.xml
```

## Deploy

`npm run build` produces plain static files in `dist/`, which any static host can serve. `dist/404.html` is picked up automatically by Netlify, Vercel, Cloudflare Pages and GitHub Pages.

The domain's DNS stays at Hostinger. The records each host needs are in the hand-over notes; nothing has been deployed and DNS hasn't been changed.
