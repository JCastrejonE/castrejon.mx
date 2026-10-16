import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://castrejon.mx',
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
