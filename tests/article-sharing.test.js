const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const articleUrl = 'https://arata66.top/2026/06/29/Coming/';
const markup = '<!doctype html><html><head><link rel="canonical" href="' + articleUrl + '"></head><body><article id="post"><div class="post-copyright"><div class="post-copyright__type"><span class="post-copyright-info"><a href="' + articleUrl + '">' + articleUrl + '</a></span></div></div></article></body></html>';

function enhance(html) {
  return require('../scripts/article-sharing').enhanceArticleSharing(html);
}

function setup(t, writeText) {
  const dom = new JSDOM(enhance(markup), { url: articleUrl + '?highlight=Hexo#目标', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window.navigator, 'clipboard', { value: writeText ? { writeText } : undefined });
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/article-sharing.js'), 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  const button = window.document.querySelector('.article-copy');
  assert.ok(button instanceof window.HTMLButtonElement);
  return { window, document: window.document, button, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('当构建文章分享入口时应该保留原链接且重复构建不产生重复按钮', () => {
  const once = enhance(markup);
  const twice = enhance(once);
  assert.equal(twice, once);
  const dom = new JSDOM(twice);
  assert.equal(dom.window.document.querySelectorAll('.article-copy').length, 1);
  assert.equal(dom.window.document.querySelector('.post-copyright-info a').getAttribute('href'), articleUrl);
  assert.equal(dom.window.document.querySelector('.article-copy').hasAttribute('hidden'), true);
  dom.window.close();
});

test('当普通页面没有文章版权区时应该不添加文章分享入口', () => {
  const html = '<html><head></head><body><div id="page">关于本站</div></body></html>';
  assert.equal(enhance(html), html);
});

test('当生成社交分享时应该使用当前文章的固定地址和完整封面地址', () => {
  const image = 'https://arata66.top/img/cover.webp';
  const html = markup.replace('</head>', '<meta property="og:image" content="' + image + '"><meta property="og:title" content="久违的更新"><meta property="og:description" content="重新拾起博客"></head>').replace('</article>', '<div class="social-share" data-image="/img/cover.webp"></div></article>');
  const dom = new JSDOM(enhance(html));
  const share = dom.window.document.querySelector('.social-share');
  assert.equal(share.getAttribute('data-url'), articleUrl);
  assert.equal(share.getAttribute('data-image'), image);
  assert.equal(share.getAttribute('data-title'), '久违的更新');
  assert.equal(share.getAttribute('data-description'), '重新拾起博客');
  dom.window.close();
});

test('当复制带搜索参数的文章时应该只复制文章的固定地址并反馈成功', async t => {
  const copied = [];
  const app = setup(t, async value => { copied.push(value); });
  assert.equal(app.button.hidden, false);
  app.button.click();
  await app.flush();
  assert.deepEqual(copied, [articleUrl]);
  assert.match(app.document.querySelector('.article-copy-feedback').textContent, /已复制/);
  assert.equal(app.button.disabled, false);
});

test('当复制被拒绝时应该展开选中的地址并允许再次尝试', async t => {
  let denied = true;
  const app = setup(t, async () => { if (denied) throw new Error('拒绝'); });
  app.button.click();
  await app.flush();
  const input = app.document.querySelector('.article-copy-url');
  assert.ok(input instanceof app.window.HTMLInputElement);
  assert.equal(input.hidden, false);
  assert.equal(app.document.activeElement, input);
  assert.equal(input.selectionEnd, input.value.length);
  assert.match(app.document.querySelector('.article-copy-feedback').textContent, /手动复制/);
  denied = false;
  app.button.click();
  await app.flush();
  assert.match(app.document.querySelector('.article-copy-feedback').textContent, /已复制/);
});

test('当浏览器没有剪贴板 API 时应该仍可手动复制文章地址', async t => {
  const app = setup(t);
  app.button.click();
  await app.flush();
  assert.equal(app.document.querySelector('.article-copy-url').hasAttribute('hidden'), false);
  assert.match(app.document.querySelector('.article-copy-feedback').textContent, /手动复制/);
});

test('当重复初始化并 Pjax 切换文章时应该每次只复制当前文章一次', async t => {
  const copied = [];
  const app = setup(t, async value => { copied.push(value); });
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.button.click();
  await app.flush();
  const next = 'https://arata66.top/2026/06/29/otakulog/';
  // 故意保留旧 head，复制目标也须跟随当前正文。
  const nextDom = new JSDOM(enhance(markup.replaceAll(articleUrl, next)));
  app.document.body.innerHTML = nextDom.window.document.body.innerHTML;
  nextDom.window.close();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  const button = app.document.querySelector('.article-copy');
  assert.ok(button instanceof app.window.HTMLButtonElement);
  button.click();
  await app.flush();
  assert.deepEqual(copied, [articleUrl, next]);
});

test('当等待复制结果时离开文章应该不抢新页面焦点或修改旧反馈', async t => {
  const pending = [];
  const app = setup(t, () => new Promise((resolve, reject) => { pending.push(reject); }));
  app.button.click();
  assert.equal(app.button.disabled, true);
  const oldStatus = app.document.querySelector('.article-copy-feedback');
  app.document.body.innerHTML = '<button id="next">新页面</button>';
  app.document.getElementById('next').focus();
  pending[0](new Error('拒绝'));
  await app.flush();
  assert.equal(app.document.activeElement.id, 'next');
  assert.equal(oldStatus.textContent, '正在复制…');
});
