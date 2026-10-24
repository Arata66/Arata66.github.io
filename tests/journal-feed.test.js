const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { createJournalFeeds } = require('../scripts/journal-feed');

const articleXml = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>https://arata66.top/</id><title>博客</title><subtitle>文章</subtitle><author><name>Arata66</name></author><updated>2026-10-04T11:20:00.000Z</updated><link rel="self" href="https://arata66.top/atom.xml"/><link rel="alternate" href="https://arata66.top/"/><entry><id>https://arata66.top/article/</id><title>原文章</title><link href="https://arata66.top/article/"/><published>2026-10-03T16:00:00.000Z</published><updated>2026-10-04T11:20:00.000Z</updated><content><![CDATA[<p>原来的文章正文</p>]]></content></entry></feed>`;
const journal = [
  { id: 'old', origin: 'original', category: '游戏', title: '早些时候', date: '2026-09-01', text: '游戏记录' },
  { id: 'new', origin: 'original', category: '追番', title: '喜欢 < & >', date: '2026-10-23', text: '太对胃口辣😋 <script>只是文字</script> & 继续补番' },
  { id: 'excerpt', origin: 'excerpt', category: '生活', title: '旧文摘录', date: '2026-06-29', text: '旧文' }
];

function parse(t, xml) {
  const dom = new JSDOM(xml, { contentType: 'application/xml' });
  t.after(() => dom.window.close());
  return dom.window.document;
}

test('当阅读器订阅手账时应该只收到原创近况并能打开对应短记', t => {
  const document = parse(t, createJournalFeeds(articleXml, journal).journal);
  const entries = [...document.querySelectorAll('entry')];
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => entry.querySelector('id').textContent), ['https://arata66.top/journal/#journal-new', 'https://arata66.top/journal/#journal-old']);
  assert.equal(entries[0].querySelector('link').getAttribute('href'), entries[0].querySelector('id').textContent);
  assert.equal(document.querySelector('feed > link[rel="self"]').getAttribute('href'), 'https://arata66.top/journal.xml');
  assert.equal(document.querySelector('feed > id').textContent, 'https://arata66.top/journal.xml');
  assert.equal(entries[0].querySelector('category').getAttribute('term'), '追番');
  assert.equal(document.querySelector('author name').textContent, 'Arata66');
});

test('当阅读器订阅全部更新时应该按发表日期混排且保留原文章编号和内容', t => {
  const document = parse(t, createJournalFeeds(articleXml, journal).updates);
  const entries = [...document.querySelectorAll('entry')];
  assert.deepEqual(entries.map(entry => entry.querySelector('id').textContent), ['https://arata66.top/journal/#journal-new', 'https://arata66.top/article/', 'https://arata66.top/journal/#journal-old']);
  assert.equal(entries[1].querySelector('content').textContent, '<p>原来的文章正文</p>');
  assert.equal(entries[1].querySelector('content').getAttribute('type'), 'html');
  assert.equal(entries[1].querySelector('updated').textContent, '2026-10-04T11:20:00.000Z');
  assert.equal(document.querySelector('feed > link[rel="self"]').getAttribute('href'), 'https://arata66.top/updates.xml');
});

test('当近况包含表情和标记字符时应该以纯文本安全显示且所有条目使用 Atom 命名空间', t => {
  const document = parse(t, createJournalFeeds(articleXml, journal).journal);
  const entry = document.querySelector('entry');
  assert.equal(entry.querySelector('title').textContent, journal[1].title);
  assert.equal(entry.querySelector('content').textContent, journal[1].text);
  assert.equal(entry.querySelector('content').getAttribute('type'), 'text');
  assert.equal(document.querySelector('script'), null);
  assert.ok([...document.querySelectorAll('*')].every(node => node.namespaceURI === 'http://www.w3.org/2005/Atom'));
});

test('当重复构建或仅修改近况文字时应该保留条目编号与记录日而不使用构建时间', t => {
  const first = createJournalFeeds(articleXml, journal);
  assert.deepEqual(createJournalFeeds(articleXml, journal), first);
  const document = parse(t, first.journal);
  assert.equal(document.querySelector('entry > published').textContent, '2026-10-22T16:00:00.000Z');
  assert.equal(document.querySelector('feed > updated').textContent, '2026-10-22T16:00:00.000Z');
  const changed = parse(t, createJournalFeeds(articleXml, journal.map(note => ({ ...note, text: '修改文字' }))).journal);
  assert.equal(changed.querySelector('entry > id').textContent, document.querySelector('entry > id').textContent);
});

test('当没有原创近况时应该提供合法空手账订阅且全部更新仍包含文章', t => {
  const feeds = createJournalFeeds(articleXml, []);
  const empty = parse(t, feeds.journal);
  assert.equal(empty.querySelectorAll('entry').length, 0);
  assert.equal(empty.querySelector('feed > updated').textContent, '2026-10-04T11:20:00.000Z');
  assert.equal(parse(t, feeds.updates).querySelectorAll('entry').length, 1);
});
