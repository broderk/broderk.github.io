import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    return statSync(file).isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [file] : [];
  });
}
const files = htmlFiles(dist);
const decode = (value) => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const postFiles = files.filter((file) => readFileSync(file, 'utf8').includes('data-pagefind-body'));

test('所有页面的首个键盘入口可跳至唯一且可聚焦的正文区域', () => {
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, /<html\b[^>]*lang="zh-CN"/, file);
    assert.match(html, /<body>\s*<a class="skip-link" href="#main-content">跳至正文<\/a>/, file);
    const mains = [...html.matchAll(/<main\b[^>]*>/g)];
    assert.equal(mains.length, 1, file);
    assert.match(mains[0][0], /\bid="main-content"/, file);
    assert.match(mains[0][0], /\btabindex="-1"/, file);
    assert.equal([...html.matchAll(/\bid="main-content"/g)].length, 1, file);
    assert.doesNotMatch(html, /\btabindex="[1-9]\d*"/, file);
  }
});

test('自定义 404 提供有效返回入口且不参与索引', () => {
  const html = readFileSync(path.join(dist, '404.html'), 'utf8');
  assert.match(html, /<h1 id="error-title">这个页面走丢了<\/h1>/);
  assert.match(html, /<meta name="robots" content="noindex, follow"/);
  assert.doesNotMatch(html, /data-pagefind-body/);
  const actions = html.match(/<nav class="error-actions"[\s\S]*?<\/nav>/)?.[0] ?? '';
  for (const href of ['/', '/posts/', '/search/']) {
    assert.ok(actions.includes('href="' + href + '"'), href);
  }
});

test('页面图片提供替代文本，头像包含作者身份', () => {
  let images = 0;
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<img\b[^>]*>/g)) {
      images++;
      const alt = match[0].match(/\salt="([^"]*)"/);
      assert.ok(alt, file + ' 的图片缺少 alt：' + match[0]);
      if (!alt[1].trim()) {
        assert.match(match[0], /\s(?:role="presentation"|aria-hidden="true")/, file + ' 的装饰图需显式声明用途');
      }
      if (/\bclass="avatar"/.test(match[0])) assert.equal(decode(alt[1]), 'Tomoebzk 的头像');
    }
  }
  assert.ok(images > 0, '替代文本测试必须覆盖实际图片');
});

test('全站与正式搜索均有清晰的键盘焦点样式', () => {
  const styles = readdirSync(path.join(dist, '_astro'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(path.join(dist, '_astro', name), 'utf8')).join('\n');
  assert.match(styles, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus\)/);
  assert.match(styles, /\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/);
  assert.match(styles, /\.main-content:focus\s*\{[^}]*outline:/);
  assert.match(styles, /--pf-outline-focus:\s*var\(--focus\)/);
  assert.match(styles, /\.search-page :focus-visible\s*\{[^}]*outline:\s*3px solid var\(--focus\)\s*!important/);
});

test('所有生成页面的站内链接和锚点都有对应目标', () => {
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = decode(match[1]);
      if (!href.startsWith('/') && !href.startsWith('#')) continue;
      if (href.startsWith('//')) continue;
      const pagePath = '/' + path.relative(dist, file).split(path.sep).join('/');
      const url = new URL(href, 'https://test.invalid' + pagePath);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const target = path.join(dist, relative, url.pathname.endsWith('/') ? 'index.html' : '');
      assert.ok(existsSync(target), file + ' 的链接目标不存在：' + href);
      if (url.hash && target.endsWith('.html')) {
        const ids = [...readFileSync(target, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((item) => decode(item[1]));
        assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), '目录锚点不存在：' + href);
      }
    }
  }
});

test('文章目录与正文渲染标题的深度、顺序、slug 完全一致', () => {
  assert.ok(postFiles.length > 0);
  for (const file of postFiles) {
    const html = readFileSync(file, 'utf8');
    const content = html.slice(html.indexOf('<div class="article-content"'));
    const headings = [...content.matchAll(/<h([1-6])\b[^>]*\bid="([^"]+)"/g)]
      .map((match) => ({ depth: Number(match[1]), slug: decode(match[2]) }));
    const toc = [...html.matchAll(/<li data-heading-level="([1-6])">\s*<a href="#([^"]+)"/g)]
      .map((match) => ({ depth: Number(match[1]), slug: decodeURIComponent(decode(match[2])) }));
    assert.deepEqual(toc, headings, file);
    assert.equal(html.includes('aria-label="文章目录"'), headings.length > 0);
  }
});

test('有标题的文章仅在侧栏展示目录，没有标题的文章不留空侧栏', () => {
  for (const file of postFiles) {
    const html = readFileSync(file, 'utf8');
    const tocCount = html.split('aria-label="文章目录"').length - 1;
    const hasToc = tocCount > 0;
    assert.ok(tocCount <= 1, file);
    assert.equal(html.includes('class="article-sidebar"'), hasToc, file);
    assert.equal(html.includes('class="article-grid has-toc"'), hasToc, file);
    if (hasToc) {
      assert.ok(html.indexOf('class="article-sidebar"') < html.indexOf('class="article-content"'), file);
    }
  }
});

