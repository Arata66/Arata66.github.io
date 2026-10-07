const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { composeSearchScript } = require('../scripts/search-interface');

const theme = fs.readFileSync(path.join(__dirname, '../node_modules/hexo-theme-butterfly/source/js/search/local-search.js'), 'utf8');
const controllerPath = path.join(__dirname, '../source/js/search-interface.js');
const xml = '<search><entry><title>Hexo 样式记录</title><content>博客样式与手机阅读体验</content><url>/2026/10/04/hexo-custom-style-preview/</url></entry><entry><title>听歌报告</title><content>分享生活里的音乐</content><url>/2026/06/29/my-playlist/</url></entry></search>';
const markup = '<div id="body-wrap"><div id="search-button"><span class="search" tabindex="0">搜索</span></div><div id="article-container">正文</div></div><div id="rightside"></div><div id="local-search"><div class="search-dialog" style="display:none"><nav class="search-nav"><span class="search-dialog-title">搜索</span><i id="loading-status" hidden></i><button class="search-close-button">×</button></nav><div id="loading-database">数据加载中</div><div class="local-search-input"><input placeholder="搜索文章"></div><hr><div id="local-search-results"></div><div id="local-search-pagination"><ul class="ais-Pagination-list"></ul></div><div id="local-search-stats"></div></div><div id="search-mask" style="display:none"></div></div>';

