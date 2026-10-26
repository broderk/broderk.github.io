import type { APIRoute } from 'astro';
import { getSiteSettings } from '../config/seo-site.mjs';

export const GET: APIRoute = ({ site }) => {
  const { indexable } = getSiteSettings();
  // Let crawlers read page-level noindex while the public domain is unconfigured.
  const lines = ['User-agent: *', 'Allow: /'];
  if (indexable && !import.meta.env.DEV) {
    lines.push('Sitemap: ' + new URL('/sitemap-index.xml', site).href);
  }
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
