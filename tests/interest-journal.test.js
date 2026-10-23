const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { readJournal, enhanceJournal } = require('../scripts/interest-journal');

const dataPath = path.join(__dirname, '../source/_data/journal.yml');
const page = '<!DOCTYPE html><html><body><div id="journal-page"></div></body></html>';
const home = '<!DOCTYPE html><html><body><header id="page-header" class="full_page"></header><div id="recent-posts"><div class="recent-post-items"><article class="recent-post-item"><a href="/archives/">原文章</a></article></div></div></body></html>';

test('当首版采用旧文摘录时应该保留原日期与可访问来源且不冒充当前近况', () => {
  const entries = readJournal(dataPath).filter(entry => entry.origin === 'excerpt');
  const document = new JSDOM(enhanceJournal(page, entries)).window.document;
  assert.equal(document.querySelectorAll('[data-journal-entry]').length, 3);
  assert.deepEqual([...document.querySelectorAll('time')].map(el => el.dateTime), ['2026-06-29', '2026-06-29', '2026-06-29']);
  assert.deepEqual([...document.querySelectorAll('.journal-source')].map(el => el.getAttribute('href')), ['/2026/06/29/my-playlist/', '/2026/06/29/otakulog/', '/2026/06/29/Coming/']);
  assert.match(document.body.textContent, /旧文摘录/);
  assert.equal(document.querySelector('[data-journal-filters]').hasAttribute('hidden'), true);
  assert.ok([...document.querySelectorAll('[data-journal-entry]')].every(el => !el.hasAttribute('hidden')));
});

test('当原创新近况与旧文摘录混排时应该区分记录日期和来源且无脚本也能阅读', () => {
  const entries = readJournal(dataPath);
  const document = new JSDOM(enhanceJournal(page, entries)).window.document;
  const notes = [...document.querySelectorAll('[data-journal-origin="original"]')];
  assert.equal(notes.length, 3);
  assert.equal(document.querySelectorAll('[data-journal-entry]').length, 6);
  assert.deepEqual(notes.map(el => el.querySelector('time').dateTime), ['2026-10-23', '2026-10-23', '2026-10-23']);
  assert.ok(notes.every(el => !el.querySelector('.journal-source') && el.textContent.includes('近况短记')));
  assert.equal(document.querySelectorAll('.journal-source').length, 3);
  assert.ok([...document.querySelectorAll('[data-journal-entry]')].every(el => !el.hasAttribute('hidden')));
  assert.match(document.querySelector('.journal-origin').textContent, /近况.*记录日期.*旧文摘录.*原文日期/);
  assert.match(notes[0].textContent, /我刷到的评价基本都在喷/);
  assert.match(notes[1].textContent, /太对我胃口辣😋/);
  assert.match(notes[2].textContent, /10 月 29 日/);
});

test('当首页加入手账预览时应该保留文章并在重复构建时不重复插入', () => {
  const entries = readJournal(dataPath);
  const enhanced = enhanceJournal(home, entries);
  const document = new JSDOM(enhanced).window.document;
  assert.equal(document.querySelectorAll('.journal-preview').length, 1);
  assert.equal(document.querySelectorAll('.recent-post-item').length, 1);
  assert.ok(document.querySelector('.journal-preview a[href="/journal/"]'));
  assert.deepEqual([...document.querySelectorAll('.journal-entry-title')].map(el => el.textContent), ['没有网上说的那么差', '物语系列，太对胃口辣', '偶尔 OW，等着影之刃零']);
  assert.equal(document.querySelector('.journal-preview .journal-source'), null);
  assert.doesNotMatch(document.querySelector('.journal-origin').textContent, /旧文摘录/);
  assert.equal(enhanceJournal(enhanced, entries), enhanced);
  assert.equal(enhanceJournal(enhanceJournal(page, entries), entries), enhanceJournal(page, entries));
  assert.equal(enhanceJournal('<main>普通页面</main>', entries), '<main>普通页面</main>');
});

test('当摘录含有特殊字符时应该作为纯文本展示', () => {
  const entries = readJournal(dataPath);
  entries[0].text = '<script>不会执行</script>';
  const document = new JSDOM(enhanceJournal(page, entries)).window.document;
  assert.equal(document.querySelector('script'), null);
  assert.ok(document.body.textContent.includes('<script>不会执行</script>'));
});

