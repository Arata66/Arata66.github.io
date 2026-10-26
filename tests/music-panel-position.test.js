const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../source/js/music-ball.js'), 'utf8');
const songs = [{ name: '测试歌曲', artist: '测试歌手', url: '/sample.mp3' }];
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t, position = {}, fetcher = async () => ({ ok: true, json: async () => songs })) {
  const dom = new JSDOM('', { url: 'https://example.test/', runScripts: 'outside-only' });
  const { window } = dom;
  const layout = { left: 30, bottom: 200, panelHeight: 400, ...position };
  const requests = [];
  const audio = { src: '', volume: .8, currentTime: 0, duration: 0, plays: 0, play() { this.plays++; return Promise.resolve(); }, pause() {}, load() {} };
  Object.defineProperty(window, 'Audio', { value: function () { return audio; } });
  Object.defineProperty(window, 'fetch', { value: (...args) => { requests.push(args); return fetcher(); } });
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  window.localStorage.setItem('music-ball-pos', JSON.stringify({ left: layout.left, bottom: layout.bottom }));
  const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.id !== 'music-ball') return originalRect.call(this);
    return new window.DOMRect(parseFloat(this.style.left), window.innerHeight - parseFloat(this.style.bottom) - 56, 56, 56);
  };
  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { return this.id === 'music-panel' ? 280 : 56; } });
  Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { get() { return this.id === 'music-panel' ? layout.panelHeight : 56; } });
  window.eval(script);
  t.after(() => window.close());
  const ball = window.document.getElementById('music-ball');
  const button = window.document.getElementById('music-ball-btn');
  const panel = window.document.getElementById('music-panel');
  return { window, document: window.document, ball, button, panel, audio, layout, requests };
}

function assertVisible(app) {
  const left = parseFloat(app.panel.style.left);
  const top = parseFloat(app.panel.style.top);
  assert.ok(left >= 12, '面板左边应留在窗口内');
  assert.ok(top >= 12, '面板上边应留在窗口内');
  assert.ok(left + app.panel.offsetWidth <= app.window.innerWidth - 12, '面板右边应留在窗口内');
  assert.ok(top + app.panel.offsetHeight <= app.window.innerHeight - 12, '面板下边应留在窗口内');
}

test('当恢复的悬浮球位置超出当前窗口时应该移回可见区域且不加载或播放', t => {
  const app = setup(t, { left: 2000, bottom: 1200 });
  const box = app.ball.getBoundingClientRect();
  assert.ok(box.left >= 0 && box.right <= app.window.innerWidth);
  assert.ok(box.top >= 0 && box.bottom <= app.window.innerHeight);
  assert.equal(app.requests.length, 0);
  assert.equal(app.audio.plays, 0);
});

test('当悬浮球靠近左右边缘时应该选择可见侧展开完整面板', async t => {
  for (const left of [20, 960]) {
    const app = setup(t, { left });
    app.button.click(); await flush();
    assertVisible(app);
    if (left > 900) assert.ok(parseFloat(app.panel.style.left) < app.ball.getBoundingClientRect().left);
    else assert.ok(parseFloat(app.panel.style.left) >= app.ball.getBoundingClientRect().right);
    assert.equal(app.audio.plays, 0);
  }
});

test('当窗口缩小并进入手机宽度时应该校正位置再关闭面板而不中断音乐', async t => {
  const app = setup(t, { left: 960, panelHeight: 300 });
  app.button.click(); await flush();
  app.document.getElementById('mp-play').click();
  Object.defineProperty(app.window, 'innerWidth', { value: 900 });
  Object.defineProperty(app.window, 'innerHeight', { value: 480 });
  app.window.dispatchEvent(new app.window.Event('resize'));
  assert.ok(app.ball.getBoundingClientRect().right <= 900);
  assertVisible(app);
  Object.defineProperty(app.window, 'innerWidth', { value: 700 });
  app.window.dispatchEvent(new app.window.Event('resize'));
  assert.equal(app.button.getAttribute('aria-expanded'), 'false');
  assert.equal(app.panel.classList.contains('show'), false);
  assert.equal(app.window.BLOG_MUSIC.getState().playing, true);
  assert.equal(app.audio.plays, 1);
});

test('当展开面板后把悬浮球拖到窗口角落时应该同步保持面板可见', async t => {
  const app = setup(t);
  app.button.click(); await flush();
  app.ball.dispatchEvent(new app.window.MouseEvent('mousedown', { clientX: 30, clientY: 540, bubbles: true }));
  app.document.dispatchEvent(new app.window.MouseEvent('mousemove', { clientX: 3000, clientY: -500 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mouseup'));
  assertVisible(app);
  assert.equal(app.requests.length, 1);
  assert.equal(app.audio.plays, 0);
});

test('当歌单加载使面板增高时应该重新定位而不自动播放', async t => {
  const replies = [];
  const app = setup(t, { bottom: 20, panelHeight: 200 }, () => new Promise(resolve => replies.push(resolve)));
  app.button.click();
  app.layout.panelHeight = 600;
  replies[0]({ ok: true, json: async () => songs });
  await flush();
  assertVisible(app);
  assert.equal(app.audio.plays, 0);
});

test('当加载失败出现重试提示使面板增高时应该仍能看到恢复入口', async t => {
  const replies = [];
  const app = setup(t, { bottom: 20, panelHeight: 200 }, () => new Promise((resolve, reject) => replies.push(reject)));
  app.button.click();
  app.layout.panelHeight = 600;
  replies[0](new Error('服务不可用'));
  await flush();
  assertVisible(app);
  assert.equal(app.document.getElementById('mp-retry').hidden, false);
  assert.equal(app.audio.plays, 0);
});
