const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const controller = path.join(__dirname, '../source/js/navigation-history.js');
const pjaxSource = fs.readFileSync(path.join(__dirname, '../source/js/vendor/pjax.min.js'), 'utf8');
const page = '<html><head><title>文章浏览</title></head><body><main id="view"><h2 id="section">一个章节</h2></main></body></html>';

function setup(t, initialState = true) {
  const dom = new JSDOM(page, { url: 'https://arata66.top/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  t.after(() => window.close());
  let x = 0, y = 0;
  const frames = [], calls = [], requests = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Object.defineProperty(window, 'scrollTo', { value: (left, top) => {
    if (typeof left === 'object') { x = left.left ?? x; y = left.top ?? y; }
    else { x = left; y = top; }
    calls.push([x, y]);
  } });
  Object.defineProperty(window, 'scrollX', { configurable: true, get: () => x });
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  Object.defineProperty(document.documentElement, 'scrollLeft', { configurable: true, get: () => x });
  Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, get: () => y });
  if (initialState) window.history.replaceState({ uid: 'entry-a', url: window.location.href, title: '首页', scrollPos: [0, 0] }, '');
  window.eval(pjaxSource);
  const pjax = new window.Pjax({ elements: 'a', selectors: ['title', '#view'], analytics: false, cacheBust: false, scrollRestoration: false });
  pjax.doRequest = (url, options, callback) => {
    const request = { readyState: 1, responseURL: url.split('#')[0], aborted: false, onreadystatechange: null, abort() { this.aborted = true; }, getResponseHeader() { return null; } };
    requests.push({ reply(html = undefined) { if (!request.aborted) { request.readyState = 4; callback(html === undefined ? page : html, request, url, options); } } });
    return request;
  };
  if (fs.existsSync(controller)) window.eval(fs.readFileSync(controller, 'utf8'));
  const snapshot = () => ({ state: JSON.parse(JSON.stringify(window.history.state)), url: window.location.href });
  const reply = (html = undefined) => requests.shift().reply(html);
  const flushFrames = () => { while (frames.length) frames.shift()(0); };
  return {
    window, document, calls, snapshot, reply, flushFrames,
    position: () => [x, y],
    readAt(top) { y = top; },
    navigate(url) { pjax.loadUrl(new URL(url, window.location.href).href); reply(); flushFrames(); },
    traverse(entry) {
      window.history.replaceState(entry.state, '', entry.url);
      window.dispatchEvent(new window.PopStateEvent('popstate', { state: entry.state }));
    }
  };
}

test('当从文章后退回列表时应该恢复离开列表的位置且新文章仍从顶部开始', t => {
  const app = setup(t);
  const home = app.snapshot();
  app.readAt(894);
  app.navigate('/post/');
  assert.deepEqual(app.position(), [0, 0]);
  app.readAt(630);
  app.traverse(home); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 894]);
});

test('当后退后继续阅读并再次前进后退时应该分别恢复各页最新位置', t => {
  const app = setup(t);
  const home = app.snapshot();
  app.readAt(900); app.navigate('/post/');
  const post = app.snapshot();
  app.readAt(720);
  app.traverse(home); app.reply(); app.flushFrames();
  app.readAt(1080);
  app.traverse(post); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 720]);
  app.readAt(880);
  app.traverse(home); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 1080]);
});

test('当首次历史页尚未被内存记录时应该使用Pjax原有的有效位置', t => {
  const app = setup(t, false);
  app.navigate('/post/'); app.readAt(420);
  app.traverse({ state: { uid: 'first-entry', url: 'https://arata66.top/', scrollPos: [0, 725] }, url: 'https://arata66.top/' });
  app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 725]);
});

test('当历史位置无效时应该不滚动到非数字或负数坐标', t => {
  for (const scrollPos of [[0, -2], [0, '300'], [0, Infinity], null]) {
    const app = setup(t);
    app.navigate('/post/'); app.readAt(430);
    app.traverse({ state: { uid: 'invalid-entry', url: 'https://arata66.top/other/', scrollPos }, url: 'https://arata66.top/other/' });
    app.reply(); app.flushFrames();
    assert.deepEqual(app.position(), [0, 430]);
  }
});

test('当同一地址在不同历史项出现时应该分别保留阅读位置', t => {
  const app = setup(t);
  app.navigate('/post/'); const first = app.snapshot();
  app.readAt(500); app.navigate('/other/');
  app.navigate('/post/'); const second = app.snapshot();
  app.readAt(1100);
  app.traverse(first); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 500]);
  app.traverse(second); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 1100]);
});

