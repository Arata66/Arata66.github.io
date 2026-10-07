const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceContentNavigation } = require('../scripts/content-navigation');
const navigation = require('../scripts/content-navigation');

function page(home = true) {
  return `<!doctype html><html><head></head><body><header id="page-header" class="${home ? 'full_page' : 'post-bg'}"></header>
    <main id="recent-posts"><div class="recent-post-items"><h2 class="home-post-heading">最新文章</h2><article><a href="/note/">原来的文章</a></article></div></main>
    <footer id="footer"><div class="footer_custom_text"><div id="site-stats">统计</div></div></footer><script>window.example = "原脚本";</script></body></html>`;
}

test('当访客打开首页时应该看到已有技术生活归档与订阅入口并保留文章', () => {
  const dom = new JSDOM(enhanceContentNavigation(page()));
  const document = dom.window.document;
  assert.deepEqual([...document.querySelectorAll('.home-discovery a')].map(a => a.getAttribute('href')),
    ['/categories/%E6%8A%80%E6%9C%AF/', '/categories/%E7%94%9F%E6%B4%BB/', '/archives/', '/subscribe/']);
  assert.equal(document.querySelector('.home-discovery').nextElementSibling.textContent, '最新文章');
  assert.equal(document.querySelector('article a').getAttribute('href'), '/note/');
  assert.equal(document.querySelector('script').textContent, 'window.example = "原脚本";');
  assert.equal(document.querySelector('link[rel="alternate"]').getAttribute('href'), '/atom.xml');
  dom.window.close();
});

test('当访客直接进入文章页时应该只显示页脚入口而不插入首页浏览条', () => {
  const dom = new JSDOM(enhanceContentNavigation(page(false)));
  assert.equal(dom.window.document.querySelector('.home-discovery'), null);
  assert.deepEqual([...dom.window.document.querySelectorAll('.footer-content-links a')].map(a => a.textContent), ['文章归档', '订阅更新']);
  dom.window.close();
});

test('当页面重复构建且已存在 Atom 自动发现链接时应该保持入口唯一', () => {
  const original = page().replace('</head>', '<link rel="alternate" type="application/atom+xml" href="/atom.xml"></head>');
  const enhanced = enhanceContentNavigation(original);
  assert.equal(enhanceContentNavigation(enhanced), enhanced);
  const dom = new JSDOM(enhanced);
  assert.equal(dom.window.document.querySelectorAll('.home-discovery').length, 1);
  assert.equal(dom.window.document.querySelectorAll('.footer-content-links').length, 1);
  assert.equal(dom.window.document.querySelectorAll('link[type="application/atom+xml"]').length, 1);
  dom.window.close();
});

const categories = [{ name: '技术', href: '/categories/%E6%8A%80%E6%9C%AF/', count: 3 }, { name: '生活', href: '/categories/%E7%94%9F%E6%B4%BB/', count: 3 }];

function collection(pathname = '/archives/', id = 'archive', heading = '归档', count = 6) {
  return `<!doctype html><html><head><link rel="canonical" href="https://arata66.top${pathname}"></head><body>
    <header id="page-header"><h1 id="site-title">${heading}</h1></header><main><div id="${id}">
    <div class="article-sort-title">全部文章 - ${count}</div><div class="article-sort"><time datetime="2026-10-03T16:01:00.000Z">2026-10-04</time><a href="/note/">原文章</a></div></div></main></body></html>`;
}

test('当访客进入归档时应该直接切换实际分类与标签且保留原文章日期', () => {
  const dom = new JSDOM(enhanceContentNavigation(collection(), categories)); const document = dom.window.document;
  const nav = document.querySelector('#archive > .collection-nav'); assert.ok(nav);
  assert.equal(nav.getAttribute('aria-label'), '文章浏览');
  assert.deepEqual([...nav.querySelectorAll('a')].map(a => a.getAttribute('href')), ['/archives/', categories[0].href, categories[1].href, '/tags/']);
  assert.equal(nav.querySelector('[aria-current="page"]').textContent, '全部文章');
  assert.equal(document.querySelector('time').getAttribute('datetime'), '2026-10-03T16:01:00.000Z');
  assert.equal(document.querySelector('.article-sort a').getAttribute('href'), '/note/');
  dom.window.close();
});

