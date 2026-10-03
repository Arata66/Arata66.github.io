const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/mobile-rightside.js'), 'utf8');

function setup(t, mobile = true) {
  const dom = new JSDOM('<div id="rightside"><div id="rightside-config-show"><button id="tool">目录</button></div></div>', {
    runScripts: 'outside-only'
  });
  const mediaEvents = new dom.window.EventTarget();
  const media = Object.assign(mediaEvents, {
    matches: mobile,
    media: '(max-width: 900px)',
    onchange: null,
    addListener(listener) { mediaEvents.addEventListener('change', listener); },
    removeListener(listener) { mediaEvents.removeEventListener('change', listener); }
  });
  dom.window.matchMedia = () => media;
  dom.window.eval(script);
  t.after(() => dom.window.close());
  return {
    window: dom.window,
    document: dom.window.document,
    changeViewport(matches) {
      media.matches = matches;
      media.dispatchEvent(new dom.window.Event('change'));
    }
  };
}

test('当手机首次打开页面时应该折叠工具并提供可访问入口', (t) => {
  const { document } = setup(t);
  const button = document.getElementById('mobile-rightside-toggle');
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.getAttribute('aria-label'), '展开阅读工具');
  assert.ok(document.getElementById('rightside').classList.contains('mobile-tools-collapsed'));
});

test('当用户连续点击箭头时应该展开并再次收起工具', (t) => {
  const { document } = setup(t);
  const button = document.getElementById('mobile-rightside-toggle');
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.getAttribute('aria-label'), '收起阅读工具');
  assert.ok(document.getElementById('rightside').classList.contains('mobile-tools-expanded'));
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('当展开后操作目录工具时应该自动收起', (t) => {
  const { document } = setup(t);
  const button = document.getElementById('mobile-rightside-toggle');
  button.click();
  document.getElementById('tool').click();
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.ok(document.getElementById('rightside').classList.contains('mobile-tools-collapsed'));
});

test('当展开后滚动文章时应该自动收起', (t) => {
  const { document, window } = setup(t);
  const button = document.getElementById('mobile-rightside-toggle');
  button.click();
  document.dispatchEvent(new window.Event('scroll'));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.getAttribute('aria-label'), '展开阅读工具');
});

test('当切换到桌面视口时应该恢复桌面工具', (t) => {
  const { document, changeViewport } = setup(t);
  document.getElementById('mobile-rightside-toggle').click();
  changeViewport(false);
  assert.equal(document.getElementById('mobile-rightside-toggle'), null);
  assert.equal(document.getElementById('rightside').className, '');
  changeViewport(true);
  assert.equal(document.getElementById('mobile-rightside-toggle').getAttribute('aria-expanded'), 'false');
});

test('当 Pjax 重复完成时应该只有一个工具入口且一次点击能展开', (t) => {
  const { document, window } = setup(t);
  document.dispatchEvent(new window.Event('pjax:complete'));
  document.dispatchEvent(new window.Event('pjax:complete'));
  assert.equal(document.querySelectorAll('#mobile-rightside-toggle').length, 1);
  const button = document.getElementById('mobile-rightside-toggle');
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
});

test('当 Pjax 替换工具 DOM 时应该重新创建可操作入口', (t) => {
  const { document, window } = setup(t);
  document.getElementById('rightside').outerHTML = '<div id="rightside"></div>';
  document.dispatchEvent(new window.Event('pjax:complete'));
  const button = document.getElementById('mobile-rightside-toggle');
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
});

test('当桌面页面或没有工具栏的页面加载时应该不创建手机入口', (t) => {
  const { document, window } = setup(t, false);
  assert.equal(document.getElementById('mobile-rightside-toggle'), null);
  document.getElementById('rightside').remove();
  document.dispatchEvent(new window.Event('pjax:complete'));
  assert.equal(document.getElementById('mobile-rightside-toggle'), null);
});
