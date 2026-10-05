const { JSDOM } = require('jsdom');

function enhanceContentNavigation(html) {
  if (!html.includes('<html')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  let changed = false;
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

module.exports = { enhanceContentNavigation };
