const { JSDOM } = require('jsdom');

function articlePath(value) {
  if (typeof value !== 'string' || value.includes('\\') || [...value].some(char => char.charCodeAt(0) <= 32)) return null;
  let pathname;
  try {
    const raw = value.replace(/^https:\/\/arata66\.top(?=\/)/, '').split(/[?#]/)[0];
    if (!/^\/\d{4}\/\d{2}\/\d{2}\/[^/].*\/$/.test(raw) || raw.startsWith('//')) return null;
    const decoded = decodeURIComponent(raw);
    if (decoded.includes('\\') || [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || decoded.split('/').some(part => part === '.' || part === '..')) return null;
    const url = new URL(value, 'https://arata66.top');
    if (url.origin !== 'https://arata66.top') return null;
    pathname = url.pathname;
  } catch { return null; }
  return pathname;
}

function readArticleCatalog(xml) {
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  const seen = new Set();
  const catalog = [...dom.window.document.querySelectorAll('entry')].flatMap(entry => {
    if (entry.querySelector('kind')?.textContent === 'journal') return [];
    const pathname = articlePath(entry.querySelector('url')?.textContent.trim());
    const title = entry.querySelector('title')?.textContent.trim();
    if (!pathname || !title || seen.has(pathname)) return [];
    seen.add(pathname);
    return [{ path: pathname, title, date: pathname.slice(1, 11).replaceAll('/', '-'), category: entry.querySelector('categories category')?.textContent.trim() || '' }];
  });
  dom.window.close();
  return catalog;
}

function enhanceReadingList(html, catalog) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const articles = new Map(catalog.map(item => [item.path, item]));
  let changed = false;
  function addActions(parent, item, toolbar = false) {
    const row = document.createElement('div');
    row.className = toolbar ? 'reading-toolbar' : 'reading-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.hidden = true;
    button.setAttribute('data-reading-toggle', '');
    button.setAttribute('data-reading-path', item.path);
    button.setAttribute('data-reading-title', item.title);
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `稍后读：${item.title}`);
    button.textContent = '加入稍后读';
    row.appendChild(button);
    if (toolbar) {
      const link = document.createElement('a');
      link.href = '/reading-list/';
      link.textContent = '查看稍后读';
      row.appendChild(link);
    }
    const status = document.createElement('span');
    status.className = 'reading-action-status';
    status.setAttribute('role', 'status');
    row.appendChild(status);
    if (toolbar) parent.before(row);
    else parent.appendChild(row);
    changed = true;
  }
  for (const info of document.querySelectorAll('.recent-post-item .recent-post-info')) {
    const item = articles.get(articlePath(info.querySelector('.article-title')?.getAttribute('href')));
    if (item && !info.querySelector('.reading-actions')) addActions(info, item);
  }
  const article = document.querySelector('#post #article-container');
  const current = articles.get(articlePath(document.querySelector('link[rel="canonical"]')?.getAttribute('href')));
  if (article && current && !document.querySelector('#post .reading-toolbar')) addActions(article, current, true);
  const page = document.querySelector('.reading-list-page');
  if (page) {
    let script = page.querySelector('#reading-catalog');
    const json = JSON.stringify(catalog).replaceAll('<', '\\u003c');
    if (!script) {
      script = document.createElement('script');
      script.id = 'reading-catalog';
      script.setAttribute('type', 'application/json');
      page.appendChild(script);
      changed = true;
    }
    if (script.textContent !== json) { script.textContent = json; changed = true; }
  }
  const result = changed ? dom.serialize() : html;
  dom.window.close();
  return result;
}

module.exports = { readArticleCatalog, enhanceReadingList };
