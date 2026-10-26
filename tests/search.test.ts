import assert from 'node:assert/strict';
import test from 'node:test';
import { searchPosts } from '../src/utils/search.ts';

const posts = [
  { title: 'RoPE 原理', description: '旋转位置编码', tags: ['大模型'], body: '二维旋转以及 KV Cache 的实现', url: '/posts/rope/' },
  { title: '生活记录', description: '日常随笔', tags: ['摄影'], body: '练习拍照', url: '/posts/life/' },
];

test('开发模式支持中文标题、标签、正文以及不区分大小写的英文查询', () => {
  for (const query of ['原理', '大模型', '二维旋转', 'rope', 'kv cache']) {
    assert.deepEqual(searchPosts(posts, query).map((post) => post.url), ['/posts/rope/']);
  }
});

test('空查询、全空格和无匹配查询均不返回结果', () => {
  for (const query of ['', '   ', '不存在的关键词', '<script>']) {
    assert.deepEqual(searchPosts(posts, query), []);
  }
});

test('多个关键词必须全部匹配，标题匹配优先于正文', () => {
  assert.deepEqual(searchPosts(posts, 'RoPE 拍照'), []);
  const extra = { ...posts[1], title: '其它文章', body: 'RoPE' };
  assert.deepEqual(searchPosts([extra, posts[0]], 'RoPE').map((post) => post.url), ['/posts/rope/', '/posts/life/']);
});