test('每个标签页只收录标注该标签的已发布文章', () => {
  const expected = new Map();
  for (const file of postFiles) {
    const html = readFileSync(file, 'utf8');
    const tags = html.match(/<div class="tags" aria-label="文章标签">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const postUrl = '/' + path.relative(dist, file).split(path.sep).join('/').replace(/index\.html$/, '');
    for (const match of tags.matchAll(/href="([^"]+)"/g)) {
      const tag = decodeURIComponent(match[1]);
      if (!expected.has(tag)) expected.set(tag, new Set());
      expected.get(tag).add(postUrl);
    }
  }
  const tagPages = files.filter((file) => file.includes(path.sep + 'tags' + path.sep) && !file.endsWith(path.join('tags', 'index.html')));
  assert.equal(tagPages.length, expected.size);
  for (const file of tagPages) {
    const html = readFileSync(file, 'utf8');
    const tagUrl = '/' + path.relative(dist, file).split(path.sep).join('/').replace(/index\.html$/, '');
    const tag = decodeURIComponent(tagUrl);
    const actual = [...html.matchAll(/<article class="post-card">[\s\S]*?<h2><a href="([^"]+)"/g)]
      .map((match) => decodeURIComponent(match[1]));
    assert.deepEqual(actual.sort(), [...(expected.get(tag) ?? [])].sort(), tagUrl);
  }
});

test('相邻文章导航互相对应，不产生自链接或空链接', () => {
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const navigation = html.match(/<nav class="post-navigation"[\s\S]*?<\/nav>/)?.[0];
    if (!navigation) continue;
    for (const match of navigation.matchAll(/<a href="([^"]+)"><span>(上一篇|下一篇)<\/span>/g)) {
      const target = path.join(dist, decodeURIComponent(match[1]), 'index.html');
      assert.notEqual(path.resolve(target), path.resolve(file));
      const other = readFileSync(target, 'utf8').match(/<nav class="post-navigation"[\s\S]*?<\/nav>/)?.[0] ?? '';
      const reverse = match[2] === '上一篇' ? '下一篇' : '上一篇';
      const links = [...other.matchAll(/<a href="([^"]+)"><span>(上一篇|下一篇)<\/span>/g)];
      assert.ok(links.some((link) => link[2] === reverse && path.resolve(dist, '.' + decodeURIComponent(link[1]), 'index.html') === path.resolve(file)));
    }
  }
});

test('站内搜索页面与 Pagefind 索引只覆盖已发布文章', () => {
  const searchPage = path.join(dist, 'search', 'index.html');
  assert.ok(existsSync(searchPage));
  const searchHtml = readFileSync(searchPage, 'utf8');
  assert.match(searchHtml, /pagefind-input/);
  assert.match(searchHtml, /pagefind-results/);

  const entry = path.join(dist, 'pagefind', 'pagefind-entry.json');
  assert.ok(existsSync(entry));
  const index = JSON.parse(readFileSync(entry, 'utf8'));
  const indexedPages = Object.values(index.languages ?? {})
    .reduce((count, language) => count + language.page_count, 0);
  assert.equal(indexedPages, postFiles.length);
});

test('文章分页完整收录文章，无重复、遗漏和无效页码', () => {
  const listPages = files.filter((file) => file === path.join(dist, 'posts', 'index.html')
    || /[/\\]posts[/\\]page[/\\]\d+[/\\]index\.html$/.test(file));
  listPages.sort((a, b) => {
    const page = (file) => Number(file.match(/[/\\]page[/\\](\d+)[/\\]/)?.[1] ?? 1);
    return page(a) - page(b);
  });
  assert.equal(listPages.length, Math.max(1, Math.ceil(postFiles.length / 10)));
  const collected = listPages.flatMap((file, index) => {
    const html = readFileSync(file, 'utf8');
    const links = [...html.matchAll(/<article class="post-card">[\s\S]*?<h2><a href="([^"]+)"/g)]
      .map((match) => decodeURIComponent(decode(match[1])));
    assert.equal(links.length, Math.min(10, Math.max(0, postFiles.length - index * 10)));
    assert.ok(html.includes('共 ' + postFiles.length + ' 篇文章'));
    assert.equal(/rel="prev"/.test(html), index > 0);
    assert.equal(/rel="next"/.test(html), index < listPages.length - 1);
    assert.equal(html.includes('aria-current="page"'), listPages.length > 1);
    return links;
  });
  const expected = postFiles.map((file) => '/' + path.relative(dist, file).split(path.sep).join('/').replace(/index\.html$/, ''));
  assert.deepEqual(collected.toSorted(), expected.toSorted());
  assert.equal(new Set(collected).size, collected.length);
  assert.equal(existsSync(path.join(dist, 'posts', 'page', '1', 'index.html')), false);
});

test('年月归档完整收录文章，每篇只出现一次且月份对应发布日期', () => {
  const archivePage = path.join(dist, 'archive', 'index.html');
  assert.ok(existsSync(archivePage));
  const archiveHtml = readFileSync(archivePage, 'utf8');
  const collected = [];
  for (const section of archiveHtml.matchAll(/<section class="archive-month" aria-labelledby="month-(\d+)-(\d+)">([\s\S]*?)<\/section>/g)) {
    for (const entry of section[3].matchAll(/<time datetime="(\d+)-(\d+)-\d+">[\s\S]*?<a href="([^"]+)"/g)) {
      assert.equal(Number(entry[1]), Number(section[1]));
      assert.equal(Number(entry[2]), Number(section[2]));
      collected.push(decodeURIComponent(decode(entry[3])));
    }
  }
  const expected = postFiles.map((file) => '/' + path.relative(dist, file).split(path.sep).join('/').replace(/index\.html$/, ''));
  assert.deepEqual(collected.toSorted(), expected.toSorted());
  assert.equal(new Set(collected).size, collected.length);
});
