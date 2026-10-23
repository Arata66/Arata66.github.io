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
  const entries = readJournal(dataPath);
  const document = new JSDOM(enhanceJournal(page, entries)).window.document;
  assert.equal(document.querySelectorAll('[data-journal-entry]').length, 3);
  assert.deepEqual([...document.querySelectorAll('time')].map(el => el.dateTime), ['2026-06-29', '2026-06-29', '2026-06-29']);
  assert.deepEqual([...document.querySelectorAll('.journal-source')].map(el => el.getAttribute('href')), ['/2026/06/29/my-playlist/', '/2026/06/29/otakulog/', '/2026/06/29/Coming/']);
  assert.match(document.body.textContent, /旧文摘录/);
  assert.equal(document.querySelector('[data-journal-filters]').hasAttribute('hidden'), true);
  assert.ok([...document.querySelectorAll('[data-journal-entry]')].every(el => !el.hasAttribute('hidden')));
});

test('当首页加入手账预览时应该保留文章并在重复构建时不重复插入', () => {
  const entries = readJournal(dataPath);
  const enhanced = enhanceJournal(home, entries);
  const document = new JSDOM(enhanced).window.document;
  assert.equal(document.querySelectorAll('.journal-preview').length, 1);
  assert.equal(document.querySelectorAll('.recent-post-item').length, 1);
  assert.ok(document.querySelector('.journal-preview a[href="/journal/"]'));
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
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url: 'https://arata66.top/journal/' });
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
  assert.equal(document.querySelectorAll('[data-journal-entry]:not([hidden])').length, 3);
  document.body.innerHTML = new JSDOM(markup).window.document.body.innerHTML;
  document.dispatchEvent(new window.Event('pjax:complete'));
  const life = document.querySelector('button[data-journal-filter="生活"]');
  assert.ok(life instanceof window.HTMLButtonElement);
  life.click();
  assert.equal(document.querySelectorAll('[data-journal-entry]:not([hidden])').length, 1);
  assert.match(document.querySelector('[data-journal-entry]:not([hidden])').textContent, /几句话/);
});
