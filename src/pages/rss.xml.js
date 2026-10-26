import rss from '@astrojs/rss';
import { siteConfig } from '../config/site';
import { getPublishedPosts, postHref } from '../utils/posts';

export async function GET(context) {
  const posts = await getPublishedPosts();

  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    // Astro.site 由 SITE_URL 统一配置；未配置时仅用于本地预览。
    site: context.site ?? 'http://localhost:4321',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postHref(post.id),
    })),
    customData: '<language>zh-cn</language>',
  });
}
