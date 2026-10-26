# Tomo的博客

基于 Astro、TypeScript、Markdown/MDX 的个人博客基础框架。

运行环境：Node.js 22.23.4 或以上（推荐 Node.js 24 LTS）。

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:4321`，终端会显示实际地址。

## 目录

```text
public/                  静态资源、图标
src/
  assets/                头像等构建时优化的图片
  components/            公共组件
  config/site.ts         站点名称、昵称、简介与公开邮箱
  content/posts/         Markdown / MDX 文章
  layouts/               页面布局
  pages/                 文件路由：首页、关于、文章、标签、搜索、归档、RSS、404
  styles/                全局样式
  utils/                 文章排序与标签链接、文章目录层级
  content.config.ts      文章数据定义与校验
tests/                   内容导航、搜索、分页归档、SEO、可访问性与静态页面链接测试
astro.config.mjs         Astro 配置
tsconfig.json            TypeScript 配置
```

## 写文章

在 `src/content/posts/` 中添加 `.md` 或 `.mdx` 文件：

```markdown
---
title: "我的新文章"
description: "文章摘要"
pubDate: 2026-10-26
tags: ["技术"]
draft: false
---

文章正文。
```

文件名决定文章地址，例如 `hello-world.md` 对应 `/posts/hello-world/`。
设置 `draft: true` 可隐藏草稿；文章默认按日期倒序展示，同日按 ID 固定顺序。
标签自动生成标签总览与对应文章页，草稿的标签不会出现；标签名可包含中文。
文章正文的 Markdown 标题使用原始 `#`～`######` 等级生成目录及锚点；不改变原文层级。宽屏时目录固定在正文右侧并随滚动显示；窄屏（900px 以下）回到正文上方。没有标题时不显示目录。
上一篇指发布时间更早的文章，下一篇指发布时间更新的文章，首尾文章会自动隐藏无效链接。
文章列表按发布日期倒序，每页显示 10 篇；首页为 /posts/，后续页为 /posts/page/2/ 等。“归档”页按 UTC 年份、月份倒序列出所有已发布文章及日期，支持年份快速跳转。每页篇数可在 src/utils/browse.ts 的 POSTS_PER_PAGE 中调整。分页和归档均隐藏草稿。
顶部导航的“搜索”可检索已发布文章的标题、标签和正文。`npm run dev` 下直接使用当前文章数据搜索，无需提前构建；正式构建使用 Pagefind 静态索引，发布或预览前运行 `npm run build` 即可更新索引。两种模式均过滤草稿。

## 检查与构建

```bash
npm run check
npm run build
npm test
npm run preview
```

构建输出位于 `dist/`。当前使用静态生成，无需数据库。

日常修改后可运行 `npm run ci`，按顺序执行静态检查、完整构建（含 Pagefind 索引）和所有回归测试；任一步失败都会以非零状态结束。`npm run preview -- --host 127.0.0.1 --port 4322` 预览的是最近一次 `dist/`，修改文章后需重新构建。

`.github/workflows/quality.yml` 在 push、pull request 或手动触发时使用 Node.js 24、`npm ci` 和 `npm run ci` 检查代码；`.github/workflows/deploy.yml` 则只会在 `broderk/broderk.github.io` 的默认分支推送或手动触发时，先运行 `npm run release:check`，通过后上传 `dist/` 并部署到 GitHub Pages。

正式发布前设置 `SITE_URL` 为 `https://broderk.github.io`，然后运行 `npm run release:check`。它会先拒绝空地址、localhost 和常见示例域名，再执行完整检查，并核对首页、文章列表、搜索、404、RSS、robots、站点地图和搜索索引。检查通过只代表本地构建产物符合要求，不代表远程部署已经通过验收。发布检查清单保存在本地 `docs/release-checklist.md`（`docs/` 被 .gitignore 排除，不会上传）。

## 发布到 GitHub Pages（broderk）

本项目使用 GitHub 用户主页仓库 `broderk/broderk.github.io`，站点地址为 `https://broderk.github.io/`。站内链接以 `/` 开头；若改用普通项目仓库或自定义域名，需重新检查路径、`SITE_URL` 与 Pages 设置。

1. 在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 在本地确认 `git status --short`、`git diff --cached --name-only` 与 `git diff --cached --check`，确保没有秘密或未授权公开的素材。提交更改并推送至默认分支 `main`：

   ```powershell
   git add .
   git commit -m "Prepare personal blog for GitHub Pages"
   git push -u origin main
   ```

