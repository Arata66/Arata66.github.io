const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkSite, countPublishedPosts } = require('../scripts/site-integrity');

const site = 'https://arata66.top/';
function page(route, body = '', metadata = '') {
  return `<html><head><title>示例 | 博客</title><link rel="canonical" href="${site}${route}">${metadata}</head><body>${body}</body></html>`;
}
function article(route = 'posts/example/') {
  return page(route, '<header id="post-info"><h1>示例</h1></header><div id="post"><article id="article-container"><h2 id="正文标题">正文标题</h2></article></div><div id="post-meta"><time class="post-meta-date-created" datetime="2026-10-03T16:00:00.000Z">2026-10-04</time><time class="post-meta-date-updated" datetime="2026-10-04T11:20:23.000Z">2026-10-04</time></div>', '<meta name="description" content="记录博客日常"><meta property="og:title" content="示例"><meta property="og:url" content="' + site + route + '"><meta property="og:image" content="' + site + 'img/cover.webp"><meta property="article:published_time" content="2026-10-03T16:00:00.000Z"><meta property="article:modified_time" content="2026-10-04T11:20:23.000Z">');
}
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-integrity-'));
  // 只回收本测试创建的目录，避免影响真实构建产物。
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, value] of Object.entries(files)) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, value);
  }
  return root;
}

test('当访客访问中文目录查询参数和正文锚点时应该找到真实页面和资源', t => {
  const root = fixture(t, {
    'index.html': page('', '<a href="/分类/生活/?from=home#正文标题">生活</a><a href="' + site + '分类/生活/">同站绝对链接</a><link rel="stylesheet" href="css/site.css?v=123"><script src="/js/app.js?v=456"></script><img lazy-src="/img/cover.webp">'),
    '分类/生活/index.html': page('分类/生活/', '<h2 id="正文标题">标题</h2><a href="../../#首页">返回</a>'),
    'css/site.css': '', 'js/app.js': '', 'img/cover.webp': ''
  });
  fs.writeFileSync(path.join(root, 'index.html'), page('', '<h2 id="首页">首页</h2><a href="/%E5%88%86%E7%B1%BB/%E7%94%9F%E6%B4%BB/?from=home#%E6%AD%A3%E6%96%87%E6%A0%87%E9%A2%98">生活</a><a href="' + site + '分类/生活/">同站绝对链接</a><link rel="stylesheet" href="css/site.css?v=123"><script src="/js/app.js?v=456"></script><img lazy-src="/img/cover.webp">'));
  const result = checkSite(root, site);
  assert.deepEqual(result.errors, []);
  assert.equal(result.pages, 2);
  assert.ok(result.references >= 5);
});

test('当站内页面和静态资源不存在时应该报告来源页和具体链接', t => {
  const root = fixture(t, { 'index.html': page('', '<a href="/missing/">文章</a><script src="/js/missing.js?v=1"></script><img src="/img/missing.webp">') });
  const result = checkSite(root, site);
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.every(error => error.includes('index.html')));
  assert.match(result.errors.join('\n'), /\/missing\//);
  assert.match(result.errors.join('\n'), /\/js\/missing\.js/);
  assert.match(result.errors.join('\n'), /\/img\/missing\.webp/);
});

test('当正文标题锚点已被删除时应该报错且命名锚点和文字片段仍可使用', t => {
  const root = fixture(t, { 'index.html': page('', '<a href="#旧标题">失效</a><a href="#旧式锚点">旧式</a><a name="旧式锚点"></a><a href="#:~:text=正文">文字定位</a><a href="#">返回顶部</a>') });
  const result = checkSite(root, site);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /旧标题/);
});

test('当外部服务或特殊操作链接不可达时应该不发起联网或阻塞构建', t => {
  const root = fixture(t, { 'index.html': page('', '<a href="https://unavailable.example/article#missing">外链</a><img src="//cdn.example/cover.webp"><a href="mailto:test@example.com">邮件</a><a href="javascript:void(0)">工具</a><img src="data:image/png;base64,abc">') });
  assert.deepEqual(checkSite(root, site).errors, []);
});

test('当规范地址和页面标题被错误改动时应该发现地址错页或标题缺失', t => {
  const root = fixture(t, { 'index.html': page('').replace('<title>示例 | 博客</title>', '<title> </title>').replace('href="' + site + '"', 'href="' + site + '?from=test"') });
  const errors = checkSite(root, site).errors.join('\n');
  assert.match(errors, /标题/);
  assert.match(errors, /规范地址/);
});

test('当文章信息齐全时应该保留日期和内容且检查本地封面', t => {
  const html = article();
  const root = fixture(t, { 'index.html': page(''), 'posts/example/index.html': html, 'img/cover.webp': '' });
  const result = checkSite(root, site, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.posts, 1);
  assert.equal(fs.readFileSync(path.join(root, 'posts/example/index.html'), 'utf8'), html);
});

