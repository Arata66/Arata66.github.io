const fs = require('node:fs');
const yaml = require('js-yaml');
const { JSDOM } = require('jsdom');

function readJournal(file) {
  const data = yaml.load(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error('手账内容必须是列表');
  const ids = new Set();
  return data.map(entry => {
    for (const key of ['id', 'category', 'title', 'date', 'text', 'origin']) {
      if (typeof entry?.[key] !== 'string' || !entry[key].trim()) throw new Error(`手账缺少有效字段：${key}`);
    }
    if (!['original', 'excerpt'].includes(entry.origin)) throw new Error('手账来源类型必须是原创或摘录');
    if (entry.origin === 'excerpt') {
      for (const key of ['sourceTitle', 'sourceUrl']) {
        if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`旧文摘录缺少有效字段：${key}`);
      }
    }
    if (!/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id)) throw new Error('手账编号无效或重复');
    ids.add(entry.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date) throw new Error('手账日期无效');
    for (const url of [entry.sourceUrl, entry.cover].filter(Boolean)) {
      if (typeof url !== 'string' || !/^\/(?!\/)[a-zA-Z0-9/_%.-]+$/.test(url) || url.includes('..')) throw new Error('手账来源和封面必须是站内路径');
    }
    return { id: entry.id, origin: entry.origin, category: entry.category, title: entry.title, date: entry.date, text: entry.text, cover: entry.cover || '', sourceTitle: entry.sourceTitle || '', sourceUrl: entry.sourceUrl || '' };
  });
}

function enhanceJournal(html, entries) {
  if (!html.includes('journal-page') && !html.includes('recent-posts')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const page = document.getElementById('journal-page');
  const home = document.querySelector('#page-header.full_page') && document.querySelector('#recent-posts');
  if ((!page && !home) || document.querySelector('[data-journal]')) {
    dom.window.close();
    return html;
  }
  const preview = !page;
  const visibleEntries = entries.slice(0, preview ? 3 : entries.length);
  const root = document.createElement('section');
  root.className = preview ? 'journal journal-preview' : 'journal journal-full';
  root.setAttribute('data-journal', preview ? 'preview' : 'page');
  root.setAttribute('aria-labelledby', 'journal-heading');
  function element(tag, className, text = '') {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  const header = element('header', 'journal-header');
  const headingGroup = element('div', 'journal-heading-group');
  headingGroup.append(element('p', 'journal-kicker', [...new Set(visibleEntries.map(entry => entry.category))].join(' · ')));
  const heading = element('h2', 'journal-heading', preview ? '兴趣手账' : '把喜欢的事，记在这里');
  heading.id = 'journal-heading';
  headingGroup.append(heading, element('p', 'journal-intro', '一些喜欢的事，一些折腾，还有生活里的小片段。'));
  header.append(headingGroup);
  if (preview) {
    const link = element('a', 'journal-open', '翻开手账 →');
    link.setAttribute('href', '/journal/');
    header.append(link);
  }
  root.append(header);
  const hasOriginal = visibleEntries.some(entry => entry.origin === 'original');
  const hasExcerpt = visibleEntries.some(entry => entry.origin === 'excerpt');
  const dateNote = hasOriginal && hasExcerpt
    ? '近况使用记录日期，旧文摘录保留原文日期'
    : hasOriginal ? '近况短记 · 日期为记录日期' : '旧文摘录 · 日期为原文发表日期';
  root.append(element('p', 'journal-origin', dateNote));
  if (!preview) {
    const filters = element('div', 'journal-filters');
    filters.setAttribute('data-journal-filters', '');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', '按兴趣筛选手账');
    filters.setAttribute('hidden', '');
    for (const category of ['all', ...new Set(entries.map(entry => entry.category))]) {
      const button = element('button', 'journal-filter', category === 'all' ? '全部' : category);
      button.setAttribute('type', 'button');
      button.setAttribute('data-journal-filter', category);
      button.setAttribute('aria-pressed', String(category === 'all'));
      filters.append(button);
    }
    const status = element('p', 'journal-status', `全部 · ${entries.length} 条记录`);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    root.append(filters, status);
  }
  const list = element('div', 'journal-entries');
  visibleEntries.forEach((entry, index) => {
    const article = element('article', 'journal-entry');
    article.id = `journal-${entry.id}`;
    article.setAttribute('data-journal-entry', entry.category);
    article.setAttribute('data-journal-origin', entry.origin);
    if (index === 0 && entry.cover) {
      article.classList.add('journal-entry-with-cover');
      const image = element('img', 'journal-cover no-lightbox');
      image.setAttribute('src', entry.cover);
      image.setAttribute('alt', '');
      image.setAttribute('loading', 'lazy');
      image.setAttribute('width', '720');
      image.setAttribute('height', '480');
      article.append(image);
    }
    const body = element('div', 'journal-entry-body');
    const meta = element('div', 'journal-meta');
    const time = element('time', '', entry.date.replaceAll('-', '.'));
    time.setAttribute('datetime', entry.date);
    meta.append(element('span', 'journal-category', entry.category), time);
    const title = element('h3', 'journal-entry-title', entry.title);
    body.append(meta, title, element('p', 'journal-text', entry.text));
    if (entry.origin === 'excerpt') {
      const source = element('a', 'journal-source', `摘自《${entry.sourceTitle}》 ↗`);
      source.setAttribute('href', entry.sourceUrl);
      body.append(source);
    } else {
      body.append(element('p', 'journal-note-label', '近况短记'));
    }
    article.append(body);
    list.append(article);
  });
  root.append(list);
  if (page) page.append(root);
  else home.prepend(root);
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { readJournal, enhanceJournal };
