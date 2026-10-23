const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { deferLightboxScript } = require('../scripts/cache-bust');

const scriptPath = path.join(__dirname, '../source/js/lightbox-loader.js');

function setup(t, fail = false) {
  const dom = new JSDOM('<script data-fancybox-src="https://example.test/fancybox.js"></script><img src="/image.webp">', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  Object.defineProperty(window.document, 'currentScript', { value: window.document.querySelector('script') });
  const requests = [], galleries = [];
  window.btf = {
    loadLightbox: images => galleries.push(images),
    getScript: url => {
      requests.push(url);
      if (fail) return Promise.reject(new Error('服务不可用'));
      window.Fancybox = {};
      return Promise.resolve();
    }
  };
  if (fs.existsSync(scriptPath)) window.eval("const GLOBAL_CONFIG = { lightbox: 'fancybox' };\n" + fs.readFileSync(scriptPath, 'utf8'));
  return { window, requests, galleries, image: window.document.querySelector('img') };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

function openViewer(app) {
  const { document } = app.window;
  const opener = document.createElement('a'); opener.href = '/image.webp';
  document.body.appendChild(opener);
  const viewer = document.createElement('div'); viewer.className = 'fancybox__container'; viewer.tabIndex = 0;
  document.body.appendChild(viewer); document.body.classList.add('hide-scrollbar'); viewer.focus();
  const options = { placeFocusBack: true };
  let current = {
    getOptions: () => options,
    destroy: () => {
      viewer.remove(); document.body.classList.remove('hide-scrollbar'); current = null;
      if (options.placeFocusBack) opener.focus();
    }
  };
  app.window.Fancybox = { getInstance: () => current };
  return { document, opener };
}

test('当页面没有正文图片时应该不请求灯箱脚本', t => {
  const app = setup(t);
  app.window.btf.loadLightbox([]);
  assert.equal(app.requests.length, 0);
  assert.equal(app.galleries.length, 0);
});

test('当页面有正文图片时应该先加载灯箱再启用图库', async t => {
  const app = setup(t);
  app.window.btf.loadLightbox([app.image]);
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.galleries.length, 1);
  assert.equal(app.galleries[0][0], app.image);
});

test('当灯箱加载失败时应该保留图片并允许下次重试', async t => {
  const app = setup(t, true);
  app.window.btf.loadLightbox([app.image]); await flush();
  app.window.btf.loadLightbox([app.image]); await flush();
  assert.equal(app.requests.length, 2);
  assert.equal(app.galleries.length, 0);
  assert.equal(app.image.getAttribute('src'), '/image.webp');
});

test('当等待灯箱时已切换页面应该不处理离开的图片', async t => {
  const app = setup(t);
  app.window.btf.loadLightbox([app.image]);
  app.image.remove(); await flush();
  assert.equal(app.galleries.length, 0);
});

test('当图片打开期间切换文章时应该清除图库与滚动锁且不恢复旧图片焦点', t => {
  const app = setup(t);
  const { document, opener } = openViewer(app);
  document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(document.querySelector('.fancybox__container'), null);
  assert.equal(document.body.classList.contains('hide-scrollbar'), false);
  assert.notEqual(document.activeElement, opener);
  const nextImage = document.createElement('img'); document.body.appendChild(nextImage);
  app.window.btf.loadLightbox([nextImage]);
  assert.equal(app.galleries[0][0], nextImage);
  assert.equal(app.requests.length, 0);
});

test('当等待切页期间又打开旧图片时应该在切页完成后清理且不回焦旧图片', t => {
  const app = setup(t);
  app.window.document.dispatchEvent(new app.window.Event('pjax:send'));
  const { document, opener } = openViewer(app);
  document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(document.querySelector('.fancybox__container'), null);
  assert.equal(document.body.classList.contains('hide-scrollbar'), false);
  assert.notEqual(document.activeElement, opener);
  document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.notEqual(document.activeElement, opener);
});

test('当切页前尚未加载图库时应该不为清理而下载脚本', t => {
  const app = setup(t);
  app.window.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.requests.length, 0);
  assert.equal(app.galleries.length, 0);
});

test('当构建页面带有外部灯箱脚本时应该转换为可重复处理的按需入口', () => {
  const input = '<script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@6.1.4/dist/fancybox/fancybox.umd.min.js"></script>';
  assert.equal(typeof deferLightboxScript, 'function');
  const output = deferLightboxScript(input);
  assert.match(output, /data-fancybox-src="https:/);
  assert.match(output, /defer src="\/js\/lightbox-loader.js"/);
  assert.equal(deferLightboxScript(output), output);
});
