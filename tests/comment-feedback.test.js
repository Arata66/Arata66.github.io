const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const file = path.join(__dirname, '../source/js/comment-feedback.js');
const script = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t, options = {}) {
  const dom = new JSDOM('<div id="giscus-wrap"></div>', { url: 'https://example.test/article/', runScripts: 'outside-only' });
  const { window } = dom;
  const timers = new Map();
  let timerId = 0;
  window.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  window.clearTimeout = id => { timers.delete(id); };
  window.eval(script);
  const document = window.document;
  function client() {
    const element = document.createElement('script');
    element.src = 'https://giscus.app/client.js';
    element.setAttribute('data-repo', 'Arata66/Arata66.github.io');
    element.setAttribute('data-mapping', 'pathname');
    element.setAttribute('crossorigin', 'anonymous');
    element.async = true;
    document.getElementById('giscus-wrap').appendChild(element);
    return element;
  }
  if (options.earlyError) client().dispatchEvent(new window.Event('error'));
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  return {
    window, document, timers, client,
    panel() { const element = document.querySelector('.comment-feedback'); return element instanceof window.HTMLElement ? element : null; },
    retry() { const element = document.querySelector('.comment-retry'); return element instanceof window.HTMLButtonElement ? element : null; },
    timeout() { for (const [id, timer] of [...timers]) { if (timer.delay === 15000) { timers.delete(id); timer.callback(); } } },
    frame() {
      const element = document.createElement('iframe');
      element.src = 'https://giscus.app/zh-CN/widget?term=article';
      document.getElementById('giscus-wrap').appendChild(element);
      return element;
    },
    message(frame, data = JSON.parse('{"giscus":{"resizeHeight":300}}'), origin = 'https://giscus.app', source = frame.contentWindow) {
      window.dispatchEvent(new window.MessageEvent('message', { origin, source, data }));
    }
  };
}

test('当评论尚未进入视口时应该保留懒加载且没有额外请求', (t) => {
  const app = setup(t);
  assert.ok(app.panel(), '应有等待说明');
  assert.equal(app.document.querySelectorAll('script[src], iframe').length, 0);
  assert.equal(app.retry().hidden, true);
  assert.equal(app.timers.size, 0);
});

test('当脚本下载完成或iframe出现时应该继续等待真实显示消息', async (t) => {
  const app = setup(t);
  const client = app.client();
  await flush();
  client.dispatchEvent(new app.window.Event('load'));
  const frame = app.frame();
  frame.dispatchEvent(new app.window.Event('load'));
  await flush();
  assert.match(app.panel().textContent, /正在加载评论/);
  assert.equal(app.panel().hidden, false);
  assert.equal(frame.title, '评论区');
});

test('当消息来源伪造或高度无效时应该继续等待当前评论iframe', async (t) => {
  const app = setup(t);
  app.client(); const frame = app.frame();
  await flush();
  app.message(frame, undefined, 'https://other.test');
  app.message(frame, undefined, undefined, app.window);
  for (const height of [0, -1, '300', Infinity]) app.message(frame, { giscus: { resizeHeight: height } });
  app.message(frame, null);
  assert.equal(app.panel().hidden, false);
  app.message(frame);
  assert.equal(app.panel().hidden, true);
  assert.equal(app.timers.size, 0);
});

test('当加载超过十五秒时应该提供诚实恢复入口且不自动刷新', async (t) => {
  const app = setup(t);
  const client = app.client();
  await flush(); app.timeout();
  assert.match(app.panel().textContent, /等待较久/);
  assert.equal(app.retry().textContent, '重新加载页面');
  assert.equal(app.retry().hidden, false);
  assert.equal(app.document.querySelector('script[src]'), client);
  assert.equal(app.document.querySelectorAll('script[src]').length, 1);
});

test('当超时后评论晚到时应该恢复显示而不删除评论iframe', async (t) => {
  const app = setup(t);
  app.client(); const frame = app.frame();
  await flush(); app.timeout();
  assert.match(app.panel().textContent, /先保存/);
  app.message(frame);
  assert.equal(app.panel().hidden, true);
  assert.equal(app.document.querySelector('iframe'), frame);
});

