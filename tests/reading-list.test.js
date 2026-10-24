const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { readArticleCatalog, enhanceReadingList } = require('../scripts/reading-list');

const script = fs.readFileSync(path.join(__dirname, '../source/js/reading-list.js'), 'utf8');
const markup = fs.readFileSync(path.join(__dirname, '../source/reading-list/index.md'), 'utf8').replace(/^---[\s\S]*?---/, '');
const KEY = 'blog-reading-list-v1';
const first = '/2026/10/04/mobile-toc-overlap/';
const second = '/2026/06/29/my-playlist/';
const missing = '/2024/01/02/missing-post/';
const catalog = [
  { path: first, title: '手机上的目录为什么挡住了正文', date: '2026-10-04', category: '技术' },
  { path: second, title: '我的听歌报告（大概）', date: '2026-06-29', category: '生活' }
];
const home = () => `<html><head></head><body><main id="recent-posts"><div class="recent-post-items">${catalog.map(item => `<article class="recent-post-item"><div class="recent-post-info"><a class="article-title" href="${item.path}">${item.title}</a><div class="content">文章摘要</div></div></article>`).join('')}</div></main></body></html>`;
const article = () => `<html><head><link rel="canonical" href="https://arata66.top${first}?highlight=目录#chapter"></head><body><main id="post"><article id="article-container">正文</article></main></body></html>`;

function parse(t, html) { const dom = new JSDOM(html); t.after(() => dom.window.close()); return dom.window.document; }
function find(app, selector) { const node = app.document.querySelector(selector); assert.ok(node, `缺少可操作元素：${selector}`); return node; }
function toggle(app, articlePath = first) { const node = [...app.document.querySelectorAll('[data-reading-toggle]')].find(button => button.getAttribute('data-reading-path') === articlePath); assert.ok(node); return node; }

function setup(t, settings = {}) {
  const options = { html: home(), initial: null, readFails: false, writeFails: false, ...settings };
  const dom = new JSDOM(enhanceReadingList(options.html, catalog), { url: 'https://arata66.top/', runScripts: 'outside-only' });
  const { window } = dom;
  let raw = options.initial;
  const writes = [];
  window.pjax = { refresh(container) { for (const link of container.querySelectorAll('a')) link.setAttribute('data-pjax-state', 'ready'); } };
  Object.defineProperty(window, 'localStorage', { value: {
    getItem(key) { assert.equal(key, KEY); if (options.readFails) throw new Error('读取不可用'); return raw; },
    setItem(key, value) { assert.equal(key, KEY); if (options.writeFails) throw new Error('写入不可用'); raw = value; writes.push(value); }
  } });
  Object.defineProperty(window, 'fetch', { value: () => { throw new Error('收藏不应发起网络请求'); } });
  window.eval(script); window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  return {
    window, document: window.document, options, writes, stored: () => raw,
    show(html) {
      window.document.dispatchEvent(new window.Event('pjax:send'));
      const page = new JSDOM(enhanceReadingList(html, catalog));
      window.document.body.innerHTML = page.window.document.body.innerHTML; page.window.close();
      window.document.dispatchEvent(new window.Event('pjax:complete'));
    },
    external(items) { raw = JSON.stringify(items); window.dispatchEvent(new window.StorageEvent('storage', { key: KEY, newValue: raw })); }
  };
}

test('当生成文章目录时应该只收录真实文章并保留标题分类及原文日期', () => {
  const xml = `<search><entry><title>文章 &amp; 原题</title><url>${first}</url><categories><category>技术</category></categories></entry><entry><title>近况</title><url>/journal/#note</url><kind>journal</kind></entry><entry><title>外站</title><url>https://evil.example/2026/10/04/other/</url></entry><entry><title>重复</title><url>${first}</url></entry></search>`;
  assert.deepEqual(readArticleCatalog(xml), [{ path: first, title: '文章 & 原题', date: '2026-10-04', category: '技术' }]);
});

