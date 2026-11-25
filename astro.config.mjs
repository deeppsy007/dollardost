
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dollardost.pages.dev',
  integrations: [sitemap()],
});