function setup(t, fetchData = async () => new Response(xml), restoredQuery = '') {
  const dom = new JSDOM(markup, { url: 'https://arata66.top/about/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = fetchData;
  window.GLOBAL_CONFIG = { localSearch: { path: '/search.xml', top_n_per_article: 1, unescape: false, pagination: { enable: false }, languages: { hits_stats: '${hits} 条结果', hits_empty: '没有找到：${query}' } } };
  Object.defineProperty(window.document, 'readyState', { configurable: true, value: 'interactive' });
  window.document.querySelector('input').value = restoredQuery;
  window.eval(composeSearchScript(theme, fs.existsSync(controllerPath) ? fs.readFileSync(controllerPath, 'utf8') : ''));
  t.after(() => window.close());
  const document = window.document;
  const input = document.querySelector('input');
  const trigger = document.querySelector('.search');
  const dialog = document.querySelector('.search-dialog');
  assert.ok(input instanceof window.HTMLInputElement);
  assert.ok(trigger instanceof window.HTMLElement);
  assert.ok(dialog instanceof window.HTMLElement);
  const button = selector => {
    const element = document.querySelector(selector);
    assert.ok(element instanceof window.HTMLButtonElement);
    return element;
  };
  const query = value => { input.value = value; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
  return { window, document, input, trigger, dialog, query, button, flush: () => new Promise(resolve => setImmediate(resolve)), status: () => document.querySelector('#local-search-stats').textContent };
}

test('当手机隐藏搜索文字时应该仍有明确的入口名称且切页后保持',t=>{
  const app=setup(t);
  assert.equal(app.trigger.getAttribute('aria-label'),'搜索文章');
  app.trigger.innerHTML='<i class="fas fa-search" aria-hidden="true"></i>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.trigger.getAttribute('aria-label'),'搜索文章');
});

test('当页面尚未触发整页加载时应该立即可以打开搜索并输入', (t) => {
  const app = setup(t);
  app.trigger.click();
  assert.equal(app.dialog.style.display, 'block');
  assert.equal(app.dialog.getAttribute('role'), 'dialog');
  assert.equal(app.document.activeElement, app.input);
  assert.equal(app.trigger.getAttribute('aria-expanded'), 'true');
});

test('当索引载入前已经输入时应该在载入后自动显示匹配结果', async (t) => {
  const pending = [];
  const app = setup(t, () => new Promise(resolve => pending.push(resolve)));
  app.trigger.click();
  app.query('Hexo');
  assert.match(app.status(), /加载/);
  pending[0](new Response(xml));
  await app.flush();
  assert.match(app.status(), /1 篇/);
  assert.match(app.document.querySelector('#local-search-results').textContent, /Hexo 样式记录/);
  assert.equal(app.document.querySelector('.search-keyword').textContent, 'Hexo');
});

test('当查询没有匹配时应该提供提示与归档且允许清空重新搜索', async (t) => {
  const app = setup(t);
  app.trigger.click();
  await app.flush();
  app.query('不存在的文章');
  assert.match(app.status(), /没有找到/);
  assert.equal(app.document.querySelector('.search-browse a').getAttribute('href'), '/archives/');
  app.button('.search-clear').click();
  assert.equal(app.input.value, '');
  assert.equal(app.document.activeElement, app.input);
  assert.match(app.status(), /标题或正文/);
});

test('当请求失败时应该允许重试并自动使用仍保留的查询', async (t) => {
  let attempts = 0;
  const app = setup(t, async () => {
    attempts++;
    if (attempts === 1) throw new Error('网络失败');
    return new Response(xml);
  });
  app.trigger.click();
  app.query('音乐');
  await app.flush();
  assert.match(app.status(), /未能加载/);
  const retry = app.button('.search-retry');
  assert.equal(retry.hidden, false);
  retry.click();
  await app.flush();
  assert.match(app.status(), /1 篇/);
  assert.equal(retry.hidden, true);
  assert.match(app.document.querySelector('#local-search-results').textContent, /听歌报告/);
});

test('当索引返回 HTTP 错误或无效 XML 时应该显示失败而非空结果', async (t) => {
  for (const response of [new Response(xml, { status: 503 }), new Response('<html>错误页</html>')]) {
    const app = setup(t, async () => response);
    app.trigger.click();
    await app.flush();
    assert.match(app.status(), /未能加载/);
  }
});

test('当反复打开或切页后打开时应该复用正在进行的索引请求', async (t) => {
  let calls = 0;
  const pending = [];
  const app = setup(t, () => { calls++; return new Promise(resolve => pending.push(resolve)); });
  app.trigger.click();
  app.button('.search-close-button').click();
  app.window.dispatchEvent(new app.window.Event('pjax:complete'));
  app.trigger.click();
  assert.equal(calls, 1);
  pending[0](new Response(xml));
  await app.flush();
  app.query('生活');
  assert.match(app.status(), /1 篇/);
});

test('当用键盘搜索时应该循环焦点并在关闭后恢复触发位置和滚动', async (t) => {
  const app = setup(t);
  app.document.body.style.overflow = 'scroll';
  app.trigger.focus();
  app.trigger.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await app.flush();
  assert.equal(app.document.activeElement, app.input);
  const close = app.button('.search-close-button');
  close.focus();
  close.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(app.document.activeElement, app.document.querySelector('.search-browse a:last-child'));
  app.input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(app.dialog.style.display, 'none');
  assert.equal(app.document.activeElement, app.trigger);
  assert.equal(app.document.body.style.overflow, 'scroll');
  assert.equal(app.trigger.getAttribute('aria-expanded'), 'false');
});

test('当结果切到新页面时应该关闭搜索且不把焦点拉回旧触发器', async (t) => {
  const app = setup(t);
  app.trigger.click();
  await app.flush();
  app.window.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.dialog.style.display, 'none');
  assert.notEqual(app.document.activeElement, app.trigger);
  const background = app.document.querySelector('#body-wrap');
  assert.ok(background instanceof app.window.HTMLElement);
  assert.equal(background.inert, false);
});

test('当查询或索引含 HTML 与危险链接时应该作为文本展示且排除危险链接', async (t) => {
  const unsafe = '<search><entry><title><![CDATA[<img src=x onerror=alert(1)> Hexo]]></title><content>Hexo</content><url>/safe/</url></entry><entry><title>Hexo 危险链接</title><content>Hexo</content><url>javascript:alert(1)</url></entry></search>';
  const app = setup(t, async () => new Response(unsafe));
  app.trigger.click();
  await app.flush();
  app.query('hexo');
  const results = app.document.querySelector('#local-search-results');
  assert.equal(results.querySelector('img'), null);
  assert.equal(results.querySelectorAll('a').length, 1);
  assert.match(results.textContent, /<img/);
  app.query('<img src=x>');
  assert.equal(app.document.querySelector('#local-search-stats img'), null);
});

test('当主题初始化结构改变时应该拒绝静默生成不兼容搜索脚本', () => {
  assert.throws(() => composeSearchScript('class LocalSearch {}', 'controller'), /搜索脚本结构/);
});

test('当重复构建搜索资源时应该保留算法且界面只出现一次', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const built = composeSearchScript(theme, controller);
  assert.equal(composeSearchScript(built, controller), built);
});

test('当主题带有索引加载遮挡样式时应该让结果和操作入口仍可见', async (t) => {
  const app = setup(t);
  const style = app.document.createElement('style');
  style.textContent = '#local-search #loading-database ~ * { visibility: hidden; }';
  app.document.head.appendChild(style);
  app.trigger.click();
  await app.flush();
  app.query('Hexo');
  assert.equal(app.window.getComputedStyle(app.document.querySelector('#local-search-results')).visibility, 'visible');
  assert.equal(app.window.getComputedStyle(app.document.querySelector('.search-browse')).visibility, 'visible');
});

test('当正文含代码与 HTML 实体时应该展示读者可读的摘要', async (t) => {
  const encoded = '<search><entry><title>Hexo 配置</title><content><![CDATA[<p>配置里有 &quot;build&quot; 和 &#125;。</p>]]></content><url>/config/</url></entry></search>';
  const app = setup(t, async () => new Response(encoded));
  app.trigger.click();
  await app.flush();
  app.query('build');
  const text = app.document.querySelector('#local-search-results').textContent;
  assert.match(text, /"build" 和 }/);
  assert.ok(!text.includes('&quot;'));
});

test('当浏览器恢复上次输入时应该先正常初始化再加载对应结果', async (t) => {
  const app = setup(t, async () => new Response(xml), 'Hexo');
  assert.equal(app.input.value, 'Hexo');
  app.trigger.click();
  await app.flush();
  assert.match(app.status(), /1 篇/);
});
