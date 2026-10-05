const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/works-page.js'), 'utf8');

function setup(t) {
  const dom = new JSDOM('<div class="works-page"><div class="works-filters"></div><div class="works-grid"></div></div>', {
    url: 'https://example.test/works/', runScripts: 'outside-only'
  });
  const { window } = dom;
  window.WORKS_DATA = [
    { name: '博客', desc: '一起搭建', tags: ['Hexo'], link: '/about/', linkText: '关于本站' },
    { name: '追番工具', desc: '学习中', tags: ['Java'], link: '/note/', linkText: '相关记录' },
    { name: '无效入口', desc: '不应跳转', tags: ['Java'], link: 'javascript:alert(1)', linkText: '危险入口' },
    { name: '外站入口', desc: '不应跳转', tags: ['其他'], link: '/\\example.org/', linkText: '外站入口' }
  ];
  window.setTimeout = callback => { if (typeof callback === 'function') callback(); return 1; };
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  return { window, document: window.document };
}

test('当作品含相关入口时应该显示安全链接且保留标签筛选', (t) => {
  const app = setup(t);
  assert.equal(app.document.querySelector('a[href="/about/"]').textContent, '关于本站');
  assert.equal(app.document.querySelector('a[href="/note/"]').textContent, '相关记录');
  assert.equal(app.document.querySelector('a[href^="javascript:"]'), null);
  assert.equal(app.document.querySelectorAll('.works-card-link').length, 2);
  const filter = app.document.querySelector('[data-tag="Java"]');
  assert.ok(filter instanceof app.window.HTMLButtonElement);
  filter.click();
  assert.equal(app.document.querySelectorAll('.works-card:not(.hidden)').length, 2);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.ok(app.document.querySelector('[data-tag="Java"]').classList.contains('active'));
  assert.equal(app.document.querySelectorAll('.works-card:not(.hidden)').length, 2);
});
