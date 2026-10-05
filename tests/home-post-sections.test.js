const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceHomeHtml } = require('../scripts/home-post-sections');

function page(pinned = [true, false, false]) {
  const cards = pinned.map((pin, index) => `<div class="recent-post-item"><div class="recent-post-info"><a class="article-title" href="/post-${index}/">${pin ? '<i class="fas fa-thumbtack sticky"></i>' : ''}文章${index}</a><div class="article-meta-wrap"><time>2026-10-0${3 - index}</time></div></div></div>`).join('');
  return `<!DOCTYPE html><html><head><link rel="stylesheet" href="/css/custom-bundle.css"></head><body><header id="page-header" class="full_page"></header><div id="recent-posts"><div class="recent-post-items">${cards}</div></div><script>window.example = "保持脚本";</script></body></html>`;
}

function read(html) {
  return new JSDOM(html).window.document;
}

test('当首页同时有精选和普通文章时应该清楚分组并保留顺序与链接', () => {
  const document = read(enhanceHomeHtml(page()));
  assert.deepEqual([...document.querySelectorAll('.home-post-heading')].map(el => el.textContent), ['精选记录', '最新文章']);
  assert.deepEqual([...document.querySelectorAll('.article-title')].map(el => el.getAttribute('href')), ['/post-0/', '/post-1/', '/post-2/']);
  assert.equal(document.querySelector('.home-post-heading').nextElementSibling.querySelector('.article-title').textContent, '文章0');
  assert.equal(document.querySelectorAll('.home-post-heading')[1].nextElementSibling.querySelector('.article-title').textContent, '文章1');
  assert.equal(document.querySelector('.post-featured-label').textContent, '精选');
  assert.equal(document.querySelector('.article-title .sticky'), null);
  assert.equal(document.querySelector('script').textContent, 'window.example = "保持脚本";');
  assert.equal(document.querySelector('link').getAttribute('href'), '/css/custom-bundle.css');
});

test('当首页没有精选文章时应该只显示最新文章区域', () => {
  const document = read(enhanceHomeHtml(page([false, false])));
  assert.deepEqual([...document.querySelectorAll('.home-post-heading')].map(el => el.textContent), ['最新文章']);
  assert.equal(document.querySelector('.post-featured-label'), null);
});

test('当首页只有精选文章时应该不生成空的最新区域', () => {
  const document = read(enhanceHomeHtml(page([true, true])));
  assert.deepEqual([...document.querySelectorAll('.home-post-heading')].map(el => el.textContent), ['精选记录']);
  assert.equal(document.querySelectorAll('.post-featured-label').length, 2);
});

test('当首页重复经过构建时应该不重复添加分隔和标签', () => {
  const enhanced = enhanceHomeHtml(page());
  assert.equal(enhanceHomeHtml(enhanced), enhanced);
});

test('当页面不是首页或没有文章时应该原样保留页面', () => {
  const article = page().replace('class="full_page"', 'class="post-bg"');
  assert.equal(enhanceHomeHtml(article), article);
  const empty = page([]);
  assert.equal(enhanceHomeHtml(empty), empty);
});
