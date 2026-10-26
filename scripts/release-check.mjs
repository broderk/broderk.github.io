import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSiteSettings } from '../src/config/seo-site.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function releaseSite() {
  const { site, indexable } = getSiteSettings();
  const host = new URL(site).hostname;
  const reserved = ['.example', '.invalid', '.test', '.localhost'];
  const examples = ['example.com', 'example.net', 'example.org', 'your-domain.com'];
  assert.ok(indexable && !reserved.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
    && !examples.some((domain) => host === domain || host.endsWith(`.${domain}`)),
  '发布检查需要实际可访问的 HTTPS 域名：请设置 SITE_URL，不要使用 localhost 或示例地址。');
  return site;
}

export function verifyReleaseOutput(site, dist = path.join(root, 'dist')) {
  const read = (relative) => {
    const file = path.join(dist, relative);
    assert.ok(existsSync(file), `构建文件缺失：${relative}`);
    return readFileSync(file, 'utf8');
  };

  const pages = ['index.html', 'posts/index.html', 'search/index.html', '404.html'];
  for (const page of pages) {
    const html = read(page);
    const canonical = page === '404.html' ? '/404/' : '/' + page.replace(/index\.html$/, '');
    assert.ok(html.includes(`<link rel="canonical" href="${site}${canonical}"`), `${page} 的 canonical 与 SITE_URL 不一致`);
    assert.ok(html.includes(`<meta name="robots" content="${['search/index.html', '404.html'].includes(page) ? 'noindex' : 'index'}, follow"`), `${page} 的 robots 标记不正确`);
  }

  assert.ok(read('rss.xml').includes(`<link>${site}/`), 'RSS 未使用正式域名');
  assert.ok(read('robots.txt').includes(`Sitemap: ${site}/sitemap-index.xml`), 'robots.txt 未指向正式站点地图');
  const sitemap = read('sitemap-index.xml');
  assert.ok(sitemap.includes(`${site}/sitemap-0.xml`), '站点地图索引未使用正式域名');
  const locations = read('sitemap-0.xml');
  assert.ok(locations.includes(`<loc>${site}/</loc>`) && !locations.includes(`${site}/404/`)
    && !locations.includes(`${site}/404.html`)
    && !locations.includes(`${site}/search/`), '站点地图遗漏首页或错误收录异常页面');
  const search = JSON.parse(read('pagefind/pagefind-entry.json'));
  assert.ok(Object.values(search.languages ?? {}).some((language) => language.page_count > 0), '站内搜索索引为空');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const site = releaseSite();
    if (process.argv.includes('--preflight')) console.log(`发布域名检查通过：${site}`);
    else {
      verifyReleaseOutput(site);
      console.log(`发布产物检查通过：${site}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
