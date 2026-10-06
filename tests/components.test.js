const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const musicScript = fs.readFileSync(path.join(__dirname, '../source/js/music-ball.js'), 'utf8');
const weatherScript = fs.readFileSync(path.join(__dirname, '../source/js/weather-clock.js'), 'utf8');
const playlist = [{ name: '测试歌曲', artist: '测试歌手', url: '/test.mp3', pic: '/test.jpg' }];
const weather = { code: '200', now: { icon: '100', temp: '25', text: '晴' } };

function setup(t, script, options = {}) {
  const dom = new JSDOM(options.html || '<div class="card-announcement"></div>', {
    url: 'https://example.test/', runScripts: 'outside-only'
  });
  const { window } = dom;
  const requests = [];
  const audios = [];
  const timers = new Map();
  const observers = [];
  let timerId = 0;
  const audio = {
    preload: 'auto', src: '', volume: 1, currentTime: 0, duration: 0, plays: 0, loads: 0,
    load() { this.loads++; },
    play() { this.plays++; return Promise.resolve(); },
    pause() { this.paused = true; }
  };
  Object.defineProperty(window, 'Audio', { value: function () { audios.push(audio); return audio; } });
  Object.defineProperty(window, 'fetch', { value: (url, config) => {
    requests.push(url);
    return options.fetch ? options.fetch(url, config) : Promise.resolve({ ok: true, json: async () => script === musicScript ? playlist : weather });
  } });
  Object.defineProperty(window, 'setTimeout', { value: (callback, delay) => {
    const id = ++timerId; timers.set(id, { callback, delay, repeat: false }); return id;
  } });
  Object.defineProperty(window, 'setInterval', { value: (callback, delay) => {
    const id = ++timerId; timers.set(id, { callback, delay, repeat: true }); return id;
  } });
  Object.defineProperty(window, 'clearTimeout', { value: (id) => timers.delete(id) });
  Object.defineProperty(window, 'clearInterval', { value: (id) => timers.delete(id) });
  if (options.observer !== false) {
    Object.defineProperty(window, 'IntersectionObserver', { value: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target) { this.target = target; }
      disconnect() { this.disconnected = true; }
    } });
  }
  if (options.idle) {
    Object.defineProperty(window, 'requestIdleCallback', { value: (callback, config) => {
      const id = ++timerId; timers.set(id, { callback, delay: config.timeout, repeat: false }); return id;
    } });
    Object.defineProperty(window, 'cancelIdleCallback', { value: (id) => timers.delete(id) });
  }
  if (options.cache) window.localStorage.setItem('weather-clock-cache', JSON.stringify(options.cache));
  if (options.storageDenied) Object.defineProperty(window, 'localStorage', { get() { throw new Error('存储被禁用'); } });
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(async () => { await flush(); window.close(); });
  return {
    window, document: window.document, requests, audios, timers, observers,
    pjax() { window.document.dispatchEvent(new window.Event('pjax:complete')); },
    runTimers(maxDelay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay > maxDelay) continue;
        if (!timer.repeat) timers.delete(id);
        timer.callback();
      }
    },
    approach() {
      const observer = observers.at(-1);
      assert.ok(observer, '天气卡片应等待视口观察通知');
      observer.callback([{ target: observer.target, isIntersecting: true }]);
    }
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('当音乐浮球首次出现时应该不请求歌单或预加载音频', (t) => {
  const app = setup(t, musicScript);
  assert.equal(app.requests.length, 0);
  assert.equal(app.audios[0].preload, 'none');
  assert.equal(app.audios[0].src, '');
  assert.ok(app.document.getElementById('ball-cover').getAttribute('src').startsWith('/img/theme/'));
});

test('当用户连续展开歌单时应该只请求一次且打开后不自动播放', async (t) => {
  const app = setup(t, musicScript);
  const button = app.document.getElementById('music-ball-btn');
  button.click(); button.click(); button.click();
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.document.getElementById('mp-title').textContent, '测试歌曲');
  assert.equal(app.audios[0].plays, 0);
  app.document.getElementById('mp-play').click();
  await flush();
  assert.equal(app.audios[0].plays, 1);
});

