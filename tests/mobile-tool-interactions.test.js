const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/mobile-rightside.js'), 'utf8');
const markup = '<button id="outside">正文入口</button><div id="rightside" class="rightside-show"><div id="rightside-config-hide"><button id="readmode" title="阅读模式"><i></i></button><button id="darkmode" title="主题切换"><i></i></button></div><div id="rightside-config-show"><button id="rightside-config">设置</button><button id="mobile-toc-button"><i></i></button><a id="to_comment" href="#comment"><i></i></a><button id="go-up"><i></i></button></div></div>';

function setup(t) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url: 'https://arata66.top/2026/06/29/Coming/' });
  const { window } = dom;
  const changes = [];
  const media = { matches: true, addEventListener: (name, listener) => changes.push(listener) };
  Object.defineProperty(window, 'matchMedia', { value: () => media });
  window.eval(script);
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/reading-mode.js'), 'utf8'));
  t.after(() => window.close());
  const toggle = () => window.document.getElementById('mobile-rightside-toggle');
  return { window, document: window.document, media, changes, toggle };
}

test('当手机初始化工具时应该保留主题设置所依赖的原工具组位置并说明功能', t => {
  const app = setup(t);
  assert.equal(app.document.getElementById('rightside').firstElementChild.id, 'rightside-config-hide');
  assert.equal(app.document.querySelector('#darkmode .mobile-tool-label').textContent, '主题');
  assert.equal(app.toggle().getAttribute('aria-controls'), 'rightside-config-hide rightside-config-show');
});

test('当点击展开和收起时应该同步状态且折叠工具不能获得键盘焦点', t => {
  const app = setup(t);
  assert.equal(app.document.getElementById('rightside-config-hide').hasAttribute('inert'), true);
  app.toggle().click();
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'true');
  assert.equal(app.document.activeElement.id, 'readmode');
  assert.equal(app.document.getElementById('rightside-config-hide').hasAttribute('inert'), false);
  app.toggle().click();
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.activeElement, app.toggle());
});

test('当使用主题工具后应该收起工具并把焦点放回可见入口', t => {
  const app = setup(t);
  app.toggle().click();
  const dark = app.document.getElementById('darkmode');
  dark.focus();
  dark.click();
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.activeElement, app.toggle());
});

test('当进入阅读模式时应该把焦点放到有名称的退出按钮', t => {
  const app = setup(t);
  app.document.getElementById('readmode').addEventListener('click', () => {
    app.document.body.classList.add('read-mode');
    const exit = app.document.createElement('button');
    exit.className = 'exit-readmode';
    exit.addEventListener('click', () => {
      app.document.body.classList.remove('read-mode');
      exit.remove();
    });
    app.document.body.appendChild(exit);
  });
  app.toggle().click();
  app.document.getElementById('readmode').click();
  const exit = app.document.querySelector('.exit-readmode');
  assert.ok(exit instanceof app.window.HTMLButtonElement);
  assert.equal(exit.getAttribute('aria-label'), '退出阅读模式');
  assert.equal(app.document.activeElement, exit);
  exit.click();
  assert.equal(app.document.activeElement, app.toggle());
});

test('当按 Escape 时应该关闭工具并恢复展开入口焦点', t => {
  const app = setup(t);
  app.toggle().click();
  app.document.getElementById('darkmode').focus();
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.activeElement, app.toggle());
});

test('当点正文或滚动阅读时应该收起工具且不抢正文焦点', t => {
  const app = setup(t);
  app.toggle().click();
  const outside = app.document.getElementById('outside');
  outside.focus();
  outside.click();
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.activeElement, outside);
  app.toggle().click();
  app.document.dispatchEvent(new app.window.Event('scroll'));
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'false');
});

test('当返回桌面或再次切回手机时应该恢复主题工具且不重复添加入口', t => {
  const app = setup(t);
  app.media.matches = false;
  app.changes[0]();
  assert.equal(app.toggle(), null);
  assert.equal(app.document.getElementById('rightside-config-hide').hasAttribute('inert'), false);
  app.media.matches = true;
  app.changes[0]();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelectorAll('#mobile-rightside-toggle').length, 1);
  app.toggle().click();
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'true');
});

test('当 Pjax 重新生成工具节点时应该绑定新入口且一次点击只切换一次', t => {
  const app = setup(t);
  app.toggle().click();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'false');
  app.document.body.innerHTML = markup;
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.toggle().click();
  assert.equal(app.toggle().getAttribute('aria-expanded'), 'true');
  assert.equal(app.document.querySelectorAll('#darkmode .mobile-tool-label').length, 1);
});
