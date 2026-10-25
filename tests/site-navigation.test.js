const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { enhanceSiteNavigation } = require('../scripts/site-navigation');

function page(pathname = '/tags/Hexo/', post = false) {
  const items = '<div class="menus_items"><div class="menus_item"><a class="site-page" href="/">首页</a></div><div class="menus_item"><span class="site-page group hide"><i></i><span>文章</span><i></i></span><ul class="menus_item_child"><li><a href="/archives/">全部文章</a></li><li><a href="/categories/">分类</a></li><li><a href="/tags/">标签</a></li></ul></div></div>';
  return `<!doctype html><html><head><link rel="canonical" href="https://arata66.top${pathname}"></head><body><nav id="nav">${items}</nav><aside id="sidebar-menus">${items}</aside>${post ? '<main id="post"></main>' : ''}<p id="outside">正文</p></body></html>`;
}

test('当导航归类后应该保留所有普通链接并使用原生键盘可操作的折叠分组', () => {
  const dom = new JSDOM(enhanceSiteNavigation(page()));
  const document = dom.window.document;
  assert.equal(document.querySelectorAll('details[data-site-menu] > summary').length, 2);
  assert.equal(document.querySelectorAll('a').length, 8);
  assert.equal(document.querySelector('details').open, false);
  assert.equal(document.querySelector('summary').textContent, '文章');
  assert.equal(document.querySelector('#nav a[href="/tags/"]').getAttribute('aria-current'), 'location');
  assert.equal(document.querySelector('#nav summary').hasAttribute('data-current'), true);
  assert.equal(document.querySelector('#nav a[href="/"]').hasAttribute('aria-current'), false);
  dom.window.close();
});

test('当进入首页或具体文章时应该准确显示所属入口且重复构建保持一致', () => {
  for (const { pathname, post } of [{ pathname: '/', post: false }, { pathname: '/2026/10/04/note/', post: true }]) {
    const once = enhanceSiteNavigation(page(pathname, post));
    assert.equal(enhanceSiteNavigation(once), once);
    const dom = new JSDOM(once);
    assert.equal(dom.window.document.querySelector('#nav a[href="/"]').getAttribute('aria-current'), post ? null : 'page');
    assert.equal(dom.window.document.querySelector('#nav summary').hasAttribute('data-current'), post);
    dom.window.close();
  }
});

test('当访客按Escape时应该关闭展开分组并回焦分组标题', () => {
  const dom = new JSDOM(enhanceSiteNavigation(page()), { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../source/js/site-navigation.js'), 'utf8'));
  const details = dom.window.document.querySelector('details');
  details.open = true;
  const link = details.querySelector('a');
  link.focus();
  link.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(details.open, false);
  assert.equal(dom.window.document.activeElement, details.querySelector('summary'));
  dom.window.close();
});

test('当访客点分组内部或正文及切页时应该分别保持展开或收起旧分组', () => {
  const dom = new JSDOM(enhanceSiteNavigation(page()), { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../source/js/site-navigation.js'), 'utf8'));
  const document = dom.window.document;
  const details = document.querySelector('details');
  details.open = true;
  details.querySelector('ul').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(details.open, true);
  document.querySelector('#outside').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(details.open, false);
  details.open = true;
  document.dispatchEvent(new dom.window.Event('pjax:send'));
  assert.equal(details.open, false);
  document.querySelector('#nav').innerHTML = '<details data-site-menu open><summary>新分组</summary><a href="/">首页</a></details>';
  document.querySelector('#outside').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(document.querySelector('#nav').querySelector('details').open, false);
  dom.window.close();
});

test('当Pjax只替换顶部导航时应该同步保留的手机侧栏当前页标记', () => {
  const dom = new JSDOM(enhanceSiteNavigation(page('/')), { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../source/js/site-navigation.js'), 'utf8'));
  const document = dom.window.document;
  const next = new JSDOM(enhanceSiteNavigation(page('/tags/Hexo/')));
  document.querySelector('#nav').innerHTML = next.window.document.querySelector('#nav').innerHTML;
  document.dispatchEvent(new dom.window.Event('pjax:complete'));
  assert.equal(document.querySelector('#sidebar-menus a[href="/"]').hasAttribute('aria-current'), false);
  assert.equal(document.querySelector('#sidebar-menus a[href="/tags/"]').getAttribute('aria-current'), 'location');
  assert.equal(document.querySelector('#sidebar-menus summary').hasAttribute('data-current'), true);
  next.window.close();
  dom.window.close();
});
