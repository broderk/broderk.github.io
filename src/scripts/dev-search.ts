import { searchPosts, type SearchPost } from '../utils/search';

const input = document.querySelector<HTMLInputElement>('#development-search');
const summary = document.querySelector<HTMLElement>('#development-search-summary');
const results = document.querySelector<HTMLElement>('#development-search-results');
const data = document.querySelector('#development-search-data');

if (input && summary && results && data?.textContent) {
  const posts: SearchPost[] = JSON.parse(data.textContent);
  const update = () => {
    const query = input.value.trim();
    const matches = searchPosts(posts, query);
    results.replaceChildren();
    summary.textContent = !query ? '输入关键词，搜索已发布的文章。'
      : matches.length ? '找到 ' + matches.length + ' 个相关结果'
      : '未找到相关结果，请换个关键词，或前往文章列表浏览。';
    for (const post of matches) {
      const article = document.createElement('article');
      article.className = 'search-result';
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = post.url;
      link.textContent = post.title;
      heading.append(link);
      const excerpt = document.createElement('p');
      excerpt.textContent = post.description;
      article.append(heading, excerpt);
      results.append(article);
    }
  };
  input.addEventListener('input', update);
  update();
}
