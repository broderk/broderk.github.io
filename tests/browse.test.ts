import assert from 'node:assert/strict';
import test from 'node:test';
import { groupPostsByYearMonth, paginatePosts, postsPageHref } from '../src/utils/browse.ts';

const post = (date: string, title: string) => ({ data: { pubDate: new Date(date) }, title });

test('分页按页码切片并报告总页数', () => {
  const posts = Array.from({ length: 21 }, (_, index) => index);
  assert.deepEqual(paginatePosts(posts, 1, 10), { posts: posts.slice(0, 10), page: 1, totalPages: 3, totalPosts: 21 });
  assert.deepEqual(paginatePosts(posts, 3, 10).posts, [20]);
  assert.throws(() => paginatePosts(posts, 4, 10), RangeError);
});

test('空列表保留首页，分页边界及非法输入处理正确', () => {
  assert.deepEqual(paginatePosts([], 1).posts, []);
  assert.equal(paginatePosts([], 1).totalPages, 1);
  assert.equal(paginatePosts(Array(10), 1).totalPages, 1);
  assert.equal(paginatePosts(Array(11), 1).totalPages, 2);
  for (const page of [0, -1, 1.5, NaN]) assert.throws(() => paginatePosts([], page), RangeError);
  for (const size of [0, -1, 1.5, NaN]) assert.throws(() => paginatePosts([], 1, size), RangeError);
  assert.equal(postsPageHref(1), '/posts/');
  assert.equal(postsPageHref(2), '/posts/page/2/');
});

test('空归档不生成空年份或月份，月末日期不受服务器时区影响', () => {
  assert.deepEqual(groupPostsByYearMonth([]), []);
  const groups = groupPostsByYearMonth([post('2025-12-31T23:59:59Z', 'last')]);
  assert.equal(groups[0].year, 2025);
  assert.equal(groups[0].months[0].month, 12);
  assert.equal(groups[0].count, 1);
});

test('归档按年份、月份倒序分组并保留文章顺序', () => {
  const posts = [post('2025-01-02', 'a'), post('2026-10-01', 'b'), post('2026-02-01', 'c'), post('2026-10-02', 'd')];
  assert.deepEqual(groupPostsByYearMonth(posts).map((year) => ({
    year: year.year,
    months: year.months.map((month) => [month.month, month.posts.map((item) => item.title)]),
  })), [
    { year: 2026, months: [[10, ['b', 'd']], [2, ['c']]] },
    { year: 2025, months: [[1, ['a']]] },
  ]);
});
