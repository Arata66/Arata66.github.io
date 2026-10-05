const { JSDOM } = require('jsdom');

function enhanceHomeHtml(html) {
  if (!html.includes('recent-post-items')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const list = document.querySelector('#recent-posts .recent-post-items');
  if (!document.querySelector('#page-header.full_page') || !list || list.querySelector('.home-post-heading')) {
    dom.window.close();
    return html;
  }

  const cards = [...list.children].filter(card => card.classList.contains('recent-post-item') && !card.classList.contains('ads-wrap'));
  if (!cards.length) {
    dom.window.close();
    return html;
  }

  let featuredStarted = false;
  let latestStarted = false;
  for (const card of cards) {
    const pin = card.querySelector('.article-title .sticky');
    if (pin) {
      const label = document.createElement('span');
      label.className = 'post-featured-label';
      label.textContent = '精选';
      pin.closest('.article-title').before(label);
      pin.remove();
    }
    if ((pin && !featuredStarted) || (!pin && !latestStarted)) {
      const heading = document.createElement('h2');
      heading.className = 'home-post-heading';
      heading.textContent = pin ? '精选记录' : '最新文章';
      card.before(heading);
      if (pin) featuredStarted = true;
      else latestStarted = true;
    }
  }

  // 在构建阶段写入分组，避免访客加载后才出现标题和布局变化。
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { enhanceHomeHtml };