test('当首次操作是播放按钮时应该加载歌单并播放', async (t) => {
  const app = setup(t, musicScript);
  app.document.getElementById('mp-play').click();
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.audios[0].plays, 1);
});

test('当换歌后旧播放请求失败时应该保持新歌曲的播放状态', async (t) => {
  const app = setup(t, musicScript, { fetch: async () => ({ ok: true, json: async () => [...playlist, { ...playlist[0], name: '第二首', url: '/second.mp3' }] }) });
  app.document.getElementById('music-ball-btn').click(); await flush();
  const attempts = [];
  app.audios[0].play = () => new Promise((resolve, reject) => attempts.push({ resolve, reject }));
  app.document.getElementById('mp-play').click();
  app.document.getElementById('mp-next').click(); await flush();
  attempts[1].resolve(); attempts[0].reject(new Error('旧请求被换歌中断')); await flush();
  assert.equal(app.audios[0].src, '/second.mp3');
  assert.equal(app.document.getElementById('mp-play').textContent, '⏸');
  assert.ok(app.document.getElementById('music-ball-btn').classList.contains('playing'));
});

test('当暂停后重新播放而旧请求失败时应该保持本次播放状态', async (t) => {
  const app = setup(t, musicScript);
  app.document.getElementById('music-ball-btn').click(); await flush();
  const attempts = [];
  app.audios[0].play = () => new Promise((resolve, reject) => attempts.push({ resolve, reject }));
  const play = app.document.getElementById('mp-play');
  play.click(); play.click(); play.click();
  attempts[1].resolve(); attempts[0].reject(new Error('旧请求被暂停中断')); await flush();
  assert.equal(play.textContent, '⏸');
});

test('当歌单请求失败后再次展开时应该允许重试', async (t) => {
  let attempts = 0;
  const app = setup(t, musicScript, { fetch: () => ++attempts === 1
    ? Promise.reject(new Error('网络不可用'))
    : Promise.resolve({ ok: true, json: async () => playlist }) });
  const button = app.document.getElementById('music-ball-btn');
  button.click(); await flush();
  assert.match(app.document.getElementById('mp-title').textContent, /失败/);
  button.click(); button.click(); await flush();
  assert.equal(app.requests.length, 2);
  assert.equal(app.document.getElementById('mp-title').textContent, '测试歌曲');
});

test('当歌单为空时应该显示空状态且切歌不产生异常', async (t) => {
  const app = setup(t, musicScript, { fetch: async () => ({ ok: true, json: async () => [] }) });
  const errors = [];
  app.window.addEventListener('error', (event) => errors.push(event.error));
  app.document.getElementById('music-ball-btn').click(); await flush();
  app.document.getElementById('mp-prev').click();
  app.document.getElementById('mp-next').click();
  await flush();
  assert.equal(errors.length, 0);
  assert.match(app.document.getElementById('mp-title').textContent, /暂无歌曲/);
  assert.equal(app.audios[0].src, '');
});

test('当音乐播放期间发生 PJAX 或脚本再次初始化时应该保持唯一播放器和播放状态', async (t) => {
  const app = setup(t, musicScript);
  app.document.getElementById('music-ball-btn').click(); await flush();
  app.document.getElementById('mp-play').click(); await flush();
  app.pjax(); app.window.eval(musicScript);
  assert.equal(app.document.querySelectorAll('#music-ball').length, 1);
  assert.equal(app.audios.length, 1);
  assert.equal(app.requests.length, 1);
  assert.equal(app.document.getElementById('mp-play').textContent, '⏸');
});

test('当用户拖动音乐浮球时应该保存位置且不提前加载歌单', (t) => {
  const app = setup(t, musicScript);
  const root = app.document.getElementById('music-ball');
  root.dispatchEvent(new app.window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mousemove', { clientX: 90, clientY: 20 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mouseup'));
  app.document.getElementById('music-ball-btn').click();
  assert.equal(app.requests.length, 0);
  assert.equal(root.style.left, '80px');
  assert.ok(app.window.localStorage.getItem('music-ball-pos'));
});

