const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { readSiteCard, enhanceCommunity } = require('../scripts/community');

const source = path.join(__dirname, '../source/_data/link.yml');
const html = '<html><head><title>友情链接</title></head><body><div data-community-card></div></body></html>';

test('当关闭脚本访问友链页时应该仍能读取来自既有数据的本站信息', t => {
  const card = readSiteCard(source, 'https://arata66.top');
  const dom = new JSDOM(enhanceCommunity(html, card));
  t.after(() => dom.window.close());
  const document = dom.window.document;
  const textarea = document.querySelector('textarea');
  assert.ok(textarea instanceof dom.window.HTMLTextAreaElement);
  assert.equal(textarea.readOnly, true);
  assert.match(textarea.value, /名称：arata66's Blog/);
  assert.match(textarea.value, /地址：https:\/\/arata66.top\//);
  assert.match(textarea.value, /头像：https:\/\/arata66.top\/img\//);
  assert.match(textarea.value, /简介：Java 学习者/);
  assert.equal(document.querySelector('button').hidden, true);
});

test('当仅修改本站信息并再次构建时应该刷新原容器且安全显示特殊文字', t => {
  const card = readSiteCard(source, 'https://arata66.top');
  const cached = enhanceCommunity(html, card);
  const updated = enhanceCommunity(cached, { ...card, name: '<img src=x onerror=alert(1)>' });
  const dom = new JSDOM(updated);
  t.after(() => dom.window.close());
  assert.equal(dom.window.document.querySelectorAll('textarea').length, 1);
  assert.ok(dom.window.document.querySelector('textarea').value.includes('<img src=x onerror=alert(1)>'));
  assert.equal(dom.window.document.querySelector('img[onerror]'), null);
  assert.equal(enhanceCommunity('<p>普通页面</p>', card), '<p>普通页面</p>');
});

function setup(t, writeText) {
  const dom = new JSDOM(enhanceCommunity(html, readSiteCard(source, 'https://arata66.top')), { url: 'https://arata66.top/link/', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window.navigator, 'clipboard', { value: writeText ? { writeText } : undefined });
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/community.js'), 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  const button = window.document.querySelector('button');
  assert.ok(button instanceof window.HTMLButtonElement);
  return { window, document: window.document, button, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('当复制本站信息成功并经Pjax重复初始化时应该只复制一次并提示成功', async t => {
  const values = [];
  const app = setup(t, async value => { values.push(value); });
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.button.hidden, false);
  app.button.click();
  await app.flush();
  assert.equal(values.length, 1);
  assert.equal(values[0], app.document.querySelector('textarea').value);
  assert.match(app.document.querySelector('[role="status"]').textContent, /已复制/);
  assert.equal(app.button.disabled, false);
});

test('当剪贴板不可用时应该允许手动选择信息并再次复制', async t => {
  const app = setup(t, undefined);
  app.button.click();
  await app.flush();
  const input = app.document.querySelector('textarea');
  assert.equal(app.document.activeElement, input);
  assert.equal(input.selectionEnd, input.value.length);
  assert.match(app.document.querySelector('[role="status"]').textContent, /手动复制/);
  assert.equal(app.button.disabled, false);
});

test('当复制等待期间开始导航时应该忽略迟到失败且不抢新页面焦点', async t => {
  let fail = (_error) => {};
  const app = setup(t, () => new Promise((resolve, reject) => { fail = reject; }));
  app.button.click();
  const input = app.document.createElement('input');
  app.document.body.append(input);
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  input.focus();
  fail(new Error('迟到失败'));
  await app.flush();
  assert.equal(app.document.activeElement, input);
  assert.ok(!app.document.querySelector('[role="status"]').textContent.includes('手动复制'));
});

test('当剪贴板请求持续不返回时应该在超时后允许手动复制', async t => {
  const app = setup(t, () => new Promise(() => {}));
  let expire = () => {};
  app.window.setTimeout = (callback, delay) => {
    if (delay === 3000) expire = () => { if (typeof callback === 'function') callback(); };
    return 1;
  };
  app.button.click();
  expire();
  await app.flush();
  assert.equal(app.button.disabled, false);
  assert.equal(app.document.activeElement, app.document.querySelector('textarea'));
  assert.match(app.document.querySelector('[role="status"]').textContent, /手动复制/);
});
