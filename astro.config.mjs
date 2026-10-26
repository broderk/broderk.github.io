import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { getSiteSettings } from './src/config/seo-site.mjs';

const { site } = getSiteSettings();

export default defineConfig({
  site,
  integrations: [mdx(), sitemap({
    filter: (page) => !['/search/', '/404/', '/404.html'].includes(new URL(page).pathname),
  })],
});