test('当用户从唱片封面开始拖动时应该由播放器控制拖动而不触发原生图片拖动', t => {
  const app = setup(t, musicScript);
  const cover = app.document.getElementById('ball-cover');
  assert.equal(cover.draggable, false);
  cover.dispatchEvent(new app.window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mousemove', { clientX: 90, clientY: 20 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mouseup'));
  assert.ok(app.window.localStorage.getItem('music-ball-pos'));
  assert.equal(app.requests.length, 0);
});

test('当歌单失败时应该通过面板按钮直接重试且不自动播放', async t => {
  let count = 0;
  const app = setup(t, musicScript, { fetch: async () => {
    if (++count === 1) throw new Error('离线');
    return { ok: true, json: async () => playlist };
  } });
  app.document.getElementById('music-ball-btn').click(); await flush();
  const retry = app.document.getElementById('mp-retry');
  assert.ok(retry && !retry.hidden, '失败时应提供可操作的重试按钮');
  retry.focus();
  retry.click(); await flush();
  assert.equal(app.requests.length, 2);
  assert.equal(app.document.getElementById('mp-title').textContent, '测试歌曲');
  assert.equal(app.audios[0].plays, 0);
  assert.equal(app.document.activeElement, app.document.getElementById('mp-play'));
});

test('当歌单等待超过上限时应该允许重试且忽略旧请求的迟到结果', async t => {
  const finishes = [];
  let aborted = false;
  let count = 0;
  const app = setup(t, musicScript, { fetch: (url, config) => {
    if (++count > 1) return Promise.resolve({ ok: true, json: async () => playlist });
    if (config?.signal) config.signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(resolve => { finishes.push(resolve); });
  } });
  app.document.getElementById('music-ball-btn').click();
  await flush(); app.runTimers(15000); await flush();
  assert.match(app.document.getElementById('mp-status').textContent, /超时/);
  assert.equal(aborted, true);
  app.document.getElementById('mp-retry').click(); await flush();
  assert.equal(finishes.length, 1);
  finishes[0]({ ok: true, json: async () => [{ ...playlist[0], name: '迟到旧歌曲' }] }); await flush();
  assert.equal(app.document.getElementById('mp-title').textContent, '测试歌曲');
  assert.equal(app.requests.length, 2);
});

