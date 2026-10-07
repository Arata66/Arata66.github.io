const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

function setup(t, mobile = false) {
  const dom = new JSDOM('<body><div id="rightside" class="rightside-show"><button id="readmode">阅读</button></div><article id="article-container"><p>正文</p></article></body>', { url: 'https://example.test/article/', runScripts: 'outside-only' });
  const { window } = dom; const document = window.document;
  if (mobile) {
    const toggle = document.createElement('button'); toggle.id = 'mobile-rightside-toggle'; document.getElementById('rightside').appendChild(toggle);
  }
  const entry = document.getElementById('readmode');
  entry.addEventListener('click', () => {
    document.body.classList.add('read-mode');
    const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'exit-readmode';
    exit.addEventListener('click', () => { document.body.classList.remove('read-mode'); exit.remove(); });
    document.body.appendChild(exit);
  });
  const source = path.join(__dirname, '../source/js/reading-mode.js');
  window.eval(fs.readFileSync(source, 'utf8'));
  t.after(() => window.close());
  const enter = () => {
    entry.focus(); entry.click();
    const exit = document.querySelector('.exit-readmode');
    assert.ok(exit instanceof window.HTMLButtonElement);
    return exit;
  };
  function escape() {
    const event = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event); return event;
  }
  return { window, document, entry, enter, escape };
}

test('当桌面进入阅读模式时应该获得有名称和说明的退出按钮焦点', t => {
  const app = setup(t); const exit = app.enter();
  assert.equal(exit.getAttribute('aria-label'), '退出阅读模式');
  assert.match(exit.textContent, /退出阅读/);
  assert.equal(app.document.activeElement, exit);
});

test('当在阅读模式按Escape时应该退出并恢复原入口焦点', t => {
  const app = setup(t); app.enter(); const event = app.escape();
  assert.equal(app.document.body.classList.contains('read-mode'), false);
  assert.equal(app.document.querySelector('.exit-readmode'), null);
  assert.equal(app.document.activeElement, app.entry); assert.equal(event.defaultPrevented, true);
});

test('当点击退出按钮时应该恢复桌面阅读入口焦点', t => {
  const app = setup(t); const exit = app.enter(); exit.focus(); exit.click();
  assert.equal(app.document.activeElement, app.entry);
});

test('当手机退出阅读模式时应该回到可见的工具展开入口', t => {
  const app = setup(t, true); const exit = app.enter(); exit.focus(); exit.click();
  assert.equal(app.document.activeElement.id, 'mobile-rightside-toggle');
});

test('当阅读模式中发送Pjax请求时应该清理模式与旧退出按钮且不抢焦点', t => {
  const app = setup(t); app.enter(); const field = app.document.createElement('input'); app.document.body.appendChild(field); field.focus();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.document.body.classList.contains('read-mode'), false);
  assert.equal(app.document.querySelector('.exit-readmode'), null);
  assert.equal(app.document.activeElement, field);
});

test('当Pjax已移除模式但残留退出按钮时应该在完成后清除旧按钮', t => {
  const app = setup(t); app.enter(); app.document.body.classList.remove('read-mode');
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelector('.exit-readmode'), null);
});

test('当重复进出阅读模式时应该只保留一个退出按钮和当前入口', t => {
  const app = setup(t);
  for (let i = 0; i < 3; i++) {
    app.enter(); assert.equal(app.document.querySelectorAll('.exit-readmode').length, 1);
    app.escape(); assert.equal(app.document.activeElement, app.entry);
  }
});

test('当代码全屏或快捷菜单打开时应该让内层界面先处理Escape', t => {
  const app = setup(t); app.enter();
  for (const className of ['code-fullpage', 'show']) {
    const inner = app.document.createElement('div');
    if (className === 'show') inner.id = 'custom-context-menu';
    inner.className = className; app.document.body.appendChild(inner);
    const event = app.escape(); assert.equal(event.defaultPrevented, false);
    assert.equal(app.document.body.classList.contains('read-mode'), true); inner.remove();
  }
});

test('当搜索对话框显示时应该先关闭搜索而保留阅读模式', t => {
  const app = setup(t); app.enter();
  const dialog = app.document.createElement('div'); dialog.setAttribute('role', 'dialog'); app.document.body.appendChild(dialog);
  assert.equal(app.escape().defaultPrevented, false); assert.equal(app.document.body.classList.contains('read-mode'), true);
  dialog.hidden = true;
  app.escape(); assert.equal(app.document.body.classList.contains('read-mode'), false);
});

test('当手机阅读中切到桌面且原工具折叠时应该把退出焦点交给可见设置入口', t => {
  const app = setup(t, true); app.enter();
  app.document.getElementById('mobile-rightside-toggle').remove();
  app.entry.style.opacity = '0';
  const settings = app.document.createElement('button'); settings.id = 'rightside-config';
  app.document.getElementById('rightside').appendChild(settings);
  app.escape(); assert.equal(app.document.activeElement, settings);
});

test('当内层菜单在冒泡阶段关闭时应该让下一次Escape才退出阅读', t => {
  const app = setup(t); app.enter();
  const menu = app.document.createElement('div'); menu.id = 'custom-context-menu'; menu.className = 'show'; app.document.body.appendChild(menu);
  app.document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('show')) { menu.classList.remove('show'); event.preventDefault(); }
  });
  app.escape(); assert.equal(menu.classList.contains('show'), false); assert.equal(app.document.body.classList.contains('read-mode'), true);
  app.escape(); assert.equal(app.document.body.classList.contains('read-mode'), false);
});

test('当搜索对话框祖先已隐藏时应该允许Escape退出阅读', t => {
  const app = setup(t); app.enter();
  const wrapper = app.document.createElement('div'); wrapper.style.display = 'none';
  const dialog = app.document.createElement('div'); dialog.setAttribute('role', 'dialog'); wrapper.appendChild(dialog); app.document.body.appendChild(wrapper);
  app.escape(); assert.equal(app.document.body.classList.contains('read-mode'), false);
});

test('当响应式重排使整组工具隐藏时应该回到文章标题而非隐藏入口', t => {
  const app = setup(t); app.enter();
  app.document.getElementById('rightside').classList.remove('rightside-show');
  app.document.getElementById('rightside').style.opacity = '0.5';
  const info = app.document.createElement('div'); info.id = 'post-info';
  const title = app.document.createElement('h1'); title.textContent = '文章标题'; info.appendChild(title); app.document.body.appendChild(info);
  app.escape(); assert.equal(app.document.activeElement, title); assert.equal(title.tabIndex, -1);
});

test('当已回到页顶但工具尚在隐藏过渡中时应该把焦点放回文章标题', t => {
  const app = setup(t); app.enter();
  const info = app.document.createElement('div'); info.id = 'post-info';
  const title = app.document.createElement('h1'); title.textContent = '文章标题'; info.appendChild(title); app.document.body.appendChild(info);
  app.escape(); assert.equal(app.document.activeElement, title);
});

test('当手机工具可见但桌面滚动标记尚未更新时应该仍返回手机入口', t => {
  const app = setup(t, true); app.enter();
  Object.defineProperty(app.window, 'innerWidth', { value: 390 });
  app.document.getElementById('rightside').classList.remove('rightside-show');
  app.escape(); assert.equal(app.document.activeElement.id, 'mobile-rightside-toggle');
});
