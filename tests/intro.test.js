const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { JSDOM } = require('jsdom');

let introHtml = '';
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/relume_intro.js'), 'utf8'), {
  hexo: { extend: { injector: { register(position, html) { introHtml = html; } } } }
});
const introMarkup = introHtml.replace(/<script[\s\S]*?<\/script>/g, '');
const staticScript = /<script[^>]+src="([^"]+)"/.exec(introHtml);
const introScript = staticScript
  ? fs.readFileSync(path.join(__dirname, '../source', staticScript[1]), 'utf8')
  : /<script>([\s\S]*?)<\/script>/.exec(introHtml)[1];
const preloaderScript = fs.readFileSync(path.join(__dirname, '../source/js/preloader-sakura.js'), 'utf8');

function setup(t, { reduced = false, ready = 'loading', home = true, nested = false, headFirst = false } = {}) {
  const loaderMarkup = '<div class="configure"></div><div class="loading-word">加载中</div>';
  const bodyMarkup = `${home ? introMarkup : ''}<div id="loading-box">${nested ? '<div class="spinner-box">' + loaderMarkup + '</div>' : loaderMarkup}</div><main><button>阅读文章</button></main>`;
  const dom = new JSDOM(headFirst ? '' : bodyMarkup, {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  const { document } = window;
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => ready });
  document.addEventListener('DOMContentLoaded', event => {
    if (ready === 'loading') event.stopImmediatePropagation();
  }, { capture: true });
  const mediaEvents = new window.EventTarget();
  window.matchMedia = () => Object.assign(mediaEvents, {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener(listener) { mediaEvents.addEventListener('change', listener); },
    removeListener(listener) { mediaEvents.removeEventListener('change', listener); }
  });
  let now = 0;
  let id = 0;
  const timers = new Map();
  function schedule(callback, delay = 0, interval = 0) {
    timers.set(++id, { callback, at: now + delay, interval });
    return id;
  }
  window.setTimeout = (callback, delay) => schedule(callback, delay);
  window.setInterval = (callback, delay) => schedule(callback, delay, delay);
  window.clearTimeout = timer => { timers.delete(timer); };
  window.clearInterval = window.clearTimeout;
  function advance(ms) {
    const until = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [timerId, timer] = next;
      now = timer.at;
      if (timer.interval) timer.at += timer.interval;
      else timers.delete(timerId);
      timer.callback();
    }
    now = until;
  }
  function runScripts() {
    if (home) window.eval(introScript);
    window.eval(preloaderScript);
  }
  runScripts();
  if (headFirst) document.body.innerHTML = bodyMarkup;
  t.after(() => window.close());
  return {
    document, window, advance, runScripts, timers,
    playIntro() { window.eval(introScript); },
    domReady() {
      ready = 'interactive';
      document.dispatchEvent(new window.Event('DOMContentLoaded'));
    }
  };
}

test('当正文准备好而外部资源仍在加载时应该保留稍舒缓的首页入场并在一点八秒内结束', t => {
  const { document, domReady, advance } = setup(t);
  domReady();
  advance(1100);
  assert.equal(document.getElementById('intro-title').textContent, 'Arata66 の Blog');
  const intro = document.getElementById('relume-intro');
  assert.equal(intro.classList.contains('fade-out'), false);
  advance(300);
  assert.equal(intro.classList.contains('fade-out'), true);
  assert.notEqual(intro.style.display, 'none');
  advance(400);
  assert.equal(intro.style.display, 'none');
});

test('当正文准备好而音乐天气未完成时应该结束加载遮罩并允许滚动', t => {
  const { document, domReady, advance } = setup(t);
  document.body.style.overflow = 'hidden';
  domReady();
  advance(600);
  assert.equal(document.getElementById('loading-box').style.display, 'none');
  assert.equal(document.body.style.overflow, '');
});

test('当慢样式令 DOM 尚未准备好时应该继续遮挡未完成的页面', t => {
  const { document, advance, domReady } = setup(t);
  advance(2000);
  assert.notEqual(document.getElementById('relume-intro').style.display, 'none');
  assert.notEqual(document.getElementById('loading-box').style.display, 'none');
  domReady();
  advance(1800);
  assert.equal(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.getElementById('loading-box').style.display, 'none');
});

