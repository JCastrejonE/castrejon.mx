import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://castrejon.mx',
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  // Essays show commands in plain monospace blocks styled by research.css, in both color schemes.
  markdown: { syntaxHighlight: false },
});
