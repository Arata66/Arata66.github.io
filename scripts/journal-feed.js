const { JSDOM } = require('jsdom');

const ATOM = 'http://www.w3.org/2005/Atom';

function createJournalFeeds(articleXml, journal) {
  function createFeed(filename, title, subtitle, includeArticles) {
    const dom = new JSDOM(articleXml, { contentType: 'application/xml' });
    try {
      const document = dom.window.document;
      const feed = document.documentElement;
      const siteUrl = feed.querySelector('link[rel="alternate"]').getAttribute('href');
      const feedUrl = new URL(filename, siteUrl).href;
      const entries = [...feed.querySelectorAll(':scope > entry')];
      entries.forEach(entry => entry.remove());
      const articles = includeArticles ? entries : [];
      // 原生成器把 HTML 放入 CDATA；新订阅明确类型，让阅读器渲染正文。
      articles.forEach(entry => {
        const content = entry.querySelector('content');
        if (content && !content.hasAttribute('type')) content.setAttribute('type', 'html');
      });
      function element(tag, text = undefined) {
        const node = document.createElementNS(ATOM, tag);
        if (text !== undefined) node.textContent = text;
        return node;
      }
      const notes = journal.filter(note => note.origin === 'original').map(note => {
        const entry = element('entry');
        const url = new URL(`/journal/#journal-${note.id}`, siteUrl).href;
        // 手账只有记录日，固定用北京时间零点序列化，避免每次构建触发新通知。
        const date = new Date(`${note.date}T00:00:00+08:00`).toISOString();
        entry.append(element('id', url), element('title', note.title), element('published', date), element('updated', date));
        const link = element('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('href', url);
        const category = element('category');
        category.setAttribute('term', note.category);
        const content = element('content', note.text);
        content.setAttribute('type', 'text');
        entry.append(link, category, element('summary', note.text), content);
        return entry;
      });
      const combined = [...articles, ...notes].sort((a, b) => Date.parse(b.querySelector('published').textContent) - Date.parse(a.querySelector('published').textContent));
      feed.querySelector(':scope > id').textContent = feedUrl;
      feed.querySelector(':scope > title').textContent += ` · ${title}`;
      feed.querySelector(':scope > subtitle').textContent = subtitle;
      feed.querySelector('link[rel="self"]').setAttribute('href', feedUrl);
      feed.querySelector('link[rel="alternate"]').setAttribute('href', includeArticles ? siteUrl : new URL('/journal/', siteUrl).href);
      if (combined.length) {
        const latest = Math.max(...combined.map(entry => Date.parse(entry.querySelector('updated').textContent)));
        feed.querySelector(':scope > updated').textContent = new Date(latest).toISOString();
      }
      feed.append(...combined);
      return '<?xml version="1.0" encoding="utf-8"?>\n' + dom.serialize();
    } finally {
      dom.window.close();
    }
  }
  return {
    journal: createFeed('journal.xml', '兴趣手账', '追番、游戏与生活里的原创近况', false),
    updates: createFeed('updates.xml', '全部更新', '新文章与兴趣手账近况', true)
  };
}

module.exports = { createJournalFeeds };
