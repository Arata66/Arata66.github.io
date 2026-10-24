const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const playerScript = fs.readFileSync(path.join(__dirname, '../source/js/music-ball.js'), 'utf8');
const roomScript = fs.readFileSync(path.join(__dirname, '../source/js/music-room.js'), 'utf8');
const markup = `<section class="music-room"><button data-music-find="sparkle" hidden>查找 sparkle</button><section class="music-online"><button class="music-load" hidden>浏览完整歌单</button><div class="music-search" hidden><input class="music-query" aria-label="搜索歌名或歌手"><button class="music-clear" hidden>清空</button></div><p class="music-results-status" role="status">点一下加载在线歌单</p><ol class="music-results"></ol><button class="music-more" hidden>继续显示</button></section><aside class="music-current"><p class="music-current-label"></p><p class="music-current-title"></p><p class="music-current-artist"></p><button class="music-toggle" hidden>播放</button><p class="music-current-message" role="status" hidden></p></aside></section>`;
const songs = [
  { name: '彼女は旅に出る', artist: '鎖那', url: '/one.mp3' },
  { name: 'sparkle', artist: '鎖那', url: '/two.mp3' },
  { name: 'Luv Letter', artist: 'DJ OKAWARI', url: '/three.mp3' }
];
const flush = () => new Promise(resolve => setImmediate(resolve));

function find(app, selector) {
  const node = app.root.querySelector(selector);
  assert.ok(node, `页面缺少可操作元素：${selector}`);
  return node;
}

function setup(t, fetcher = async () => ({ ok: true, json: async () => songs })) {
  const dom = new JSDOM(markup, { url: 'https://arata66.top/music/', runScripts: 'outside-only' });
  const { window } = dom;
  const audios = [];
  const requests = [];
  const audio = { src: '', volume: 1, currentTime: 0, duration: 0, plays: 0, play() { this.plays++; return Promise.resolve(); }, pause() {}, load() {} };
  Object.defineProperty(window, 'Audio', { value: function () { audios.push(audio); return audio; } });
  Object.defineProperty(window, 'fetch', { value: (...args) => { requests.push(args); return fetcher(); } });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: true }) });
  window.eval(playerScript);
  window.eval(roomScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  return { window, document: window.document, audio, audios, requests, root: window.document.querySelector('.music-room') };
}

test('当访客进入音乐馆时应该保留静态内容且直到明确操作才加载歌单', async t => {
  const app = setup(t);
  assert.equal(app.requests.length, 0);
  assert.equal(app.audios.length, 1);
  assert.equal(find(app, '.music-load').hidden, false);
  assert.equal(find(app, '[data-music-find]').hidden, false);
  find(app, '.music-load').click();
  app.document.getElementById('music-ball-btn').click();
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.root.querySelectorAll('.music-results li').length, 3);
  assert.equal(app.audio.plays, 0);
});

test('当访客查找文中歌曲或输入歌手时应该匹配真实歌单并支持清空与空结果', async t => {
  const app = setup(t);
  find(app, '[data-music-find]').click();
  await flush();
  assert.equal(app.root.querySelectorAll('.music-results li').length, 1);
  assert.match(find(app, '.music-results').textContent, /sparkle/);
  const input = find(app, '.music-query');
  for (const [query, count] of [['鎖那', 2], ['ｌｕｖ letter', 1], ['不存在的歌曲', 0]]) {
    input.value = query;
    input.dispatchEvent(new app.window.Event('input'));
    assert.equal(app.root.querySelectorAll('.music-results li').length, count);
  }
  assert.match(find(app, '[role="status"]').textContent, /没有找到/);
  find(app, '.music-clear').click();
  assert.equal(input.value, '');
  assert.equal(app.root.querySelectorAll('.music-results li').length, 3);
  assert.equal(app.requests.length, 1);
});

test('当在线歌单较长时应该分批显示并让搜索覆盖全部歌曲', async t => {
  const many = Array.from({ length: 85 }, (_, index) => ({ ...songs[0], name: `歌曲${index}`, url: `/song-${index}.mp3` }));
  const app = setup(t, async () => ({ ok: true, json: async () => many }));
  find(app, '.music-load').click(); await flush();
  assert.equal(app.root.querySelectorAll('.music-results li').length, 40);
  find(app, '.music-more').click();
  assert.equal(app.root.querySelectorAll('.music-results li').length, 80);
  const input = find(app, '.music-query');
  input.value = '歌曲84'; input.dispatchEvent(new app.window.Event('input'));
  assert.equal(app.root.querySelectorAll('.music-results li').length, 1);
  find(app, '.music-results button').click(); await flush();
  assert.equal(app.audio.src, '/song-84.mp3');
});

