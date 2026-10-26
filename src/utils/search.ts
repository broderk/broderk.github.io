export interface SearchPost {
  title: string;
  description: string;
  tags: string[];
  body: string;
  url: string;
}

const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('zh-CN');

export function searchPosts(posts: SearchPost[], query: string): SearchPost[] {
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];
  return posts.map((post) => {
    const title = normalize(post.title);
    const tags = normalize(post.tags.join(' '));
    const content = normalize(post.description + ' ' + post.body);
    const haystack = title + ' ' + tags + ' ' + content;
    if (!terms.every((term) => haystack.includes(term))) return { post, score: 0 };
    const score = terms.reduce((total, term) =>
      total + (title.includes(term) ? 5 : 0) + (tags.includes(term) ? 3 : 0) + (content.includes(term) ? 1 : 0), 0);
    return { post, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
}