test('当客户端失败后手动重试时应该保留配置且避免重复加载', async (t) => {
  const app = setup(t);
  const client = app.client();
  await flush(); client.dispatchEvent(new app.window.Event('error'));
  assert.match(app.panel().textContent, /未能加载/);
  assert.equal(app.retry().textContent, '重试加载');
  app.retry().focus(); app.retry().click(); app.retry().click();
  await flush();
  const retry = app.document.querySelector('script[src]');
  assert.notEqual(retry, client);
  assert.equal(retry.getAttribute('data-mapping'), 'pathname');
  assert.equal(retry.getAttribute('data-repo'), 'Arata66/Arata66.github.io');
  assert.equal(app.document.querySelectorAll('script[src]').length, 1);
  assert.equal(app.document.activeElement, app.retry());
  assert.equal(app.retry().getAttribute('aria-disabled'), 'true');
  assert.match(app.panel().textContent, /正在加载评论/);
});

test('当失败发生在DOMContentLoaded之前时应该仍显示恢复反馈', (t) => {
  const app = setup(t, { earlyError: true });
  assert.match(app.panel().textContent, /未能加载/);
  assert.equal(app.retry().hidden, false);
});

test('当iframe等待过久后手动重载时应该只重载原iframe并保留按钮焦点', async (t) => {
  const app = setup(t);
  app.client(); const frame = app.frame();
  await flush(); app.timeout();
  assert.equal(app.retry().textContent, '重新加载评论');
  assert.match(app.panel().textContent, /尚未发送/);
  app.retry().focus(); app.retry().click();
  assert.equal(app.document.querySelector('iframe'), frame);
  assert.equal(app.document.querySelectorAll('script[src]').length, 1);
  assert.match(app.panel().textContent, /正在加载评论/);
  app.message(frame);
  assert.equal(app.document.activeElement, app.retry());
  assert.equal(app.panel().hidden, false);
  app.document.body.tabIndex = -1; app.document.body.focus();
  assert.equal(app.panel().hidden, true);
});

test('当Pjax切页时应该清理等待并忽略旧iframe的消息', async (t) => {
  const app = setup(t);
  app.client(); const oldFrame = app.frame();
  const oldSource = oldFrame.contentWindow;
  await flush();
  const oldPanel = app.panel();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.timers.size, 0);
  app.document.body.innerHTML = '<div id="giscus-wrap"></div>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.client(); const frame = app.frame();
  await flush();
  app.message(frame, undefined, undefined, oldSource);
  assert.equal(app.panel().hidden, false);
  app.message(frame);
  assert.equal(app.panel().hidden, true);
  assert.match(oldPanel.textContent, /正在加载评论/);
  assert.equal(app.document.querySelectorAll('.comment-feedback').length, 1);
});

test('当评论已显示或页面没有评论时应该不增加干扰或重复组件', async (t) => {
  const app = setup(t);
  app.client(); const frame = app.frame(); await flush();
  app.message(frame);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.panel().hidden, true);
  assert.equal(app.document.querySelectorAll('.comment-feedback').length, 1);
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.body.innerHTML = '<main>关于本站</main>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.panel(), null);
  assert.equal(app.timers.size, 0);
});

test('当Pjax结束后仍保留原评论节点时应该恢复观察而不重复提示', async (t) => {
  const app = setup(t);
  app.client(); const frame = app.frame(); await flush();
  app.message(frame);
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelectorAll('.comment-feedback').length, 1);
  assert.equal(app.panel().hidden, true);
  assert.equal(app.document.querySelector('iframe'), frame);
});

test('当失败期间切换主题后恢复时应该用原主题机制同步当前模式', async (t) => {
  const app = setup(t);
  const modes = [];
  app.window.globalFn = { themeChange: { giscus: mode => modes.push(mode) } };
  const client = app.client(); client.setAttribute('data-theme', 'light');
  await flush(); client.dispatchEvent(new app.window.Event('error'));
  app.document.documentElement.setAttribute('data-theme', 'dark');
  app.retry().click(); await flush();
  const frame = app.frame(); await flush();
  frame.dispatchEvent(new app.window.Event('load'));
  assert.deepEqual(modes, ['dark']);
  app.timeout(); app.document.documentElement.setAttribute('data-theme', 'light');
  app.retry().click(); frame.dispatchEvent(new app.window.Event('load'));
  assert.deepEqual(modes, ['dark', 'light']);
});
