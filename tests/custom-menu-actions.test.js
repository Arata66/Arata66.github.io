const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/custom-menu.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(t, writeText) {
  const dom = new JSDOM('<head><link rel="canonical" href="https://example.test/article/"></head><body><button id="entry">入口</button><h2 id="blank" tabindex="0">正文</h2><div id="rightside"><button id="darkmode">主题</button></div><input id="outside"></body>', { url: 'https://example.test/article/?search=tag#heading', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }) });
  Object.defineProperty(window.navigator, 'clipboard', { value: writeText ? { writeText } : undefined });
  window.eval(script);
  t.after(() => window.close());
  const document = window.document;
  function open(keyboard = false) {
    document.getElementById('blank').dispatchEvent(keyboard
      ? new window.KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true })
      : new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 100, clientY: 100 }));
    return document.getElementById('custom-context-menu');
  }
  function action(name) {
    const item = document.querySelector(`[data-action="${name}"]`);
    assert.ok(item instanceof window.HTMLButtonElement); item.focus(); item.click();
    return item;
  }
  function input() {
    const element = document.querySelector('.ctx-copy-url');
    assert.ok(element instanceof window.HTMLInputElement);
    return element;
  }
  return { window, document, open, action, status: () => document.querySelector('.ctx-feedback'), input };
}

test('当复制成功时应该复制规范地址并保留可见成功反馈', async t => {
  let copied;
  const app = setup(t, async text => { copied = text; });
  const menu = app.open(); app.action('copy'); await tick();
  assert.equal(copied, 'https://example.test/article/');
  assert.equal(menu.classList.contains('show'), true);
  assert.match(app.status().textContent, /已复制/);
});

test('当剪贴板不可用时应该提供可选中的手动复制地址', async t => {
  const app = setup(t); app.open(); app.action('copy'); await tick();
  const input = app.input(); assert.ok(input); assert.equal(input.hidden, false);
  assert.equal(input.value, 'https://example.test/article/');
  assert.equal(app.document.activeElement, input);
  assert.equal(input.selectionEnd - input.selectionStart, input.value.length);
  assert.match(app.status().textContent, /手动复制/);
});

test('当权限拒绝且用户已转到别处时应该显示备用地址但不抢焦点', async t => {
  let reject = (_error) => {};
  const app = setup(t, () => new Promise((_, fail) => { reject = fail; }));
  app.open(); app.action('copy');
  const outside = app.document.getElementById('outside'); outside.focus();
  reject(new Error('拒绝访问')); await tick();
  assert.equal(app.document.activeElement, outside);
  assert.equal(app.input().hidden, false);
});

test('当复制仍在等待时应该阻止重复请求并保留按钮焦点', async t => {
  let resolve = () => {}; let calls = 0;
  const app = setup(t, () => { calls++; return new Promise(done => { resolve = () => done(undefined); }); });
  app.open(); const button = app.action('copy'); app.action('copy');
  assert.equal(calls, 1); assert.equal(app.document.activeElement, button);
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  resolve(); await tick(); assert.equal(button.getAttribute('aria-disabled'), 'false');
});

test('当复制尚未返回就切页时应该忽略旧结果且新菜单可以继续复制', async t => {
  let reject = (_error) => {};
  const app = setup(t, () => new Promise((_, fail) => { reject = fail; }));
  const old = app.open(); app.action('copy');
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  const menu = app.open(); const outside = app.document.getElementById('outside'); outside.focus();
  reject(new Error('拒绝')); await tick();
  assert.equal(old.isConnected, false); assert.equal(app.input().hidden, true);
  assert.equal(menu.classList.contains('show'), true); assert.equal(app.document.activeElement, outside);
  assert.equal(app.document.querySelector('[data-action="copy"]').getAttribute('aria-disabled'), 'false');
});

test('当关闭后重新打开菜单时应该忽略上一轮复制的迟到反馈', async t => {
  let reject = (_error) => {};
  const app = setup(t, () => new Promise((_, fail) => { reject = fail; }));
  app.open(); app.action('copy'); app.window.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  app.open(); reject(new Error('拒绝')); await tick();
  assert.equal(app.input().hidden, true); assert.equal(app.status().textContent, '');
});

test('当从快捷菜单切换主题时应该复用原按钮同步持久化与评论', t => {
  const app = setup(t); let calls = 0;
  app.document.getElementById('darkmode').addEventListener('click', () => {
    calls++; app.document.documentElement.dataset.theme = 'dark';
    app.window.localStorage.setItem('theme', JSON.stringify({ value: 'dark', expiry: Date.now() + 10000 }));
  });
  const menu = app.open(); app.action('theme');
  assert.equal(calls, 1); assert.equal(app.document.documentElement.dataset.theme, 'dark');
  assert.equal(JSON.parse(app.window.localStorage.getItem('theme')).value, 'dark');
  assert.equal(menu.classList.contains('show'), false);
});

test('当用键盘打开菜单时应该能操作按钮并用Escape回到原入口', t => {
  const app = setup(t); const entry = app.document.getElementById('blank'); entry.focus();
  const menu = app.open(true);
  assert.equal(app.document.activeElement, menu.querySelector('button'));
  assert.equal(menu.hasAttribute('inert'), false);
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(app.document.activeElement, entry); assert.equal(menu.hasAttribute('inert'), true);
});

test('当在菜单内部滚动时应该保持打开而页面滚动仍会收起', t => {
  const app = setup(t); const menu = app.open();
  menu.dispatchEvent(new app.window.Event('scroll'));
  assert.equal(menu.classList.contains('show'), true);
  app.document.dispatchEvent(new app.window.Event('scroll'));
  assert.equal(menu.classList.contains('show'), false);
});

test('当选中文字或在编辑控件中按菜单键时应该继续保留原生菜单', t => {
  const app = setup(t);
  const range = app.document.createRange(); range.selectNodeContents(app.document.getElementById('blank')); app.window.getSelection().addRange(range);
  app.open(true); assert.equal(app.document.getElementById('custom-context-menu'), null);
  app.window.getSelection().removeAllRanges();
  const event = new app.window.KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true });
  app.document.getElementById('outside').dispatchEvent(event);
  assert.equal(event.defaultPrevented, false); assert.equal(app.document.getElementById('custom-context-menu'), null);
});
