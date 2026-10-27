const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceSiteNavigation } = require('../scripts/site-navigation');

const script = fs.readFileSync(path.join(__dirname, '../source/js/site-navigation.js'), 'utf8');
const header = '<nav id="nav"><div class="menus_items"><a href="/">首页</a></div><div id="toggle-menu"><span class="site-page"><i class="fas fa-bars"></i></span></div></nav>';
const markup = `<!doctype html><html><body><div id="sidebar"><div id="menu-mask"></div><div id="sidebar-menus"><a id="stats" href="/archives/">文章数</a><div class="menus_items"><a id="first" href="/">首页</a><details data-site-menu><summary id="group">文章</summary><a id="child" href="/archives/">归档</a></details><a id="last" href="/about/">关于</a></div></div></div><div id="body-wrap">${header}<button id="outside">正文操作</button></div><div id="rightside" inert><button>阅读工具</button></div></body></html>`;
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t) {
  const dom = new JSDOM(enhanceSiteNavigation(markup), { url: 'https://arata66.top/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  // 只替代无布局环境；折叠分组与隐藏控件仍按用户可见性筛选。
  Object.defineProperty(window.HTMLElement.prototype, 'getClientRects', { value() {
    const details = this.closest('details');
    return this.hidden || (details && !details.open && this.tagName !== 'SUMMARY') ? [] : [{}];
  } });
  let closes = 0;
  function bindTrigger() {
    document.getElementById('toggle-menu').addEventListener('click', () => {
      document.getElementById('sidebar-menus').classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }
  bindTrigger();
  document.getElementById('menu-mask').addEventListener('click', () => {
    closes++;
    document.getElementById('sidebar-menus').classList.remove('open');
    document.body.style.overflow = '';
  });
  window.eval(script);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  return { window, document, bindTrigger, get closes() { return closes; } };
}

function node(app, id) {
  const result = app.document.getElementById(id);
  assert.ok(result instanceof app.window.HTMLElement);
  return result;
}

function key(app, id, value, options = {}) {
  const event = new app.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
  node(app, id).focus();
  node(app, id).dispatchEvent(event);
  return event;
}

async function open(app) {
  node(app, 'toggle-menu').focus();
  node(app, 'toggle-menu').click();
  await flush();
}

test('当构建手机导航入口时应该提供有名称和控制关系的原生按钮且重复构建不重复', () => {
  const html = enhanceSiteNavigation(markup);
  const dom = new JSDOM(html);
  const trigger = dom.window.document.getElementById('toggle-menu');
  assert.equal(trigger.tagName, 'BUTTON');
  assert.equal(trigger.getAttribute('type'), 'button');
  assert.equal(trigger.getAttribute('aria-label'), '打开站点导航');
  assert.equal(trigger.getAttribute('aria-controls'), 'sidebar-menus');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.ok(trigger.querySelector('i'));
  assert.equal(enhanceSiteNavigation(html), html);
  dom.window.close();
});

test('当打开手机菜单时应该接续主导航并隔离页面且重复同步不抢焦点', async t => {
  const app = setup(t);
  await open(app);
  assert.equal(app.document.activeElement, node(app, 'first'));
  assert.equal(node(app, 'toggle-menu').getAttribute('aria-expanded'), 'true');
  assert.equal(node(app, 'sidebar-menus').getAttribute('aria-modal'), 'true');
  assert.equal(node(app, 'body-wrap').hasAttribute('inert'), true);
  node(app, 'last').focus();
  node(app, 'sidebar-menus').classList.add('other');
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  await flush();
  assert.equal(app.document.activeElement, node(app, 'last'));
});

test('当在菜单首尾按Tab时应该在可见控件间循环且跳过折叠分组内容', async t => {
  const app = setup(t);
  await open(app);
  node(app, 'last').focus();
  assert.equal(key(app, 'last', 'Tab').defaultPrevented, true);
  assert.equal(app.document.activeElement, node(app, 'stats'));
  assert.equal(key(app, 'stats', 'Tab', { shiftKey: true }).defaultPrevented, true);
  assert.equal(app.document.activeElement, node(app, 'last'));
  assert.equal(key(app, 'group', 'Tab').defaultPrevented, false);
  assert.equal(key(app, 'last', 'Tab', { ctrlKey: true }).defaultPrevented, false);
});

test('当菜单内按Escape时应该委托原遮罩关闭并恢复滚动与入口焦点', async t => {
  const app = setup(t);
  await open(app);
  key(app, 'first', 'Escape');
  await flush();
  assert.equal(app.closes, 1);
  assert.equal(node(app, 'sidebar-menus').classList.contains('open'), false);
  assert.equal(app.document.body.style.overflow, '');
  assert.equal(app.document.activeElement, node(app, 'toggle-menu'));
  assert.equal(node(app, 'toggle-menu').getAttribute('aria-expanded'), 'false');
  assert.equal(node(app, 'body-wrap').hasAttribute('inert'), false);
  assert.equal(node(app, 'rightside').hasAttribute('inert'), true);
});

test('当焦点位于展开分组时应该先收分组再按Escape退出整个菜单', async t => {
  const app = setup(t);
  await open(app);
  const group = node(app, 'group').closest('details');
  group.open = true;
  node(app, 'child').focus();
  key(app, 'child', 'Escape');
  assert.equal(group.open, false);
  assert.equal(app.document.activeElement, node(app, 'group'));
  assert.equal(node(app, 'sidebar-menus').classList.contains('open'), true);
  assert.equal(app.closes, 0);
  key(app, 'group', 'Escape');
  await flush();
  assert.equal(app.closes, 1);
  assert.equal(app.document.activeElement, node(app, 'toggle-menu'));
});

test('当点击遮罩或主题在窗口变化时收起菜单时应该恢复原交互状态', async t => {
  for (const close of [app => node(app, 'menu-mask').click(), app => node(app, 'sidebar-menus').classList.remove('open')]) {
    const app = setup(t);
    await open(app);
    close(app);
    await flush();
    assert.equal(node(app, 'body-wrap').hasAttribute('inert'), false);
    assert.equal(node(app, 'rightside').hasAttribute('inert'), true);
    assert.equal(node(app, 'toggle-menu').getAttribute('aria-expanded'), 'false');
  }
});

test('当菜单开始切页时应该释放旧页面且新入口就绪后可以重新使用', async t => {
  const app = setup(t);
  await open(app);
  const oldTrigger = node(app, 'toggle-menu');
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  await flush();
  assert.equal(node(app, 'sidebar-menus').classList.contains('open'), false);
  assert.equal(node(app, 'body-wrap').hasAttribute('inert'), false);
  assert.notEqual(app.document.activeElement, oldTrigger);
  const rebuilt = new app.window.DOMParser().parseFromString(enhanceSiteNavigation(header), 'text/html');
  node(app, 'body-wrap').innerHTML = rebuilt.body.innerHTML;
  app.bindTrigger();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  await open(app);
  assert.equal(app.document.activeElement, node(app, 'first'));
  key(app, 'first', 'Escape');
  await flush();
  assert.equal(app.document.activeElement, node(app, 'toggle-menu'));
  assert.equal(app.closes, 2);
});

test('当鼠标按下遮罩先失去菜单焦点时应该在关闭后仍回到入口', async t => {
  const app = setup(t);
  await open(app);
  node(app, 'menu-mask').dispatchEvent(new app.window.MouseEvent('pointerdown', { bubbles: true }));
  node(app, 'first').blur();
  assert.equal(app.document.activeElement, app.document.body);
  node(app, 'menu-mask').click();
  await flush();
  assert.equal(app.document.activeElement, node(app, 'toggle-menu'));
  assert.equal(node(app, 'body-wrap').hasAttribute('inert'), false);
});

test('当输入法或内部操作已处理Escape时应该保留当前菜单', async t => {
  const app = setup(t);
  await open(app);
  key(app, 'first', 'Escape', { isComposing: true });
  key(app, 'first', 'Escape', { keyCode: 229 });
  node(app, 'first').addEventListener('keydown', event => event.preventDefault());
  key(app, 'first', 'Escape');
  assert.equal(node(app, 'sidebar-menus').classList.contains('open'), true);
});

test('当菜单快速重开后旧动画清理遮罩样式时应该保留可点击遮罩', async t => {
  const app = setup(t);
  const style = app.document.createElement('style');
  style.textContent = '#sidebar #menu-mask { display: none; }\n' + fs.readFileSync(path.join(__dirname, '../source/css/navigation-polish.css'), 'utf8');
  app.document.head.append(style);
  await open(app);
  key(app, 'first', 'Escape');
  await flush();
  await open(app);
  const mask = node(app, 'menu-mask');
  mask.style.display = 'block';
  // 旧关闭动画的迟到回调不能隐藏这一轮展开所需的遮罩。
  mask.style.display = '';
  mask.style.animation = '';
  assert.equal(app.window.getComputedStyle(mask).display, 'block');
  key(app, 'first', 'Escape');
  await flush();
  assert.equal(app.window.getComputedStyle(mask).display, 'none');
});