test('当用户筛选与返回手账页时应该正确显示数量并能切回全部', t => {
  const entries = readJournal(dataPath);
  const markup = enhanceJournal(page, entries);
  const dom = new JSDOM(markup, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://arata66.top/journal/' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const script = fs.readFileSync(path.join(__dirname, '../source/js/interest-journal.js'), 'utf8');
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  window.document.dispatchEvent(new window.Event('pjax:complete'));
  const document = window.document;
  assert.equal(document.querySelector('[data-journal-filters]').hasAttribute('hidden'), false);
  const music = document.querySelector('button[data-journal-filter="听歌"]');
  assert.ok(music instanceof window.HTMLButtonElement);
  music.click();
  assert.equal(document.querySelectorAll('[data-journal-entry]:not([hidden])').length, 1);
  assert.equal(music.getAttribute('aria-pressed'), 'true');
  assert.match(document.querySelector('[role="status"]').textContent, /听歌.*1 条/);
  const all = document.querySelector('button[data-journal-filter="all"]');
  assert.ok(all instanceof window.HTMLButtonElement);
  all.click();
  assert.equal(document.querySelectorAll('[data-journal-entry]:not([hidden])').length, 6);
  const anime = document.querySelector('button[data-journal-filter="追番"]');
  assert.ok(anime instanceof window.HTMLButtonElement);
  anime.click();
  assert.equal(document.querySelectorAll('[data-journal-entry]:not([hidden])').length, 2);
  assert.match(document.querySelector('[role="status"]').textContent, /追番.*2 条/);
  document.body.innerHTML = new JSDOM(markup).window.document.body.innerHTML;
  document.dispatchEvent(new window.Event('pjax:complete'));
  const life = document.querySelector('button[data-journal-filter="生活"]');
  assert.ok(life instanceof window.HTMLButtonElement);
  life.click();
  assert.equal(document.querySelectorAll('[data-journal-entry]:not([hidden])').length, 1);
  assert.match(document.querySelector('[data-journal-entry]:not([hidden])').textContent, /几句话/);
});

test('当从搜索或锚点访问被筛选隐藏的短记时应该恢复可见并定位且普通进入不抢焦点', t => {
  const markup = enhanceJournal(page, readJournal(dataPath));
  const dom = new JSDOM(markup, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://arata66.top/journal/' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const positions = [];
  window.HTMLElement.prototype.scrollIntoView = function () { positions.push(this.id); };
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/interest-journal.js'), 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  assert.deepEqual(positions, []);
  const music = window.document.querySelector('button[data-journal-filter="听歌"]');
  assert.ok(music instanceof window.HTMLButtonElement);
  music.click();
  window.document.dispatchEvent(new window.CustomEvent('journal:reveal', { detail: '#journal-monogatari' }));
  assert.equal(window.document.querySelector('#journal-monogatari').hasAttribute('hidden'), false);
  assert.equal(window.document.activeElement.id, 'journal-monogatari');
  assert.equal(positions.at(-1), 'journal-monogatari');
  assert.match(window.document.querySelector('[role="status"]').textContent, /全部.*6 条/);
  window.history.replaceState({}, '', '/journal/#journal-waiting-for-phantom-blade-zero');
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  assert.equal(window.document.activeElement.id, 'journal-waiting-for-phantom-blade-zero');
  window.document.dispatchEvent(new window.Event('pjax:complete'));
  assert.equal(positions.at(-1), 'journal-waiting-for-phantom-blade-zero');
});

test('当真实 Pjax 完成自己的锚点滚动后应该最终保留手账顶部间距且过期定位不影响新位置', t => {
  const dom = new JSDOM(enhanceJournal(page, readJournal(dataPath)), { runScripts: 'outside-only', url: 'https://arata66.top/' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const calls = [];
  const frames = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  window.scrollTo = (...args) => { calls.push(['Pjax', args[1]]); };
  window.HTMLElement.prototype.scrollIntoView = function (options) { calls.push([this.id, options.behavior]); };
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/interest-journal.js'), 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const target = window.document.getElementById('journal-monogatari');
  Object.defineProperty(target, 'offsetParent', { value: window.document.body });
  Object.defineProperty(target, 'offsetTop', { value: 1777 });
  window.eval(fs.readFileSync(path.join(__dirname, '../source/js/vendor/pjax.min.js'), 'utf8'));
  const pjax = new window.Pjax({ elements: 'a', selectors: [], analytics: false, cacheBust: false });
  pjax.state = { numPendingSwitches: 1, href: 'https://arata66.top/journal/?highlight=物语#journal-monogatari', options: { history: true, title: '手账', analytics: false, scrollTo: 0 } };
  pjax.onSwitch();
  while (frames.length) frames.shift()(0);
  assert.deepEqual(calls.at(-1), ['journal-monogatari', 'instant']);
  calls.length = 0;
  window.document.dispatchEvent(new window.Event('pjax:complete'));
  window.history.replaceState({}, '', '/journal/#journal-sana');
  while (frames.length) frames.shift()(0);
  assert.deepEqual(calls, []);
});