test('当用户在音乐馆和悬浮播放器间操作时应该共用音频并同步当前歌曲与暂停状态', async t => {
  const app = setup(t);
  find(app, '.music-load').click(); await flush();
  find(app, '.music-results li:nth-child(2) button').click(); await flush();
  assert.equal(app.audio.src, '/two.mp3');
  assert.equal(app.audio.plays, 1);
  assert.equal(app.document.getElementById('mp-title').textContent, 'sparkle');
  assert.equal(find(app, '.music-current-title').textContent, 'sparkle');
  app.document.getElementById('mp-play').click();
  assert.match(find(app, '.music-toggle').getAttribute('aria-label'), /播放/);
  app.audio.currentTime = 25;
  find(app, '.music-results li:nth-child(2) button').click(); await flush();
  assert.equal(app.audio.currentTime, 25);
  app.document.body.querySelector('.music-room').remove();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.audios.length, 1);
  assert.equal(app.document.getElementById('mp-play').textContent, '⏸');
});

test('当歌单失败或为空时应该保留来源内容并提供能恢复的重新加载入口', async t => {
  for (const empty of [false, true]) {
    let attempts = 0;
    const app = setup(t, async () => {
      if (++attempts === 1) {
        if (!empty) throw new Error('网络不可用');
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => songs };
    });
    find(app, '.music-load').click(); await flush();
    const button = find(app, '.music-load');
    assert.equal(button.hidden, false);
    assert.equal(button.disabled, false);
    assert.match(find(app, '[role="status"]').textContent, empty ? /暂时为空/ : /暂时无法/);
    button.click(); await flush();
    assert.equal(app.root.querySelectorAll('.music-results li').length, 3);
    assert.equal(app.audio.plays, 0);
  }
});

test('当导航开始而旧音乐馆尚未被替换时应该忽略迟到结果且返回时复用已加载歌单', async t => {
  const replies = [];
  const app = setup(t, () => new Promise(resolve => replies.push(resolve)));
  find(app, '.music-load').click();
  const oldStatus = find(app, '[role="status"]');
  const previous = oldStatus.textContent;
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  replies[0]({ ok: true, json: async () => songs }); await flush();
  assert.equal(oldStatus.textContent, previous);
  app.root.remove();
  app.document.body.insertAdjacentHTML('beforeend', markup);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  await flush();
  assert.equal(app.document.querySelectorAll('.music-results li').length, 3);
  assert.equal(app.requests.length, 1);
  find({ root: app.document }, '.music-results button').click(); await flush();
  assert.equal(app.audio.plays, 1);
});

test('当歌名包含标记或播放失败时应该显示普通文字与可恢复的播放反馈', async t => {
  const title = '<img src=x onerror=alert(1)> & 歌曲';
  const app = setup(t, async () => ({ ok: true, json: async () => [{ ...songs[0], name: title }] }));
  find(app, '.music-load').click(); await flush();
  assert.equal(app.root.querySelector('img'), null);
  assert.match(find(app, '.music-results').textContent, /<img src=x/);
  app.audio.play = () => Promise.reject(new Error('播放被拒绝'));
  find(app, '.music-results button').click(); await flush();
  assert.match(find(app, '.music-current-message').textContent, /播放失败/);
  assert.equal(find(app, '.music-current-message').hidden, false);
  assert.match(find(app, '.music-toggle').getAttribute('aria-label'), /播放/);
});

test('当加载歌单与页面导航都失败而仍停留原页时应该恢复重试提示', async t => {
  for (const navigationFirst of [false, true]) {
  const rejections = [];
  let attempts = 0;
  const app = setup(t, () => ++attempts === 1 ? new Promise((resolve, reject) => rejections.push(reject)) : Promise.resolve({ ok: true, json: async () => songs }));
  find(app, '.music-load').click();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  if (navigationFirst) app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  rejections[0](new Error('网络不可用')); await flush();
  if (!navigationFirst) app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  await flush();
  assert.doesNotMatch(find(app, '.music-load').textContent, /正在加载/);
  assert.match(find(app, '.music-results-status').textContent, /失败|无法|超时/);
  find(app, '.music-load').click(); await flush();
  assert.equal(app.root.querySelectorAll('.music-results li').length, 3);
  assert.equal(attempts, 2);
  }
});
