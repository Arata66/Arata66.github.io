const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const theme = fs.readFileSync(require.resolve('hexo-theme-butterfly/source/js/main.js'), 'utf8');
const themeTools = theme.slice(theme.indexOf('  const addHighlightTool ='), theme.indexOf('  const addPhotoFigcaption ='));
const code = '<figure class="highlight bash"><table><tbody><tr><td class="gutter"><pre>1<br>2</pre></td><td class="code"><pre><span class="line">npm run build</span><br><span class="line">  echo &quot;&lt;完成&gt;&quot;</span><br><span class="line"></span><br></pre></td></tr></tbody></table></figure>';

async function setup(t, writeText) {
  const dom = new JSDOM('<div id="article-container">' + code + '</div>', { url: 'https://arata66.top/example/', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window.navigator, 'clipboard', { value: writeText ? { writeText } : undefined });
  window.eval('var GLOBAL_CONFIG = { highlight: { highlightCopy: true, highlightLang: true, highlightFullpage: true, highlightMacStyle: true, plugin: "highlight.js" }, copy: { success: "已复制", noSupport: "失败" } }; var GLOBAL_CONFIG_SITE = { isHighlightShrink: false }; var btf = { addEventListenerPjax: (element, name, listener) => element.addEventListener(name, listener) };');
  // 使用当前主题真实委托，验证替换元素仍能展开和全屏。
  const initTheme = () => window.eval(themeTools + '\naddHighlightTool();');
  initTheme();
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/code-reading.js'), 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  t.after(() => window.close());
  const button = window.document.querySelector('.code-copy');
  assert.ok(button instanceof window.HTMLButtonElement);
  return { window, document: window.document, button, flush, initTheme };
}

test('当代码默认展开时应该可键盘访问工具和横向滚动区域', async t => {
  const app = await setup(t);
  const expand = app.document.querySelector('.expand');
  assert.ok(expand instanceof app.window.HTMLButtonElement);
  assert.equal(expand.getAttribute('aria-expanded'), 'true');
  assert.equal(expand.getAttribute('aria-label'), '收起代码');
  const region = app.document.querySelector('figure table');
  assert.equal(region.getAttribute('tabindex'), '0');
  assert.match(region.getAttribute('aria-label'), /BASH/);
  expand.click();
  assert.equal(expand.getAttribute('aria-expanded'), 'false');
  assert.equal(expand.getAttribute('aria-label'), '展开代码');
  assert.ok(app.document.querySelector('.highlight-tools').classList.contains('closed'));
  expand.click();
  assert.equal(expand.getAttribute('aria-expanded'), 'true');
});

test('当复制代码时应该保留换行缩进空行和实体且不包含行号', async t => {
  const copied = [];
  const app = await setup(t, async text => { copied.push(text); });
  app.button.click();
  await app.flush();
  assert.deepEqual(copied, ['npm run build\n  echo "<完成>"\n']);
  assert.match(app.document.querySelector('.code-copy-status').textContent, /已复制/);
  assert.equal(app.button.disabled, false);
});

test('当复制被拒绝且代码已收起时应该展开备用文本供手动复制并支持重试', async t => {
  let denied = true;
  const app = await setup(t, async () => { if (denied) throw new Error('拒绝'); });
  const expand = app.document.querySelector('.expand');
  assert.ok(expand instanceof app.window.HTMLButtonElement);
  expand.click();
  app.button.click();
  await app.flush();
  const fallback = app.document.querySelector('.code-copy-fallback');
  assert.ok(fallback instanceof app.window.HTMLTextAreaElement);
  assert.equal(fallback.hidden, false);
  assert.equal(fallback.readOnly, true);
  assert.equal(fallback.value, 'npm run build\n  echo "<完成>"\n');
  assert.equal(app.document.activeElement, fallback);
  assert.equal(fallback.selectionEnd, fallback.value.length);
  assert.equal(app.document.querySelector('.expand').getAttribute('aria-expanded'), 'true');
  denied = false;
  app.button.click();
  await app.flush();
  assert.equal(fallback.hidden, true);
  assert.notEqual(app.document.activeElement, fallback);
});

test('当没有剪贴板API时应该提供手动复制而不抛出错误', async t => {
  const app = await setup(t);
  app.button.click();
  await app.flush();
  const fallback = app.document.querySelector('.code-copy-fallback');
  assert.ok(fallback instanceof app.window.HTMLTextAreaElement);
  assert.equal(fallback.hidden, false);
  assert.match(app.document.querySelector('.code-copy-status').textContent, /手动复制/);
});

test('当重复初始化并切换正文时应该只复制当前代码一次', async t => {
  const copied = [];
  const app = await setup(t, async text => { copied.push(text); });
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  await app.flush();
  assert.equal(app.document.querySelectorAll('.code-copy').length, 1);
  app.button.click();
  await app.flush();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.querySelector('#article-container').innerHTML = code.replace('npm run build', 'npm run server');
  app.initTheme();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  await app.flush();
  const nextCopy = app.document.querySelector('.code-copy');
  assert.ok(nextCopy instanceof app.window.HTMLButtonElement);
  nextCopy.click();
  await app.flush();
  assert.deepEqual(copied, ['npm run build\n  echo "<完成>"\n', 'npm run server\n  echo "<完成>"\n']);
});

test('当复制等待结果期间离开正文时应该不抢夺新页面焦点', async t => {
  const pending = [];
  const app = await setup(t, () => new Promise((resolve, reject) => { pending.push(reject); }));
  app.button.click();
  const status = app.document.querySelector('.code-copy-status');
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.body.innerHTML = '<button id="next">下一页</button>';
  app.document.getElementById('next').focus();
  pending[0](new Error('拒绝'));
  await app.flush();
  assert.equal(app.document.activeElement.id, 'next');
  assert.equal(status.textContent, '正在复制…');
});

test('当进入代码全屏后按Escape或切页时应该退出并恢复页面滚动', async t => {
  const app = await setup(t);
  const fullpage = app.document.querySelector('.fullpage-button');
  assert.ok(fullpage instanceof app.window.HTMLButtonElement);
  fullpage.click();
  assert.equal(fullpage.getAttribute('aria-pressed'), 'true');
  assert.equal(app.document.body.style.overflow, 'hidden');
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(fullpage.getAttribute('aria-pressed'), 'false');
  assert.equal(app.document.body.style.overflow, '');
  assert.equal(app.document.activeElement, fullpage);
  fullpage.click();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.document.body.style.overflow, '');
  assert.equal(app.document.querySelector('.code-fullpage'), null);
});