test('当进入分类文章列表时应该说明当前分类与真实文章数', () => {
  const dom = new JSDOM(enhanceContentNavigation(collection(categories[0].href, 'category', '技术'), categories));
  const current = dom.window.document.querySelector('.collection-nav [aria-current="page"]'); assert.ok(current);
  assert.equal(current.getAttribute('href'), categories[0].href);
  assert.equal(current.getAttribute('aria-label'), '技术，3篇文章');
  dom.window.close();
});

test('当进入标签文章列表时应该保留返回标签索引和全部文章的普通链接', () => {
  const dom = new JSDOM(enhanceContentNavigation(collection('/tags/Hexo/', 'tag', 'Hexo'), categories));
  const current = dom.window.document.querySelector('.collection-nav [aria-current="location"]'); assert.ok(current);
  assert.equal(current.getAttribute('href'), '/tags/');
  assert.equal(current.textContent, '按标签找');
  assert.equal(dom.window.document.querySelector('.collection-nav a').getAttribute('href'), '/archives/');
  dom.window.close();
});

test('当进入月份或年份归档时应该说明当前范围而非把局部数量称作全部文章', () => {
  for (const { pathname, heading, count } of [{ pathname: '/archives/2026/10/', heading: '十月 2026', count: 2 }, { pathname: '/archives/2026/', heading: '2026', count: 5 }]) {
    const dom = new JSDOM(enhanceContentNavigation(collection(pathname, 'archive', heading, count), categories));
    assert.equal(dom.window.document.querySelector('.article-sort-title').textContent, `${heading} · ${count}篇`);
    assert.equal(dom.window.document.querySelector('.collection-nav [aria-current]'), null);
    dom.window.close();
  }
});

test('当进入分页归档时应该继续标明全部文章入口而保持分页原列表', () => {
  const dom = new JSDOM(enhanceContentNavigation(collection('/archives/page/2/'), categories));
  const current = dom.window.document.querySelector('.collection-nav [aria-current="page"]'); assert.ok(current);
  assert.equal(current.getAttribute('href'), '/archives/');
  assert.equal(dom.window.document.querySelector('.article-sort-title').textContent, '全部文章 · 6篇');
  dom.window.close();
});

test('当同一列表重复增强时应该只出现一个浏览导航并保持输出不变', () => {
  const first = enhanceContentNavigation(collection(), categories);
  assert.equal(enhanceContentNavigation(first, categories), first);
  const dom = new JSDOM(first); assert.equal(dom.window.document.querySelectorAll('.collection-nav').length, 1); dom.window.close();
});

test('当读取分类索引时应该使用真实名称数量与链接并忽略外站或无文章分类', () => {
  assert.equal(typeof navigation.readContentCategories, 'function');
  const html = '<ul class="category-list"><li class="category-list-item"><a class="category-list-link" href="/categories/%E6%8A%80%E6%9C%AF/">技术 &amp; 折腾</a><span class="category-list-count">3</span></li><li class="category-list-item"><a class="category-list-link" href="https://evil.example/categories/test/">外站</a><span class="category-list-count">1</span></li><li class="category-list-item"><a class="category-list-link" href="/categories/empty/">空分类</a><span class="category-list-count">0</span></li></ul>';
  assert.deepEqual(navigation.readContentCategories(html), [{ name: '技术 & 折腾', href: categories[0].href, count: 3 }]);
});

test('当分类名包含标记字符时应该作为普通文字显示而不注入标签', () => {
  const dom = new JSDOM(enhanceContentNavigation(collection(), [{ ...categories[0], name: '<img src=x onerror=alert(1)>' }]));
  const nav = dom.window.document.querySelector('.collection-nav'); assert.ok(nav);
  assert.equal(nav.querySelector('img'), null); assert.match(nav.textContent, /<img src=x onerror=alert\(1\)>/);
  dom.window.close();
});

test('当分类索引或文章详情没有时间线容器时应该不插入列表导航', () => {
  for (const html of [page(false), collection('/categories/', 'page', '分类'), collection('/tags/', 'page', '标签')]) {
    const dom = new JSDOM(enhanceContentNavigation(html, categories));
    assert.equal(dom.window.document.querySelector('.collection-nav'), null); dom.window.close();
  }
});
