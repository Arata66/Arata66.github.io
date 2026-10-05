const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceContentNavigation } = require('../scripts/content-navigation');

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
