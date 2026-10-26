export const POSTS_PER_PAGE = 10;

export function postsPageHref(page: number): string {
  return page === 1 ? '/posts/' : `/posts/page/${page}/`;
}

export function paginatePosts<T>(posts: T[], page: number, pageSize = POSTS_PER_PAGE) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError('Invalid page size');
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    throw new RangeError('Invalid page or page size');
  }
  return {
    posts: posts.slice((page - 1) * pageSize, page * pageSize),
    page,
    totalPages,
    totalPosts: posts.length,
  };
}

export function groupPostsByYearMonth<T extends { data: { pubDate: Date } }>(posts: T[]) {
  const years = new Map<number, Map<number, T[]>>();
  for (const post of posts) {
    const year = post.data.pubDate.getUTCFullYear();
    const month = post.data.pubDate.getUTCMonth() + 1;
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(post);
  }
  return [...years].sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      count: [...months.values()].reduce((total, group) => total + group.length, 0),
      months: [...months].sort(([a], [b]) => b - a)
        .map(([month, monthPosts]) => ({ month, posts: monthPosts })),
    }));
}
