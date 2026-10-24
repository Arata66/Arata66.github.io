const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceHomeOverview } = require('../scripts/home-overview');
const { enhanceHomeHtml } = require('../scripts/home-post-sections');

function page({ aside = true, posts = true, canonical = '/' } = {}) {
  const cards = posts ? [
    ['old', '2026-06-29', '精选旧文'],
    ['new', '2026-10-04', '新文章'],
    ['same', '2026-10-04', '同一天的文章']
  ].map(([slug, date, title]) => `<div class="recent-post-item"><div class="post_cover"><a href="/${slug}/"><img src="/img/${slug}.webp" alt="${title}"></a></div><div class="recent-post-info">${slug === 'old' ? '<span class="post-featured-label">精选</span>' : ''}<a class="article-title" href="/${slug}/">${title}</a><div class="article-meta-wrap"><time datetime="${date}T00:00:00+08:00">${date}</time></div><div class="content">原有摘要</div></div></div>`).join('') : '';
  return `<!doctype html><html><head><title>原首页标题</title><link rel="canonical" href="https://arata66.top${canonical}"></head><body><header id="page-header" class="full_page"><div id="site-info"><h1 id="site-title">Arata66 の Blog</h1><div id="site-subtitle"><span id="subtitle"></span></div><div id="site_social_icons">原社交入口</div></div></header><main id="content-inner" class="layout"><div id="recent-posts" class="recent-posts"><section class="journal-preview"><h2 id="journal-heading">兴趣手账</h2><article id="journal-note">原始近况与日期</article></section><div class="recent-post-items"><nav class="home-discovery"><a href="/archives/">所有文章</a></nav><h2 class="home-post-heading">精选记录</h2>${cards}<div id="pagination"><a href="/page/2/">下一页</a></div></div></div>${aside ? '<aside id="aside-content"><div class="card-announcement">原公告</div><div class="sticky_layout"><a href="/tags/">原标签入口</a></div></aside>' : ''}</main><script>window.existing = '保留原脚本';</script></body></html>`;
}
function read(t, html) { const dom = new JSDOM(html); t.after(() => dom.window.close()); return dom.window.document; }

test('当访客打开首页时应该先看到身份与阅读入口且仍使用原品牌和元数据', t => {
  const document = read(t, enhanceHomeOverview(page()));
  assert.ok(document.querySelector('#content-inner').classList.contains('home-overview'));
  assert.equal(document.querySelector('#site-title').textContent, 'Arata66 の Blog');
  assert.match(document.querySelector('.home-hero-intro').textContent, /Java 学习者.*二次元爱好者/);
  assert.equal(document.querySelector('.home-hero-links a').getAttribute('href'), '#home-posts');
  assert.ok(document.querySelector('#home-posts'));
  assert.equal(document.querySelector('title').textContent, '原首页标题');
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://arata66.top/');
  assert.ok(document.querySelector('#subtitle'));
});

test('当旧精选早于新文章时应该优先展示最新文章且所有原文只出现一次', t => {
  const document = read(t, enhanceHomeOverview(page()));
  assert.equal(document.querySelector('.home-latest .article-title').getAttribute('href'), '/new/');
  assert.deepEqual([...document.querySelectorAll('.recent-post-item .article-title')].map(link => link.getAttribute('href')), ['/new/', '/same/', '/old/']);
  assert.equal(document.querySelectorAll('.recent-post-item').length, 3);
  assert.equal(document.querySelector('.post-featured-label').closest('.recent-post-item').querySelector('.article-title').textContent, '精选旧文');
  assert.ok(document.querySelector('#recent-posts #pagination a[href="/page/2/"]'));
});

test('当首页重排时应该按最新文章近况和更多文章顺序阅读且保留原侧栏入口', t => {
  const document = read(t, enhanceHomeOverview(page()));
  const content = document.querySelector('#content-inner');
  assert.deepEqual([...content.children].map(node => node.id || node.className), ['home-latest', 'aside-content', 'recent-posts']);
  assert.equal(document.querySelector('#aside-content .journal-preview #journal-note').textContent, '原始近况与日期');
  assert.equal(document.querySelectorAll('#journal-note').length, 1);
  assert.ok(document.querySelector('.home-site-details:not([open]) .card-announcement'));
  assert.ok(document.querySelector('.home-site-details a[href="/tags/"]'));
  assert.ok(document.querySelector('details.home-terminal-shell:not([open]) [data-home-terminal-slot]'));
  assert.ok(document.querySelector('.home-interest-links a[href="/music/"]'));
  assert.ok(document.querySelector('.home-interest-links a[href="/tools/"]'));
});

test('当同一首页重复构建时应该保持布局和现有内容唯一', t => {
  const html = enhanceHomeOverview(page());
  assert.equal(enhanceHomeOverview(html), html);
  const document = read(t, html);
  assert.equal(document.querySelectorAll('#home-posts').length, 1);
  assert.equal(document.querySelectorAll('#aside-content').length, 1);
  assert.equal(document.querySelector('script').textContent, "window.existing = '保留原脚本';");
});

test('当页面是内页分页或缺少文章时应该保留原布局', () => {
  for (const html of [page({ canonical: '/page/2/' }), page({ canonical: '/about/' }), page({ posts: false })]) assert.equal(enhanceHomeOverview(html), html);
});

test('当首页没有侧栏时应该仍能完整展示文章和近况', t => {
  const document = read(t, enhanceHomeOverview(page({ aside: false })));
  assert.equal(document.querySelectorAll('.recent-post-item').length, 3);
  assert.equal(document.querySelectorAll('#aside-content').length, 1);
  assert.ok(document.querySelector('#journal-note'));
  assert.equal(document.querySelector('.home-site-details'), null);
});

test('当构建管线复用已改版首页时应该保持文章分区唯一而不补回旧分组', () => {
  const first = enhanceHomeOverview(enhanceHomeHtml(page()));
  const again = enhanceHomeOverview(enhanceHomeHtml(first));
  assert.equal(again, first);
});