test('当静态脚本在 DOM 已准备好后执行时应该正常退场', t => {
  const { document, advance } = setup(t, { ready: 'interactive' });
  advance(1800);
  assert.equal(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.getElementById('loading-box').style.display, 'none');
});

test('当用户设置减少动画时应该直接显示内容且不生成花瓣', t => {
  const { document, domReady, timers } = setup(t, { reduced: true });
  domReady();
  assert.equal(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.getElementById('loading-box').style.display, 'none');
  assert.equal(document.querySelectorAll('.intro-petal').length, 0);
  assert.equal(timers.size, 0);
});

test('当脚本重复初始化时应该保持同一场入场且不重复创建花瓣', t => {
  const { document, domReady, runScripts, advance, timers } = setup(t);
  domReady();
  runScripts();
  domReady();
  advance(300);
  assert.notEqual(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.querySelectorAll('.intro-petal').length, 15);
  assert.equal(document.querySelectorAll('.sakura-loader').length, 1);
  advance(1700);
  assert.equal(timers.size, 0);
});

test('当 Pjax 再次进入首页时应该直接显示正文且不重新播放入场', t => {
  const { document, window, domReady, advance, runScripts, timers } = setup(t);
  domReady();
  advance(1800);
  document.getElementById('relume-intro').outerHTML = introMarkup;
  document.dispatchEvent(new window.Event('pjax:complete'));
  runScripts();
  assert.equal(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.querySelectorAll('.intro-petal').length, 0);
  advance(1000);
  assert.equal(timers.size, 0);
});

test('当 Pjax 完成时应该解除主题预加载器设置的滚动锁', t => {
  const { document, window, domReady, advance } = setup(t);
  domReady();
  advance(1800);
  const box = document.getElementById('loading-box');
  document.body.style.overflow = 'hidden';
  box.classList.remove('loaded');
  document.dispatchEvent(new window.Event('pjax:complete'));
  // 主题的完成回调排在自定义 head 脚本之后；已完成时会直接返回。
  if (!box.classList.contains('loaded')) {
    document.body.style.overflow = '';
    box.classList.add('loaded');
  }
  assert.equal(document.body.style.overflow, '');
});

test('当第三方脚本阻止 DOM 就绪事件时应该通过兜底释放遮罩', t => {
  const { document, advance, timers } = setup(t);
  advance(8000);
  assert.equal(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.getElementById('loading-box').style.display, 'none');
  assert.equal(timers.size, 0);
});

test('当用户从文章页通过 Pjax 首次进入首页时应该直接显示正文', t => {
  const { document, window, domReady, advance, playIntro } = setup(t, { home: false });
  domReady();
  advance(600);
  document.body.insertAdjacentHTML('afterbegin', introMarkup);
  document.dispatchEvent(new window.Event('pjax:complete'));
  playIntro();
  assert.equal(document.getElementById('relume-intro').style.display, 'none');
  assert.equal(document.querySelectorAll('.intro-petal').length, 0);
});

test('当脚本先于正文执行时应该在 DOM 就绪后装饰樱花加载器', t => {
  const { document, domReady } = setup(t, { headFirst: true, nested: true });
  domReady();
  assert.equal(document.querySelectorAll('.sakura-loader').length, 1);
  assert.equal(document.querySelector('.loading-word').parentElement.id, 'loading-box');
});

test('当正文已解析但 DOM 就绪仍被慢资源延迟时应该显示樱花加载器', async t => {
  const { document } = setup(t, { headFirst: true, nested: true });
  await Promise.resolve();
  assert.equal(document.querySelectorAll('.sakura-loader').length, 1);
  assert.equal(document.querySelector('.loading-word').parentElement.id, 'loading-box');
  assert.notEqual(document.getElementById('loading-box').style.display, 'none');
});

test('当直接打开文章且正文就绪时应该立即解除加载遮挡', t => {
  const { document, domReady } = setup(t, { home: false });
  domReady();
  assert.equal(document.getElementById('loading-box').style.display, 'none');
});

test('当主题加载文字嵌套在默认动画内时应该正常替换并退场', t => {
  const page = setup(t, { nested: true });
  page.domReady();
  page.advance(600);
  assert.equal(page.document.getElementById('loading-box').style.display, 'none');
});