test('当构建首页和文章时应该输出独立收藏按钮且不会把定位参数带入记录', t => {
  const index = parse(t, enhanceReadingList(home(), catalog));
  assert.equal(index.querySelectorAll('[data-reading-toggle]').length, 2);
  assert.ok([...index.querySelectorAll('[data-reading-toggle]')].every(button => button.hasAttribute('hidden')));
  assert.equal(index.querySelector('.article-title').textContent, catalog[0].title);
  const page = enhanceReadingList(article(), catalog);
  assert.equal(enhanceReadingList(page, catalog), page);
  const document = parse(t, page);
  assert.equal(document.querySelector('[data-reading-toggle]').getAttribute('data-reading-path'), first);
  assert.equal(document.querySelector('#article-container').textContent, '正文');
  assert.equal(document.querySelector('.reading-toolbar a').getAttribute('href'), '/reading-list/');
});

test('当目录标题含标记字符时应该安全保存目录数据且重复构建不产生重复脚本', t => {
  const unsafe = [{ ...catalog[0], title: '</script><img src=x onerror=alert(1)>' }];
  const html = enhanceReadingList(markup, unsafe);
  assert.equal(enhanceReadingList(html, unsafe), html);
  const document = parse(t, html);
  assert.equal(document.querySelectorAll('#reading-catalog').length, 1);
  assert.equal(document.querySelector('img'), null);
  assert.equal(JSON.parse(document.querySelector('#reading-catalog').textContent)[0].title, unsafe[0].title);
});

test('当读者主动收藏时应该保存唯一路径并在文章和列表页保持一致', t => {
  const app = setup(t);
  assert.equal(app.writes.length, 0);
  toggle(app).click();
  assert.deepEqual(JSON.parse(app.stored()), [first]);
  assert.equal(toggle(app).getAttribute('aria-pressed'), 'true');
  app.show(article());
  assert.equal(toggle(app).getAttribute('aria-pressed'), 'true');
  app.show(markup);
  assert.match(find(app, '[data-reading-count]').textContent, /1/);
  assert.equal(find(app, '.reading-entry-title').getAttribute('href'), first);
  assert.equal(find(app, '.reading-entry-title').textContent, catalog[0].title);
});

test('当重复初始化或刷新已有收藏时应该不重复绑定且第二次点击能移除', t => {
  const app = setup(t, { initial: JSON.stringify([first, first]) });
  app.window.eval(script);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(toggle(app).getAttribute('aria-pressed'), 'true');
  toggle(app).click();
  assert.deepEqual(JSON.parse(app.stored()), []);
  assert.equal(app.writes.length, 1);
});

test('当读者移除或清空列表时应该可以撤销且焦点仍留在可操作位置', t => {
  const app = setup(t, { html: markup, initial: JSON.stringify([second, first]) });
  find(app, '[data-reading-remove]').focus(); find(app, '[data-reading-remove]').click();
  assert.deepEqual(JSON.parse(app.stored()), [first]);
  assert.ok(app.document.activeElement.isConnected);
  assert.notEqual(app.document.activeElement, app.document.body);
  find(app, '[data-reading-undo]').click();
  assert.deepEqual(JSON.parse(app.stored()), [second, first]);
  find(app, '[data-reading-clear]').click();
  assert.deepEqual(JSON.parse(app.stored()), []);
  assert.equal(find(app, '[data-reading-empty]').hidden, false);
  assert.equal(app.document.activeElement, find(app, '[data-reading-undo]'));
  find(app, '[data-reading-undo]').click();
  assert.deepEqual(JSON.parse(app.stored()), [second, first]);
});

test('当其他标签更新收藏时应该同步按钮和列表且过期撤销不能覆盖新状态', t => {
  const app = setup(t, { html: markup, initial: JSON.stringify([first]) });
  find(app, '[data-reading-remove]').click();
  app.external([second]);
  assert.equal(find(app, '.reading-entry-title').getAttribute('href'), second);
  assert.equal(find(app, '[data-reading-undo]').hidden, true);
  find(app, '[data-reading-undo]').click();
  assert.deepEqual(JSON.parse(app.stored()), [second]);
  app.show(home());
  app.external([first]);
  assert.equal(toggle(app, first).getAttribute('aria-pressed'), 'true');
  assert.equal(toggle(app, second).getAttribute('aria-pressed'), 'false');
});

