const { JSDOM } = require('jsdom');

function enhanceHomeOverview(html) {
  if (!html.includes('recent-post-items')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const content = document.querySelector('#content-inner');
  const posts = document.getElementById('recent-posts');
  const list = posts?.querySelector('.recent-post-items');
  const hero = document.querySelector('#page-header.full_page');
  const identity = hero?.querySelector('#site-info');
  let rootPage = false;
  try { rootPage = new URL(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).pathname === '/'; } catch { /* 元数据不全时沿用原首页。 */ }
  const cards = [...(list?.querySelectorAll(':scope > .recent-post-item:not(.ads-wrap)') || [])];
  if (!rootPage || !content || !posts || !identity || !cards.length || content.classList.contains('home-overview')) {
    dom.window.close();
    return html;
  }
  function node(tag, className, text = '') {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
  function link(text, href, className = '') {
    const element = node('a', className, text);
    element.setAttribute('href', href);
    return element;
  }
  hero.classList.add('home-hero');
  content.classList.add('home-overview');
  const subtitle = identity.querySelector('#site-subtitle');
  if (subtitle) { subtitle.setAttribute('aria-hidden', 'true'); identity.prepend(subtitle); }
  identity.querySelector('#site_social_icons')?.remove();
  const intro = node('p', 'home-hero-intro', 'Java 学习者 / 二次元爱好者');
  intro.append(document.createElement('br'), document.createTextNode('在这里记录学习、兴趣和日常的折腾。'));
  const actions = node('nav', 'home-hero-links');
  actions.setAttribute('aria-label', '从这里开始');
  actions.append(link('读最近文章', '#home-posts', 'home-read-link'), link('关于我', '/about/'), link('GitHub ↗', 'https://github.com/Arata66'));
  identity.append(intro, actions);

  // 按原文日期排序，让新的记录优先于较早的精选文章。
  const published = card => Date.parse(card.querySelector('time[datetime]')?.getAttribute('datetime')) || 0;
  cards.sort((a, b) => published(b) - published(a));
  list.querySelectorAll('.home-post-heading').forEach(heading => heading.remove());
  const latest = node('section', 'home-latest');
  latest.id = 'home-latest';
  latest.setAttribute('aria-labelledby', 'home-posts');
  const heading = node('header', 'home-reading-heading');
  const title = node('h2', '', '最近文章');
  title.id = 'home-posts';
  title.setAttribute('tabindex', '-1');
  heading.append(title, link('文章归档 →', '/archives/'));
  const lead = cards.shift();
  lead.classList.add('home-lead-post');
  latest.append(heading, lead);
  for (const card of cards) list.appendChild(card);
  const pagination = list.querySelector('#pagination');
  if (pagination) list.appendChild(pagination);
  const moreTitle = node('h2', 'home-post-heading', '继续阅读');
  if (cards.length) posts.prepend(moreTitle);

  let aside = document.getElementById('aside-content');
  if (!aside) { aside = node('aside', 'aside-content'); aside.id = 'aside-content'; }
  const originalWidgets = [...aside.childNodes];
  const journal = posts.querySelector('.journal-preview');
  if (journal) aside.appendChild(journal);
  const interests = node('nav', 'home-interest-links');
  interests.setAttribute('aria-label', '音乐与工具');
  for (const [name, description, href] of [['音乐馆', '听一会儿喜欢的歌', '/music/'], ['随手工具', 'JSON 处理与时间转换', '/tools/']]) {
    const entry = link('', href);
    const text = node('span', '');
    text.append(node('strong', '', name), node('small', '', description));
    const arrow = node('span', 'home-interest-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    entry.append(text, arrow);
    interests.appendChild(entry);
  }
  aside.appendChild(interests);
  const terminal = node('details', 'home-terminal-shell');
  terminal.append(node('summary', '', '终端小角落'));
  const slot = node('div', 'home-terminal-slot');
  slot.setAttribute('data-home-terminal-slot', '');
  terminal.appendChild(slot);
  const noScript = document.createElement('noscript');
  noScript.textContent = '启用 JavaScript 后可以输入命令浏览博客，文章和各栏目也可直接点击。';
  terminal.appendChild(noScript);
  aside.appendChild(terminal);
  if (originalWidgets.length) {
    const details = node('details', 'home-site-details');
    details.append(node('summary', '', '站点信息'));
    const body = node('div', 'home-site-details-body');
    body.append(...originalWidgets);
    details.appendChild(body);
    aside.appendChild(details);
  }
  content.prepend(latest);
  content.insertBefore(aside, posts);
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { enhanceHomeOverview };
