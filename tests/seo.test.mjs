import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSiteSettings } from '../src/config/seo-site.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(dist, { recursive: true }).filter((file) => file.endsWith('.html'));
const settings = getSiteSettings();
const read = (file) => readFileSync(path.join(dist, file), 'utf8');
const decode = (text) => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const tags = (html, name) => [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'g'))].map((match) => match[0]);
const attribute = (tag, name) => decode(tag.match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1] ?? '');
const meta = (html, key) => tags(html, 'meta').find((tag) => attribute(tag, 'name') === key || attribute(tag, 'property') === key);

test('每页具有独立标题摘要、自引用 canonical 和完整分享元数据', () => {
  for (const file of files) {
    const html = read(file);
    const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    assert.ok(title);
    assert.equal([...html.matchAll(/<title>/g)].length, 1);
    const description = attribute(meta(html, 'description') ?? '', 'content');
    assert.ok(description);
    assert.equal(tags(html, 'meta').filter((tag) => attribute(tag, 'name') === 'description').length, 1);
    const canonicals = tags(html, 'link').filter((tag) => attribute(tag, 'rel') === 'canonical');
    assert.equal(canonicals.length, 1);
    const canonical = new URL(attribute(canonicals[0], 'href'));
    // Astro emits 404.html while rendering the /404/ route for its metadata.
    const expectedPath = file === '404.html' ? '/404/' : '/' + file.split(path.sep).join('/').replace(/index\.html$/, '');
    assert.equal(decodeURIComponent(canonical.pathname), expectedPath);
    assert.equal(canonical.origin, settings.site);
    assert.equal(canonical.search + canonical.hash, '');
    assert.equal(attribute(meta(html, 'og:url'), 'content'), canonical.href);
    assert.equal(attribute(meta(html, 'og:title'), 'content'), title);
    assert.equal(attribute(meta(html, 'og:description'), 'content'), description);
    assert.equal(attribute(meta(html, 'twitter:card'), 'content'), 'summary_large_image');
    const image = new URL(attribute(meta(html, 'og:image'), 'content'));
    assert.equal(image.origin, settings.site);
    assert.ok(existsSync(path.join(dist, decodeURIComponent(image.pathname))));
    assert.equal(attribute(meta(html, 'og:image:width'), 'content'), '1200');
    assert.equal(attribute(meta(html, 'og:image:height'), 'content'), '630');
    const expectedRobots = !settings.indexable || ['/search/', '/404/', '/404.html'].includes(expectedPath) ? 'noindex, follow' : 'index, follow';
    assert.equal(attribute(meta(html, 'robots'), 'content'), expectedRobots);
  }
});

test('文章提供发布日期、作者与有效 BlogPosting JSON-LD，普通页面不冒充文章', () => {
  for (const file of files) {
    const html = read(file);
    const article = html.includes('data-pagefind-body');
    assert.equal(attribute(meta(html, 'og:type'), 'content'), article ? 'article' : 'website');
    const data = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.equal(Boolean(data), article);
    if (!data) continue;
    const schema = JSON.parse(data[1]);
    assert.equal(schema['@type'], 'BlogPosting');
    assert.equal(schema.url, attribute(meta(html, 'og:url'), 'content'));
    assert.equal(schema.description, attribute(meta(html, 'description'), 'content'));
    assert.equal(schema.author.name, 'Tomoebzk');
    assert.ok(Number.isFinite(Date.parse(schema.datePublished)));
    assert.equal(schema.datePublished, attribute(meta(html, 'article:published_time'), 'content'));
  }
});

test('站点地图仅列出公开页面，robots 与 RSS 使用相同域名', () => {
  const index = read('sitemap-index.xml');
  const maps = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(decode(match[1])));
  assert.ok(maps.length);
  const locations = maps.flatMap((url) => {
    assert.equal(url.origin, settings.site);
    return [...read(decodeURIComponent(url.pathname).replace(/^\//, '')).matchAll(/<loc>(.*?)<\/loc>/g)]
      .map((match) => new URL(decode(match[1])));
  });
  const actual = locations.map((url) => {
    assert.equal(url.origin, settings.site);
    return decodeURIComponent(url.pathname);
  });
  const expected = files.map((file) => '/' + file.split(path.sep).join('/').replace(/index\.html$/, ''))
    .filter((url) => !['/search/', '/404/', '/404.html'].includes(url));
  assert.deepEqual(actual.toSorted(), expected.toSorted());
  assert.equal(new Set(actual).size, actual.length);
  const robots = read('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.equal(robots.includes('Sitemap: ' + settings.site + '/sitemap-index.xml'), settings.indexable);
  for (const match of read('rss.xml').matchAll(/<link>(.*?)<\/link>/g)) {
    assert.equal(new URL(decode(match[1])).origin, settings.site);
  }
});

test('域名配置拒绝伪地址、凭据、路径与非 HTTPS 公网地址', () => {
  const previous = process.env.SITE_URL;
  try {
    delete process.env.SITE_URL;
    assert.deepEqual(getSiteSettings(), { site: 'http://localhost:4321', indexable: false });
    process.env.SITE_URL = 'https://blog.example.invalid/';
    assert.deepEqual(getSiteSettings(), { site: 'https://blog.example.invalid', indexable: true });
    for (const value of ['example.invalid', 'javascript:alert(1)', 'http://example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid/blog/', 'https://example.invalid/?q=1', 'https://example.invalid/#top']) {
      process.env.SITE_URL = value;
      assert.throws(getSiteSettings);
    }
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});