test('当没有收到同步事件但其他页面已更新数据时应该拒绝旧撤销并保留最新收藏', t => {
  const app = setup(t, { html: markup, initial: JSON.stringify([first]) });
  find(app, '[data-reading-remove]').click();
  app.window.localStorage.setItem(KEY, JSON.stringify([second]));
  find(app, '[data-reading-undo]').click();
  assert.deepEqual(JSON.parse(app.stored()), [second]);
  assert.match(find(app, '[data-reading-status]').textContent, /更新|撤销/);
});

test('当存储写入失败时应该保留原收藏且不能显示保存成功', t => {
  const app = setup(t, { initial: JSON.stringify([second]), writeFails: true });
  toggle(app).click();
  assert.deepEqual(JSON.parse(app.stored()), [second]);
  assert.equal(toggle(app).getAttribute('aria-pressed'), 'false');
  assert.match(find(app, '.reading-action-status').textContent, /未能|失败/);
  app.options.writeFails = false;
  toggle(app).click();
  assert.deepEqual(JSON.parse(app.stored()), [first, second]);
});

test('当浏览器不能读取收藏时应该提供重试而不修改已有数据', t => {
  const app = setup(t, { html: markup, initial: JSON.stringify([first]), readFails: true });
  assert.match(find(app, '[data-reading-status]').textContent, /读取|浏览器/);
  assert.equal(app.writes.length, 0);
  app.options.readFails = false;
  find(app, '[data-reading-retry]').click();
  assert.equal(find(app, '.reading-entry-title').getAttribute('href'), first);
});

test('当收藏数据损坏时应该保留原始数据直到读者明确重置', t => {
  const app = setup(t, { html: markup, initial: '{broken' });
  assert.equal(app.stored(), '{broken');
  assert.equal(find(app, '[data-reading-reset]').hidden, false);
  find(app, '[data-reading-reset]').click();
  assert.deepEqual(JSON.parse(app.stored()), []);
  assert.equal(find(app, '[data-reading-empty]').hidden, false);
});

test('当存储中夹杂不安全路径或文章暂不在目录时应该安全显示且不制造无效链接', t => {
  const app = setup(t, { html: markup, initial: JSON.stringify([first, first, missing, '//evil.example/', 'javascript:alert(1)', '/2026/10/04/%2e%2e/']) });
  assert.equal(app.document.querySelectorAll('[data-reading-entry]').length, 2);
  assert.equal(app.document.querySelectorAll('.reading-entry-title').length, 1);
  assert.ok(app.document.querySelector('[data-reading-entry]').textContent.includes(catalog[0].title));
  assert.ok(app.document.body.textContent.includes(missing));
  assert.equal(app.document.querySelector('a[href^="javascript:"]'), null);
  assert.equal(app.writes.length, 0);
});

test('当收藏列表重新生成时应该继续通过站内切页打开文章而保持音乐播放', t => {
  const app = setup(t, { html: markup, initial: JSON.stringify([first]) });
  assert.equal(find(app, '.reading-entry-title').getAttribute('data-pjax-state'), 'ready');
  app.external([second, first]);
  assert.equal(find(app, '.reading-entry-title').getAttribute('data-pjax-state'), 'ready');
});

test('当存储恢复或其他页面改变收藏时应该清除已经过期的操作提示', t => {
  const app = setup(t, { readFails: true });
  assert.match(find(app, '.reading-action-status').textContent, /读取/);
  app.options.readFails = false;
  app.external([]);
  assert.equal(find(app, '.reading-action-status').textContent, '');
  toggle(app).click();
  assert.match(find(app, '.reading-action-status').textContent, /已保存/);
  app.external([]);
  assert.equal(find(app, '.reading-action-status').textContent, '');
});