test('当后退恢复尚未执行就再次前进时应该取消旧帧并以最新页面为准', t => {
  const app = setup(t);
  const home = app.snapshot();
  app.readAt(900); app.navigate('/post/'); const post = app.snapshot();
  app.readAt(780);
  app.traverse(home); app.reply();
  app.traverse(post); app.reply(); app.flushFrames();
  assert.equal(app.window.location.pathname, '/post/');
  assert.deepEqual(app.position(), [0, 780]);
});

test('当历史切页失败时应该不执行目标位置或遗留旧恢复任务', t => {
  const app = setup(t);
  const home = app.snapshot();
  app.readAt(900); app.navigate('/post/');
  app.readAt(470);
  app.traverse(home); app.reply(false); app.flushFrames();
  assert.deepEqual(app.position(), [0, 470]);
  assert.equal(app.document.querySelector('#view h2').textContent, '一个章节');
  app.navigate('/other/');
  assert.deepEqual(app.position(), [0, 0]);
});

test('当同页章节链接改变地址后再返回时应该保留该章节的实际阅读位置', t => {
  const app = setup(t);
  app.navigate('/post/');
  const link = app.document.createElement('a'); link.href = '#section';
  app.document.querySelector('#view').append(link);
  app.readAt(400); link.click();
  app.window.history.replaceState(app.window.history.state, '', '/post/#section');
  app.window.dispatchEvent(new app.window.HashChangeEvent('hashchange'));
  const chapter = app.snapshot();
  app.readAt(970); app.navigate('/other/');
  app.traverse(chapter); app.reply(); app.flushFrames();
  assert.equal(app.window.location.hash, '#section');
  assert.deepEqual(app.position(), [0, 970]);
});

test('当普通链接带章节地址时应该保留Pjax自己的锚点定位且不主动改变焦点', t => {
  const app = setup(t);
  const input = app.document.createElement('input'); app.document.body.append(input); input.focus();
  app.readAt(600); app.navigate('/post/#section');
  assert.deepEqual(app.position(), [0, 0]);
  assert.equal(app.document.activeElement, input);
  assert.equal(app.window.location.hash, '#section');
});

test('当原生章节跳转先滚动再发送空状态popstate时应该保留跳转前的位置', t => {
  const app = setup(t);
  app.navigate('/post/');
  const original = app.snapshot();
  const link = app.document.createElement('a'); link.href = '#section';
  app.document.querySelector('#view').append(link);
  app.readAt(400); link.click();
  app.window.history.replaceState(null, '', '/post/#section');
  app.readAt(200);
  app.window.dispatchEvent(new app.window.PopStateEvent('popstate', { state: null }));
  app.window.dispatchEvent(new app.window.HashChangeEvent('hashchange'));
  app.traverse(original); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 400]);
});

test('当回到原页继续阅读后前进到空状态章节时应该保存最新位置', t => {
  const app = setup(t);
  app.navigate('/post/'); const original = app.snapshot();
  const link = app.document.createElement('a'); link.href = '#section';
  app.document.querySelector('#view').append(link);
  app.readAt(400); link.click();
  const chapter = { state: null, url: 'https://arata66.top/post/#section' };
  app.traverse(chapter); app.readAt(200);
  app.window.dispatchEvent(new app.window.HashChangeEvent('hashchange'));
  app.traverse(original); app.reply(); app.flushFrames();
  app.readAt(600);
  app.traverse(chapter); app.readAt(200);
  app.window.dispatchEvent(new app.window.HashChangeEvent('hashchange'));
  app.traverse(original); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 600]);
});

test('当章节链接被其他控件取消默认跳转后应该仍能记录之后的历史往返', t => {
  const app = setup(t);
  app.navigate('/post/'); const original = app.snapshot();
  const link = app.document.createElement('a'); link.href = '#section';
  app.document.querySelector('#view').append(link);
  link.addEventListener('click', event => event.preventDefault());
  app.readAt(400); link.click();
  app.readAt(600);
  app.traverse({ state: null, url: 'https://arata66.top/post/#section' });
  app.readAt(200); app.window.dispatchEvent(new app.window.HashChangeEvent('hashchange'));
  app.traverse(original); app.reply(); app.flushFrames();
  assert.deepEqual(app.position(), [0, 600]);
});
