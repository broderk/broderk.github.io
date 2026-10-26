import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { releaseSite, verifyReleaseOutput } from '../scripts/release-check.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

test('发布前拒绝未配置的地址和示例域名', () => {
  const previous = process.env.SITE_URL;
  try {
    for (const value of [undefined, 'http://localhost:4321', 'https://blog.example.invalid', 'https://example.com', 'https://blog.example.com', 'https://your-domain.com']) {
      if (value === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = value;
      assert.throws(releaseSite);
    }
    process.env.SITE_URL = 'https://tomo.example.cn';
    assert.equal(releaseSite(), 'https://tomo.example.cn');
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});

test('发布产物与当前构建域名一致，包含首页、文章、搜索、404、RSS 与站点地图', () => {
  const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const site = new URL(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]).origin;
  if (html.includes('<meta name="robots" content="noindex, follow"')) {
    assert.throws(() => verifyReleaseOutput('https://tomo.example.cn', dist));
    return;
  }
  verifyReleaseOutput(site, dist);
  assert.throws(() => verifyReleaseOutput('https://other.example.cn', dist));
});
