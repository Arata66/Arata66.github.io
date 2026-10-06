const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/custom-menu.js'), 'utf8');

function setup(t, fine = true) {
  const dom = new JSDOM('<main><p id="text">一段可以选中复制的正文</p><div id="blank"></div><img src="/test.webp"><video></video><audio></audio><canvas></canvas><input><textarea></textarea><select><option>选项</option></select><button>操作</button><div contenteditable="true"><span>编辑文字</span></div><a href="/other">链接</a><pre><code>代码</code></pre></main>', { url: 'https://example.test/', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: fine }) });
  window.eval(script);
  t.after(() => window.close());
  const document = window.document;
  return {
    window, document,
    menu: () => document.getElementById('custom-context-menu'),
    context(selector) {
      const target = document.querySelector(selector);
      assert.ok(target);
      const event = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 100, clientY: 100 });
      target.dispatchEvent(event);
      return event;
    },
    select() {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('text'));
      window.getSelection().addRange(range);
    }
  };
}

test('当正文已有文字选区时应该保留原生右键和选中内容', t => {
  const app = setup(t);
  app.select();
  assert.equal(app.context('#text').defaultPrevented, false);
  assert.equal(app.window.getSelection().toString(), '一段可以选中复制的正文');
  assert.equal(app.menu(), null);
});

test('当右键图片媒体或编辑控件时应该保留原生操作', t => {
  const app = setup(t);
  for (const selector of ['img', 'video', 'audio', 'canvas', 'input', 'textarea', 'select', 'button', '[contenteditable] span']) {
    assert.equal(app.context(selector).defaultPrevented, false, selector + ' 应保留浏览器菜单');
  }
  assert.equal(app.menu(), null);
});

test('当自定义菜单打开后转到文字选区时应该先收起旧菜单', t => {
  const app = setup(t);
  app.context('#blank'); app.select();
  assert.equal(app.context('#text').defaultPrevented, false);
  assert.equal(app.menu().classList.contains('show'), false);
});

test('当空白处打开自定义菜单并按Escape时应该收起且保留原焦点', t => {
  const app = setup(t);
  const button = app.document.querySelector('button'); button.focus();
  assert.equal(app.context('#blank').defaultPrevented, true);
  assert.equal(app.menu().classList.contains('show'), true);
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(app.menu().classList.contains('show'), false);
  assert.equal(app.document.activeElement, button);
});

test('当已有菜单后右键链接或代码时应该保留原生菜单并收起旧菜单', t => {
  const app = setup(t);
  for (const selector of ['a', 'pre', 'code']) {
    app.context('#blank');
    assert.equal(app.context(selector).defaultPrevented, false);
    assert.equal(app.menu().classList.contains('show'), false);
  }
});

test('当手机使用粗指针时应该保留原生菜单且不创建额外控件', t => {
  const app = setup(t, false);
  assert.equal(app.context('#blank').defaultPrevented, false);
  assert.equal(app.menu(), null);
});

test('当Pjax切页后再次右键时应该只创建一个菜单并继续保留文本复制', t => {
  const app = setup(t);
  app.context('#blank');
  const old = app.menu();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(old.isConnected, false);
  app.context('#blank');
  assert.equal(app.document.querySelectorAll('#custom-context-menu').length, 1);
  app.select();
  assert.equal(app.context('#text').defaultPrevented, false);
  assert.equal(app.menu().classList.contains('show'), false);
});
