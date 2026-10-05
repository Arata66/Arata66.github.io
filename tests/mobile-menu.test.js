const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const css = fs.readFileSync(path.join(__dirname, '../source/css/custom.css'), 'utf8');

test('当手机菜单打开和关闭时应该切换菜单可见性', (t) => {
  const dom = new JSDOM('<div id="sidebar"><div id="sidebar-menus"><a href="/about/">关于</a></div></div>');
  t.after(() => dom.window.close());
  const style = dom.window.document.createElement('style');
  style.textContent = css;
  dom.window.document.head.appendChild(style);
  const menu = dom.window.document.getElementById('sidebar-menus');
  assert.equal(dom.window.getComputedStyle(menu).display, 'none');
  menu.classList.add('open');
  assert.equal(dom.window.getComputedStyle(menu).display, 'block');
  menu.classList.remove('open');
  assert.equal(dom.window.getComputedStyle(menu).display, 'none');
});
