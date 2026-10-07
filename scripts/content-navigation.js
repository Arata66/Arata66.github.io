const { JSDOM } = require('jsdom');

function readContentCategories(html) {
  const dom = new JSDOM(html);
  const categories = [...dom.window.document.querySelectorAll('.category-list-link')].flatMap(link => {
    const name = link.textContent.trim();
    const count = Number(link.closest('.category-list-item')?.querySelector('.category-list-count')?.textContent);
    let url;
    try { url = new URL(link.getAttribute('href'), 'https://arata66.top'); } catch { return []; }
    if (!name || !Number.isInteger(count) || count <= 0 || url.origin !== 'https://arata66.top' || !url.pathname.startsWith('/categories/') || url.pathname === '/categories/') return [];
    return [{ name, href: url.pathname, count }];
  });
  dom.window.close();
  return categories;
}

function enhanceContentNavigation(html, categories = []) {
  if (!html.includes('<html')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  let changed = false;
  const collection = document.querySelector('#archive, #category, #tag');
  if (collection && !collection.querySelector('.collection-nav')) {
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '/';
    const pathname = new URL(canonical, 'https://arata66.top').pathname.replace(/\/page\/\d+\/$/, '/');
    const nav = document.createElement('nav');
    nav.className = 'collection-nav';
    nav.setAttribute('aria-label', '文章浏览');
    const caption = document.createElement('span');
    caption.className = 'collection-nav-caption';
    caption.textContent = '换个方向逛逛';
    nav.appendChild(caption);
    const links = document.createElement('div');
    links.className = 'collection-nav-links';
    const items = [{ name: '全部文章', href: '/archives/', count: 0 }, ...categories, { name: '按标签找', href: '/tags/', count: 0 }];
    for (const item of items) {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.name;
      if (item.count > 0) {
        link.setAttribute('aria-label', `${item.name}，${item.count}篇文章`);
        const count = document.createElement('span');
        count.className = 'collection-nav-count';
        count.setAttribute('aria-hidden', 'true');
        count.textContent = String(item.count);
        link.appendChild(count);
      }
      if (pathname === item.href) link.setAttribute('aria-current', 'page');
      else if (item.href === '/tags/' && pathname.startsWith('/tags/')) link.setAttribute('aria-current', 'location');
      links.appendChild(link);
    }
    nav.appendChild(links);
    collection.prepend(nav);
    if (collection.id === 'archive') {
      const title = collection.querySelector('.article-sort-title');
      const count = title?.textContent.match(/-\s*(\d+)\s*$/)?.[1];
      const range = pathname === '/archives/' ? '全部文章' : document.querySelector('#page-header h1')?.textContent.trim();
      if (title && count && range) title.textContent = `${range} · ${count}篇`;
    }
    changed = true;
  }
  const list = document.querySelector('#recent-posts .recent-post-items');
  if (document.querySelector('#page-header.full_page') && list && !list.querySelector('.home-discovery')) {
    const nav = document.createElement('nav');
    nav.className = 'home-discovery';
    nav.setAttribute('aria-label', '文章与订阅');
    nav.innerHTML = '<span class="home-discovery-title">随便逛逛</span>' +
      '<div class="home-discovery-links">' +
      '<a href="/categories/%E6%8A%80%E6%9C%AF/">学习与折腾</a>' +
      '<a href="/categories/%E7%94%9F%E6%B4%BB/">生活随笔</a>' +
      '<a href="/archives/">所有文章</a>' +
      '<a href="/subscribe/" class="home-subscribe-link"><i class="fas fa-rss" aria-hidden="true"></i> 订阅更新</a></div>';
    list.prepend(nav);
    changed = true;
  }
  const footer = document.querySelector('#footer .footer_custom_text');
  if (footer && !footer.querySelector('.footer-content-links')) {
    const nav = document.createElement('nav');
    nav.className = 'footer-content-links';
    nav.setAttribute('aria-label', '更多内容入口');
    nav.innerHTML = '<a href="/archives/">文章归档</a><a href="/subscribe/">订阅更新</a>';
    footer.prepend(nav);
    changed = true;
  }
  if (!document.querySelector('link[rel="alternate"][type="application/atom+xml"]')) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.type = 'application/atom+xml';
    link.href = '/atom.xml';
    link.title = 'Arata66 の Blog';
    document.head.appendChild(link);
    changed = true;
  }
  // 普通链接随构建输出，关闭脚本或 Pjax 返回时也可以使用。
  const result = changed ? dom.serialize() : html;
  dom.window.close();
  return result;
}

module.exports = { enhanceContentNavigation, readContentCategories };
