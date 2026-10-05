const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/subscription.js'), 'utf8');
const markup = '<section class="subscription-page"><input class="subscription-url" aria-label="订阅地址" readonly value="https://arata66.top/atom.xml"><button class="subscription-copy" hidden>复制订阅地址</button><p class="subscription-feedback" role="status">也可以选中地址手动复制。</p></section>';

function setup(t, writeText) {
  const dom = new JSDOM(markup, { url: 'https://arata66.top/subscribe/', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window.navigator, 'clipboard', { value: writeText ? { writeText } : undefined });
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  const button = window.document.querySelector('button');
  assert.ok(button instanceof window.HTMLButtonElement);
  return { window, document: window.document, button, flush: () => new Promise(resolve => setImmediate(resolve)) };
}

test('当用户复制订阅地址成功时应该反馈成功并保持可以再次操作', async (t) => {
  const copied = [];
  const app = setup(t, async value => { copied.push(value); });
  assert.equal(app.button.hidden, false);
  app.button.click();
  await app.flush();
  assert.deepEqual(copied, ['https://arata66.top/atom.xml']);
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('已复制'));
  assert.equal(app.button.disabled, false);
});

test('当剪贴板拒绝访问时应该提供手动复制且允许再试', async (t) => {
  let reject = true;
  const app = setup(t, async () => { if (reject) throw new Error('拒绝访问'); });
  app.button.click();
  await app.flush();
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('手动复制'));
  const input = app.document.querySelector('input');
  assert.equal(app.document.activeElement, input);
  assert.equal(input.selectionStart, 0);
  assert.equal(input.selectionEnd, input.value.length);
  reject = false;
  app.button.click();
  await app.flush();
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('已复制'));
});

test('当浏览器不支持剪贴板时应该仍然允许手动复制地址', async (t) => {
  const app = setup(t);
  app.button.click();
  await app.flush();
  assert.equal(app.document.activeElement.getAttribute('aria-label'), '订阅地址');
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('手动复制'));
});

test('当 Pjax 重复初始化或返回新订阅页时应该每次点击只复制一次', async (t) => {
  let count = 0;
  const app = setup(t, async () => { count++; });
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.button.click();
  await app.flush();
  assert.equal(count, 1);
  app.document.body.innerHTML = markup;
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  const returned = app.document.querySelector('button');
  assert.ok(returned instanceof app.window.HTMLButtonElement);
  returned.click();
  await app.flush();
  assert.equal(count, 2);
});

test('当复制等待期间离开页面时应该不更新旧页面或抢夺新页面焦点', async (t) => {
  const rejections = [];
  const app = setup(t, () => new Promise((resolve, reject) => { rejections.push(reject); }));
  app.button.click();
  const oldStatus = app.document.querySelector('[role="status"]');
  const before = oldStatus.textContent;
  app.document.body.innerHTML = '<button id="new">新页面入口</button>';
  const newButton = app.document.getElementById('new');
  newButton.focus();
  assert.equal(rejections.length, 1);
  rejections[0](new Error('失败'));
  await app.flush();
  assert.equal(oldStatus.textContent, before);
  assert.equal(app.document.activeElement, newButton);
});
