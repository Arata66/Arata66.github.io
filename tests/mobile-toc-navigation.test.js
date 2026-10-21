const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/mobile-rightside.js'), 'utf8');
const markup = '<div id="rightside"><div id="rightside-config-hide"><button id="readmode">阅读</button></div><div id="rightside-config-show"><button id="mobile-toc-button">目录</button></div></div><article id="article-container"><h2 id="章节一">章节一</h2><h2 id="章节二">章节二</h2></article><aside><div id="card-toc"><div class="toc-content"><a class="toc-link active" href="#%E7%AB%A0%E8%8A%82%E4%B8%80">章节一</a><a class="toc-link" href="#%E7%AB%A0%E8%8A%82%E4%BA%8C">章节二</a></div></div></aside>';

function setup(t, mobile = true) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url: 'https://arata66.top/post/' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const changes = [];
  const media = { matches: mobile, addEventListener: (name, listener) => changes.push(listener) };
  Object.defineProperty(window, 'matchMedia', { value: () => media });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 480 });
  const revealed = [];
  const restored = [];
  window.HTMLElement.prototype.scrollIntoView = function (options) { revealed.push({ element: this, options }); };
  window.scrollTo = options => restored.push(options);
  // 主题先处理开关，自定义逻辑只补充流式目录的定位和焦点。
  document.getElementById('rightside').addEventListener('click', event => {
    if (!(event.target instanceof window.Element)) return;
    if (event.target.closest('#mobile-toc-button')) document.getElementById('card-toc').classList.toggle('open');
  });
  window.eval(script);
  return {
    window, document, revealed, restored,
    open() {
      document.getElementById('mobile-rightside-toggle').click();
      document.getElementById('mobile-toc-button').click();
    },
    resize(matches) {
      media.matches = matches;
      changes.forEach(listener => listener());
    }
  };
}

test('当手机目录收起时应该禁止键盘进入隐藏章节并说明展开状态', t => {
  const app = setup(t);
  assert.equal(app.document.querySelector('.toc-content').hasAttribute('inert'), true);
  assert.equal(app.document.getElementById('mobile-toc-button').getAttribute('aria-expanded'), 'false');
});

test('当打开屏幕外的手机目录时应该显示目录并将焦点交给当前章节', t => {
  const app = setup(t);
  app.open();
  assert.equal(app.document.activeElement, app.document.querySelector('.toc-link.active'));
  assert.equal(app.document.querySelector('.toc-content').hasAttribute('inert'), false);
  assert.equal(app.document.getElementById('mobile-toc-button').getAttribute('aria-expanded'), 'true');
  assert.equal(app.revealed.length, 2);
  assert.equal(app.revealed[0].element.id, 'card-toc');
  assert.equal(app.revealed[0].options.block, 'start');
  assert.equal(app.revealed[1].element, app.document.activeElement);
  assert.equal(app.document.getElementById('mobile-rightside-toggle').getAttribute('aria-expanded'), 'false');
});

test('当选择目录章节时应该收起目录并把焦点交给对应正文标题', t => {
  const app = setup(t);
  app.open();
  const link = app.document.querySelectorAll('.toc-link')[1];
  assert.ok(link instanceof app.window.HTMLAnchorElement);
  link.click();
  assert.equal(app.document.getElementById('card-toc').classList.contains('open'), false);
  assert.equal(app.document.querySelector('.toc-content').hasAttribute('inert'), true);
  assert.equal(app.document.activeElement.id, '章节二');
  assert.equal(app.revealed[2]?.element.id, '章节二');
  assert.equal(app.restored.length, 0);
});

test('当再次点击目录工具关闭目录时应该回到原阅读位置和可见工具入口', t => {
  const app = setup(t);
  app.open();
  app.open();
  assert.equal(app.restored.length, 1);
  assert.equal(app.restored[0].top, 480);
  assert.equal(app.document.activeElement.id, 'mobile-rightside-toggle');
});

test('当在目录内按Escape时应该收起目录并返回原阅读位置', t => {
  const app = setup(t);
  app.open();
  app.document.activeElement.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(app.document.getElementById('card-toc').classList.contains('open'), false);
  assert.equal(app.restored[0].top, 480);
  assert.equal(app.document.activeElement.id, 'mobile-rightside-toggle');
});

test('当从手机切换到桌面时应该恢复目录章节的键盘访问', t => {
  const app = setup(t);
  app.resize(false);
  assert.equal(app.document.querySelector('.toc-content').hasAttribute('inert'), false);
  app.resize(true);
  assert.equal(app.document.querySelector('.toc-content').hasAttribute('inert'), true);
});

test('当Pjax替换文章并重复初始化时应该只显示一次新目录且不恢复旧阅读位置', t => {
  const app = setup(t);
  app.open();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  const oldToc = app.document.getElementById('card-toc');
  oldToc.outerHTML = '<div id="card-toc"><div class="toc-content"><a class="toc-link" href="#%E7%AB%A0%E8%8A%82%E4%BA%8C">新目录</a></div></div>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.open();
  const directories = app.revealed.filter(item => item.element.id === 'card-toc');
  assert.equal(directories.length, 2);
  assert.notEqual(directories[1].element, oldToc);
  assert.equal(app.document.activeElement.textContent, '新目录');
  assert.equal(app.restored.length, 0);
});
