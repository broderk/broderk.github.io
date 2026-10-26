import assert from 'node:assert/strict';
import test from 'node:test';
import { buildToc, type TocNode } from '../src/utils/toc.ts';

test('没有正文标题时目录为空', () => {
  assert.deepEqual(buildToc([]), []);
});

test('保留 h1 到 h6 的深度和锚点，不升降级', () => {
  const headings = [1, 2, 3, 4, 5, 6].map((depth) => ({ depth, slug: 'h' + depth, text: '标题' + depth }));
  const toc = buildToc(headings);
  let children: TocNode[] = toc;
  for (const heading of headings) {
    assert.equal(children.length, 1);
    assert.equal(children[0].depth, heading.depth);
    assert.equal(children[0].slug, heading.slug);
    children = children[0].children;
  }
  assert.deepEqual(children, []);
  assert.deepEqual(headings.map((heading) => heading.depth), [1, 2, 3, 4, 5, 6]);
});

test('跳级标题挂到最近的上级标题，同级不相互嵌套', () => {
  const toc = buildToc([
    { depth: 2, slug: '一', text: '一级主题' },
    { depth: 4, slug: '细节', text: '细节' },
    { depth: 3, slug: '小节', text: '小节' },
    { depth: 2, slug: '二', text: '第二主题' },
    { depth: 1, slug: '总览', text: '总览' },
  ]);
  assert.deepEqual(toc.map((item) => item.depth), [2, 2, 1]);
  assert.deepEqual(toc[0].children.map((item) => item.depth), [4, 3]);
});

test('相同文字的标题保留渲染器分配的独立 slug', () => {
  const toc = buildToc([
    { depth: 2, slug: '重复', text: '重复' },
    { depth: 2, slug: '重复-1', text: '重复' },
  ]);
  assert.deepEqual(toc.map((item) => item.slug), ['重复', '重复-1']);
});