3. 在仓库 **Actions** 页面等待 **Publish blog to GitHub Pages** 通过，再访问站点。工作流自动设置公开的 `SITE_URL=https://broderk.github.io`、检查构建并发布，无须上传本地 `dist/` 或把密码写入仓库。
4. 部署后检查文章链接、中文路径、站内搜索、RSS、站点地图与 404；若 Actions 未运行，先确认 Pages 的 Source 设置、默认分支及仓库名是否正确。

站点身份统一在 `src/config/site.ts` 中维护，头像位于 `src/assets/avatar.jpg`。

## Git 提交边界

`.gitignore` 已排除依赖、构建产物、缓存、环境变量、私钥、日志、测试报告、编辑器配置与系统文件；保留原有 `/docs/` 内部文档忽略规则。额外的私密笔记或未公开草稿可放在根目录 `/private/`，不要放到 `public/` 或文章目录里。

应提交 `src/`、`public/` 中确认可以公开的素材、`scripts/`、`tests/`、`.github/workflows/`、`package.json`、`package-lock.json`、Astro/TypeScript 配置、README 和 `.gitignore`，这样远端才能复现构建。

不要提交真实密码、API token、部署凭据、私钥、数据库或个人隐私资料，无论文件名是否已被忽略。`.env.example` 可以提交，但只能包含变量名、说明和安全占位值；Astro 的 `PUBLIC_` 环境变量会进入浏览器端，绝不能存放密钥。`draft: true` 只控制文章是否发布，不会让 Markdown 源文件从 Git 中隐藏；公开仓库中的草稿仍可被阅读。图片中的隐私内容与 EXIF 信息也需自行检查，不能只依赖忽略规则。

提交前运行 `git status --short`，暂存后运行 `git diff --cached` 检查将要上传的内容，不要用 `git add -f` 绕过敏感文件规则。`.gitignore` 不会自动停止跟踪已提交的文件，也不会清理历史；若凭据曾泄露，应先撤销/轮换凭据，再处理跟踪和历史记录。

## 可访问性与 404

每页的第一个键盘入口是“跳至正文”：按 Tab 显示，按 Enter 将焦点移至正文，再按 Tab 可直接操作正文内的链接。全站交互元素提供清晰焦点框；正式搜索组件使用同一套焦点配色。小屏导航可换行，正文图片不会超出内容宽度。

首页与关于页头像已提供作者替代文本。文章中的内容图片须填写描述，例如 `![展示 RoPE 旋转前后向量方向的示意图](./rope-diagram.png)`；描述应说明图片传达的信息，不要仅写“图片”或文件名。纯装饰图可使用 `<img src="/decoration.svg" alt="" role="presentation" />`。`npm test` 会检查生成页面是否缺少 alt，空 alt 是否显式标记为装饰用途；描述是否准确仍需作者审阅。

`src/pages/404.astro` 提供返回首页、浏览文章和搜索入口，构建输出为 `dist/404.html`，设为 noindex 且不进入站点地图。开发/预览时访问任意不存在的路径可验证。正式部署时需让托管平台以 **HTTP 404** 状态展示该文件，不要把未知路径统一重写为返回 200 的首页；部署后仍需检查实际状态码。

## SEO 与正式域名

各页提供独立标题、摘要、自引用 canonical、Open Graph 和 Twitter Card；文章额外提供 BlogPosting JSON-LD。默认分享图由现有头像源图裁切生成 1200×630 JPEG，文章的 title、description、pubDate 和可选 updatedDate 同步到元数据。搜索页和 404 设为 noindex，不进入站点地图；草稿不会生成文章页或进入地图。

构建自动生成 /sitemap-index.xml、/sitemap-0.xml 和 /robots.txt。正式地址统一通过构建环境变量 SITE_URL 配置，必须为完整 HTTPS 域名（不含子目录、查询参数或锚点）。当前 GitHub Pages 地址为 `https://broderk.github.io`；PowerShell 本地验证示例：

```powershell
$env:SITE_URL = 'https://broderk.github.io'
npm run build
npm run preview
```

部署平台也需设置相同的 SITE_URL 后重新构建；环境变量不会自动跨终端保存。canonical、分享链接、站点地图和 RSS 会同步使用该地址。robots.txt 允许抓取并提供正式 Sitemap 链接，站内搜索和 404 仍为 noindex。

不设置 SITE_URL 时只生成 localhost 本地预览链接，全站标记 noindex，robots.txt 不提供正式 Sitemap 地址。请勿直接部署本地预览产物；GitHub Pages 工作流已经配置正式 SITE_URL。若后续使用自定义域名，需同步修改工作流的 SITE_URL 并重新检查 canonical、分享图、RSS 和 sitemap。

独立分类体系可在后续按需要添加。