test('当歌单解析卡住时应该结束等待并提供重试入口', async t => {
  const app = setup(t, musicScript, { fetch: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  app.document.getElementById('music-ball-btn').click(); await flush();
  app.runTimers(15000); await flush();
  assert.ok(!app.document.getElementById('mp-retry').hidden);
  assert.match(app.document.getElementById('mp-status').textContent, /超时/);
});

test('当歌单返回异常条目或空歌单时应该显示可重新加载的状态', async t => {
  for (const data of [{ error: '服务错误' }, [null, {}], []]) {
    const app = setup(t, musicScript, { fetch: async () => ({ ok: true, json: async () => data }) });
    app.document.getElementById('music-ball-btn').click(); await flush();
    assert.ok(!app.document.getElementById('mp-retry').hidden);
    assert.equal(app.audios[0].plays, 0);
    assert.equal(app.document.querySelectorAll('.pl-item').length, 0);
  }
});

test('当歌曲字段含HTML且封面缺失时应该按文本显示并保留默认封面', async t => {
  const name = '<img src=x onerror=alert(1)>歌曲';
  const app = setup(t, musicScript, { fetch: async () => ({ ok: true, json: async () => [{ name, artist: '<b>歌手</b>', url: '/song.mp3' }] }) });
  app.document.getElementById('music-ball-btn').click(); await flush();
  assert.equal(app.document.querySelector('.pl-title').textContent, name);
  assert.equal(app.document.querySelector('#mp-playlist img'), null);
  assert.equal(app.document.querySelector('#mp-playlist b'), null);
  assert.ok(app.document.getElementById('ball-cover').getAttribute('src').startsWith('/img/theme/'));
  assert.equal(app.document.querySelector('.pl-item').tagName, 'BUTTON');
});

test('当播放被拒绝或音频无法加载时应该显示反馈并恢复播放按钮', async t => {
  const app = setup(t, musicScript);
  app.document.getElementById('music-ball-btn').click(); await flush();
  app.audios[0].play = () => Promise.reject(new Error('播放不可用'));
  app.document.getElementById('mp-play').click(); await flush();
  assert.match(app.document.getElementById('mp-status').textContent, /播放.*失败/);
  assert.equal(app.document.getElementById('mp-play').textContent, '▶');
  app.audios[0].play = () => Promise.resolve();
  app.document.getElementById('mp-play').click(); await flush();
  assert.equal(app.document.getElementById('mp-status').textContent, '');
  app.audios[0].onerror();
  assert.match(app.document.getElementById('mp-status').textContent, /播放.*失败/);
  assert.equal(app.document.getElementById('mp-play').textContent, '▶');
  app.document.getElementById('mp-play').click(); await flush();
  assert.equal(app.audios[0].loads, 1);
  assert.equal(app.document.getElementById('mp-status').textContent, '');
});

test('当本地存储被禁用时应该仍能展开音乐和调整音量', async t => {
  const app = setup(t, musicScript, { storageDenied: true });
  app.document.getElementById('music-ball-btn').click(); await flush();
  assert.equal(app.document.getElementById('mp-title').textContent, '测试歌曲');
  app.document.getElementById('mp-vol-icon').click();
  assert.equal(app.audios[0].volume, 0);
  assert.equal(app.document.getElementById('mp-vol-icon').textContent, '🔇');
});

test('当按Escape关闭音乐面板时应该恢复唱片焦点并同步展开状态', async t => {
  const app = setup(t, musicScript);
  const ball = app.document.getElementById('music-ball-btn');
  assert.equal(ball.tagName, 'BUTTON');
  ball.click(); await flush();
  app.document.getElementById('mp-play').focus();
  app.document.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(ball.getAttribute('aria-expanded'), 'false');
  assert.equal(app.document.activeElement, ball);
  assert.equal(app.document.getElementById('music-panel').classList.contains('show'), false);
});

test('当拖动从面板控制按钮开始时应该不移动唱片位置', async t => {
  const app = setup(t, musicScript);
  app.document.getElementById('music-ball-btn').click(); await flush();
  app.document.getElementById('mp-play').dispatchEvent(new app.window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mousemove', { clientX: 90, clientY: 20 }));
  app.document.dispatchEvent(new app.window.MouseEvent('mouseup'));
  assert.equal(app.document.getElementById('music-ball').style.left, '');
});

test('当天气卡片未接近视口时应该立即显示时钟但不请求天气', (t) => {
  const app = setup(t, weatherScript);
  assert.match(app.document.querySelector('.wc-time').textContent, /^\d{2}:\d{2}:\d{2}$/);
  assert.ok(app.document.querySelector('.wc-date').textContent.includes('星期'));
  assert.equal(app.requests.length, 0);
  assert.equal(app.observers.length, 1);
});

test('当天气卡片接近视口并重复触发 PJAX 时应该仅请求一次', async (t) => {
  const app = setup(t, weatherScript);
  app.approach(); app.approach(); app.pjax(); app.runTimers(100);
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.document.querySelector('.wc-weather-temp').textContent, '25°C');
  assert.equal(app.document.querySelectorAll('.weather-clock-card').length, 1);
  assert.equal([...app.timers.values()].filter((timer) => timer.repeat).length, 2);
});

test('当天气脚本重复初始化时应该保留唯一时钟和观察器', (t) => {
  const app = setup(t, weatherScript);
  app.window.eval(weatherScript);
  app.document.dispatchEvent(new app.window.Event('DOMContentLoaded'));
  assert.equal(app.document.querySelectorAll('.weather-clock-card').length, 1);
  assert.equal(app.observers.length, 1);
  assert.equal([...app.timers.values()].filter((timer) => timer.repeat).length, 1);
});

test('当天气请求尚未完成就发生 PJAX 时应该复用请求并更新新卡片', async (t) => {
  const completions = [];
  const response = new Promise((resolve) => { completions.push(resolve); });
  const app = setup(t, weatherScript, { fetch: () => response });
  app.approach();
  app.document.querySelector('.weather-clock-card').remove();
  app.pjax(); app.runTimers(100); app.approach();
  assert.equal(app.requests.length, 1);
  completions[0]({ ok: true, json: async () => weather });
  await flush();
  assert.equal(app.document.querySelector('.wc-weather-temp').textContent, '25°C');
});

test('当 PJAX 替换天气卡片时应该复用半小时缓存并清理旧计时器', async (t) => {
  const app = setup(t, weatherScript);
  app.approach(); await flush();
  app.document.querySelector('.weather-clock-card').remove();
  app.pjax(); app.runTimers(100); app.approach(); await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.document.querySelector('.wc-weather-temp').textContent, '25°C');
  assert.equal([...app.timers.values()].filter((timer) => timer.repeat).length, 2);
});

test('当 PJAX 切到无侧栏页面时应该停止定时器且不再请求天气', async (t) => {
  const app = setup(t, weatherScript);
  app.approach(); await flush();
  app.document.body.innerHTML = '';
  app.pjax(); app.runTimers(100); app.runTimers(30 * 60 * 1000);
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.timers.size, 0);
});

