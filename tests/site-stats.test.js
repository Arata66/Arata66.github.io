const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../source/js/site-stats.js'), 'utf8');
const footer = '<div id="site-stats"><span class="stats-posts">-</span><span class="stats-days">-</span></div>';

function setup(html = footer, instant = '2026-10-24T16:01:00Z') {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  dom.window.Date.now = () => Date.parse(instant);
  dom.window.__SITE_STATS = { postCount: 6 };
  dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}

test('当访客切页替换页脚时应该重新显示文章数和上海日期的运行天数', () => {
  const dom = setup();
  const document = dom.window.document;
  assert.equal(document.querySelector('.stats-posts').textContent, '6');
  assert.equal(document.querySelector('.stats-days').textContent, '346');
  document.body.innerHTML = footer;
  document.dispatchEvent(new dom.window.Event('pjax:complete'));
  assert.equal(document.querySelector('.stats-posts').textContent, '6');
  assert.equal(document.querySelector('.stats-days').textContent, '346');
  dom.window.close();
});

test('当上海时间跨过零点时应该按本站日期增加一天而非等待UTC零点', () => {
  const dom = setup(footer, '2026-10-24T15:59:00Z');
  assert.equal(dom.window.document.querySelector('.stats-days').textContent, '345');
  dom.window.Date.now = () => Date.parse('2026-10-24T16:01:00Z');
  dom.window.document.dispatchEvent(new dom.window.Event('pjax:complete'));
  assert.equal(dom.window.document.querySelector('.stats-days').textContent, '346');
  dom.window.close();
});

test('当页面没有统计或缺少计数节点时应该安全跳过并在下次切页恢复', () => {
  for (const html of ['', '<div id="site-stats"></div>']) {
    const dom = setup(html);
    delete dom.window.__SITE_STATS;
    dom.window.document.body.innerHTML = footer;
    dom.window.document.dispatchEvent(new dom.window.Event('pjax:complete'));
    assert.equal(dom.window.document.querySelector('.stats-posts').textContent, '-');
    assert.equal(dom.window.document.querySelector('.stats-days').textContent, '346');
    dom.window.close();
  }
});