test('当等待复制拒绝时已转去同页输入框应该显示备用代码并保留当前焦点', async t => {
  const pending = [];
  const app = await setup(t, () => new Promise((resolve, reject) => { pending.push(reject); }));
  app.button.focus();
  app.button.click();
  const comment = app.document.createElement('textarea');
  app.document.body.append(comment);
  comment.focus();
  comment.value = '正在输入评论';
  pending[0](new Error('拒绝'));
  await app.flush();
  assert.equal(app.document.activeElement, comment);
  assert.equal(comment.value, '正在输入评论');
  const fallback = app.document.querySelector('.code-copy-fallback');
  assert.ok(fallback instanceof app.window.HTMLTextAreaElement);
  assert.equal(fallback.hidden, false);
});

test('当浏览器因按钮禁用而失焦到正文时应该仍选中备用代码', async t => {
  const pending = [];
  const app = await setup(t, () => new Promise((resolve, reject) => { pending.push(reject); }));
  app.button.focus();
  app.button.click();
  app.button.blur();
  pending[0](new Error('拒绝'));
  await app.flush();
  const fallback = app.document.querySelector('.code-copy-fallback');
  assert.ok(fallback instanceof app.window.HTMLTextAreaElement);
  assert.equal(app.document.activeElement, fallback);
  assert.equal(fallback.selectionStart, 0);
  assert.equal(fallback.selectionEnd, fallback.value.length);
});
