const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceThemeToc } = require('../scripts/reading-conditions');

const theme = fs.readFileSync(require.resolve('hexo-theme-butterfly/source/js/main.js'), 'utf8');

function setup(t, { mobile = true, isToc = true, visualShift = 0, legacyEnhanced = false } = {}) {
  const headings = Array.from({ length: 20 }, (_, i) => `<h2 id="chapter-${i}">章节${i}</h2>`).join('');
  const links = Array.from({ length: 20 }, (_, i) => `<li><a class="toc-link" href="#chapter-${i}">章节${i}</a></li>`).join('');
  const dom = new JSDOM(`<main id="article-container">${headings}</main><aside id="card-toc"><div class="toc-content is-expand"><ol class="toc">${links}</ol></div></aside>`, { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: mobile }) });
  let position = 1250;
  Object.defineProperty(window, 'scrollY', { get: () => position });
  Object.defineProperty(window, 'GLOBAL_CONFIG_SITE', { value: { isToc } });
  Object.defineProperty(window, 'GLOBAL_CONFIG', { value: { isAnchor: true, percent: { toc: false } } });
  Object.defineProperty(window, 'btf', { value: {
    getEleTop: element => element.offsetTop,
    throttle: callback => callback,
    updateAnchor() {},
    addEventListenerPjax: (target, name, callback, options) => target.addEventListener(name, callback, options)
  } });
  const toc = document.getElementById('card-toc');
  const content = toc.querySelector('.toc-content');
  Object.defineProperty(content, 'clientHeight', { value: 200 });
  [...document.querySelectorAll('h2')].forEach((heading, i) => {
    Object.defineProperty(heading, 'offsetTop', { value: 1000 + i * 100 });
    heading.getBoundingClientRect = () => new window.DOMRect(0, 1000 + i * 100 + visualShift - position, 100, 30);
  });
  [...document.querySelectorAll('.toc-link')].forEach((link, i) => {
    Object.defineProperty(link, 'offsetTop', { value: i * 40 });
    Object.defineProperty(link, 'clientHeight', { value: 40 });
  });
  // 使用主题真实监听，覆盖流式目录滚动与章节高亮之间的联动。
  const input = legacyEnhanced ? theme.replace('    const findHeadPosition = top => {', `    const findHeadPosition = top => {
      // 手机查看流式目录时保留阅读章节，避免目录被滚到最后一项。
      if (isToc && window.matchMedia('(max-width: 900px)').matches && $cardToc.closest('#card-toc').classList.contains('open')) return
`) : theme;
  const enhanced = enhanceThemeToc(input);
  const start = enhanced.indexOf('  const scrollFnToDo = () => {');
  const end = enhanced.indexOf('  const handleThemeChange =', start);
  assert.ok(start >= 0 && end > start);
  window.eval(enhanced.slice(start, end) + '\nscrollFnToDo();');
  return {
    window, document, toc, content,
    async scroll(top) {
      position = top;
      window.dispatchEvent(new window.Event('scroll'));
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
  };
}

test('当手机打开长目录时应该保留原章节高亮和目录内部滚动位置', async t => {
  const app = setup(t);
  await app.scroll(1250);
  const current = app.document.querySelector('.toc-link.active');
  assert.ok(current instanceof app.window.HTMLAnchorElement);
  current.focus();
  const before = app.content.scrollTop;
  app.toc.classList.add('open');
  await app.scroll(4000);
  assert.equal(app.document.querySelector('.toc-link.active'), current);
  assert.equal(app.content.scrollTop, before);
  assert.equal(app.document.activeElement, current);
});

test('当手机关闭目录或桌面正常滚动时应该继续跟踪当前章节', async t => {
  const app = setup(t);
  await app.scroll(1250);
  await app.scroll(4000);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-19');
  const desktop = setup(t, { mobile: false });
  desktop.toc.classList.add('open');
  await desktop.scroll(4000);
  assert.equal(desktop.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-19');
});

test('当手机标题已显示在导航下方但布局坐标较晚时应该立即高亮该章节', async t => {
  const app = setup(t, { visualShift: -30 });
  await app.scroll(1100);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-2');
});

test('当手机上下滚动经过章节边界时应该按实际显示位置切换高亮', async t => {
  const app = setup(t, { visualShift: -30 });
  await app.scroll(1090);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-1');
  await app.scroll(1100);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-2');
  await app.scroll(1090);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-1');
});

test('当桌面标题显示位置存在偏移时应该保留原主题的章节判定', async t => {
  const app = setup(t, { mobile: false, visualShift: -30 });
  await app.scroll(1100);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-1');
});

test('当增量构建保留上一版目录增强时应该仍能修正手机章节高亮', async t => {
  const app = setup(t, { visualShift: -30, legacyEnhanced: true });
  await app.scroll(1100);
  assert.equal(app.document.querySelector('.toc-link.active').getAttribute('href'), '#chapter-2');
});

test('当文章只启用锚点而没有目录时应该仍然正常跟踪滚动', async t => {
  const app = setup(t, { isToc: false });
  app.toc.remove();
  await app.scroll(4000);
});

test('当重复构建或主题目录结构改变时应该避免重复增强或静默遗漏修复', () => {
  const enhanced = enhanceThemeToc(theme);
  assert.equal(enhanceThemeToc(enhanced), enhanced);
  assert.throws(() => enhanceThemeToc('新主题目录结构'), /主题目录结构已改变/);
  assert.throws(() => enhanceThemeToc(theme.replace('top > btf.getEleTop(ele) - 80', '未知章节判定')), /主题章节位置结构已改变/);
});