test('当文章缺少描述或使用错误的日期时应该在发布前指出问题', t => {
  const html = article().replace('<meta name="description" content="记录博客日常">', '').replace('content="2026-10-03T16:00:00.000Z"', 'content="昨天"').replace('content="2026-10-04T11:20:23.000Z"', 'content="2020-01-01T00:00:00.000Z"');
  const root = fixture(t, { 'index.html': page(''), 'posts/example/index.html': html, 'img/cover.webp': '' });
  const errors = checkSite(root, site, 1).errors.join('\n');
  assert.match(errors, /描述/);
  assert.match(errors, /发表时间/);
  assert.match(errors, /更新时间.*正文/);
});

test('当文章更新时间早于发表或标题信息不一致时应该报错', t => {
  const html = article().replaceAll('2026-10-04T11:20:23.000Z', '2020-01-01T00:00:00.000Z').replace('property="og:title" content="示例"', 'property="og:title" content="其他标题"');
  const root = fixture(t, { 'index.html': page(''), 'posts/example/index.html': html, 'img/cover.webp': '' });
  const errors = checkSite(root, site, 1).errors.join('\n');
  assert.match(errors, /更新时间.*发表/);
  assert.match(errors, /标题.*正文/);
});

test('当生成遗漏了已发布文章或输出目录为空时应该中止发布检查', t => {
  const root = fixture(t, { 'index.html': page('') });
  assert.match(checkSite(root, site, 1).errors.join('\n'), /文章数量/);
  fs.unlinkSync(path.join(root, 'index.html'));
  assert.match(checkSite(root, site).errors.join('\n'), /首页/);
});

test('当链接带损坏的编码或试图越出输出目录时应该报告错误', t => {
  const root = fixture(t, { 'index.html': page('', '<a href="/%E0%A4%A">坏编码</a><a href="/img/%2e%2e%2foutside.html">越界</a>') });
  const result = checkSite(root, site);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors.join('\n'), /编码|路径/);
});

test('当源文件含未发布草稿和子目录文章时应该只统计已发布文章', t => {
  const root = fixture(t, { 'first.md': '---\ntitle: 第一篇\n---\n正文', 'draft.md': '---\ntitle: 草稿\npublished: false\n---\n正文', 'nested/second.md': '---\ntitle: 第二篇\npublished: true\n---\n正文' });
  assert.equal(countPublishedPosts(root), 2);
});

test('当日期写成不存在的日历日期时应该发现时间无效', t => {
  const html = article().replaceAll('2026-10-03T16:00:00.000Z', '2026-02-30T16:00:00.000Z');
  const root = fixture(t, { 'index.html': page(''), 'posts/example/index.html': html, 'img/cover.webp': '' });
  assert.match(checkSite(root, site, 1).errors.join('\n'), /发表时间.*无效/);
});

test('当页面文件名只以index结尾时应该按实际文件地址检查而不误认为目录首页', t => {
  const root = fixture(t, { 'index.html': page('', '<a href="/myindex.html">独立页面</a>'), 'myindex.html': page('myindex.html') });
  assert.deepEqual(checkSite(root, site).errors, []);
});

test('当链接使用同时具有id和name的旧式锚点时应该找到两个合法入口', t => {
  const root = fixture(t, { 'index.html': page('', '<a id="new" name="legacy"></a><a href="#new">新入口</a><a href="#legacy">旧入口</a>') });
  assert.deepEqual(checkSite(root, site).errors, []);
});

test('当目录名含点号且链接未带末尾斜线时应该找到目录首页', t => {
  const root = fixture(t, { 'index.html': page('', '<a href="/tags/Node.js">标签</a>'), 'tags/Node.js/index.html': page('tags/Node.js/') });
  assert.deepEqual(checkSite(root, site).errors, []);
});

test('当正文日期文字与上海时区日期不符时应该发现公开信息不一致', t => {
  const html = article().replace('>2026-10-04</time>', '>1900-01-01</time>');
  const root = fixture(t, { 'index.html': page(''), 'posts/example/index.html': html, 'img/cover.webp': '' });
  assert.match(checkSite(root, site, 1).errors.join('\n'), /发表时间.*日期文字/);
});

test('当源目录含隐藏Markdown文件或隐藏子目录时应该和Hexo一样忽略它们', t => {
  const root = fixture(t, { 'first.md': '---\ntitle: 第一篇\n---\n正文', '.hidden.md': '---\ntitle: 隐藏\n---\n正文', '.hidden/second.md': '---\ntitle: 隐藏目录\n---\n正文', '_hidden.md': '---\ntitle: 隐藏\n---\n正文', '_hidden/second.md': '---\ntitle: 隐藏目录\n---\n正文' });
  assert.equal(countPublishedPosts(root), 1);
});