test('当页面没有天气卡片挂载位置时应该不请求或创建计时器', (t) => {
  const app = setup(t, weatherScript, { html: '<main>文章</main>' });
  assert.equal(app.requests.length, 0);
  assert.equal(app.timers.size, 0);
});

test('当浏览器不支持观察器时应该在有限空闲等待后请求天气', async (t) => {
  const app = setup(t, weatherScript, { observer: false, idle: true });
  assert.equal(app.requests.length, 0);
  app.runTimers(3000); await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.document.querySelector('.wc-weather-temp').textContent, '25°C');
});

test('当浏览器不支持空闲回调或观察器时应该以有限定时等待降级', async (t) => {
  const app = setup(t, weatherScript, { observer: false });
  assert.equal(app.requests.length, 0);
  app.runTimers(3000); await flush();
  assert.equal(app.requests.length, 1);
});

test('当存在半小时内的天气缓存时应该展示缓存且不发网络请求', async (t) => {
  const app = setup(t, weatherScript, { cache: { savedAt: Date.now(), now: weather.now } });
  app.approach(); await flush();
  assert.equal(app.requests.length, 0);
  assert.equal(app.document.querySelector('.wc-weather-temp').textContent, '25°C');
});

test('当天气缓存过期时应该接近视口后重新请求', async (t) => {
  const app = setup(t, weatherScript, { cache: { savedAt: Date.now() - 31 * 60 * 1000, now: weather.now } });
  assert.equal(app.requests.length, 0);
  app.approach(); await flush();
  assert.equal(app.requests.length, 1);
});

test('当天气网络失败或服务返回错误时应该显示合理失败状态且时钟继续更新', async (t) => {
  const app = setup(t, weatherScript, { fetch: async () => ({ ok: true, json: async () => ({ code: '401' }) }) });
  app.approach(); await flush();
  assert.match(app.document.querySelector('.wc-weather-desc').textContent, /暂不可用/);
  assert.ok([...app.timers.values()].some((timer) => timer.repeat && timer.delay === 1000));
});

test('当天气请求因网络断开失败时应该保留可阅读的时钟和失败提示', async (t) => {
  const app = setup(t, weatherScript, { fetch: async () => { throw new Error('网络不可用'); } });
  app.approach(); await flush();
  assert.match(app.document.querySelector('.wc-weather-desc').textContent, /暂不可用/);
  assert.equal(app.document.querySelector('.wc-weather-wrap').getAttribute('data-enabled'), 'true');
  assert.ok(app.document.querySelector('.wc-date').textContent.includes('星期'));
});
