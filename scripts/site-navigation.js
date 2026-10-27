const { JSDOM } = require('jsdom');

function enhanceSiteNavigation(html) {
  if (!html.includes('menus_items')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const pathname = new URL(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '/', 'https://arata66.top').pathname;
  const trigger = document.getElementById('toggle-menu');
  if (trigger) {
    const button = document.createElement('button');
    for (const attribute of trigger.attributes) button.setAttribute(attribute.name, attribute.value);
    button.type = 'button';
    button.setAttribute('aria-label', '打开站点导航');
    button.setAttribute('aria-controls', 'sidebar-menus');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = trigger.innerHTML;
    button.querySelectorAll('i').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
    trigger.replaceWith(button);
  }
  for (const root of document.querySelectorAll('#nav .menus_items, #sidebar-menus .menus_items')) {
    for (const group of root.querySelectorAll('.menus_item > .group')) {
      const item = group.parentElement;
      const details = document.createElement('details');
      details.className = 'menus_item';
      details.setAttribute('data-site-menu', '');
      const summary = document.createElement('summary');
      summary.className = 'site-page';
      summary.innerHTML = group.innerHTML;
      details.append(summary, ...Array.from(item.children).filter(child => child !== group));
      item.replaceWith(details);
    }
    for (const link of root.querySelectorAll('a[href]')) {
      const href = new URL(link.getAttribute('href'), 'https://arata66.top').pathname;
      link.removeAttribute('aria-current');
      if (pathname === href) link.setAttribute('aria-current', 'page');
      else if (href !== '/' && pathname.startsWith(href)) link.setAttribute('aria-current', 'location');
    }
    for (const details of root.querySelectorAll('details[data-site-menu]')) {
      const article = document.querySelector('#post') && details.querySelector('a[href="/archives/"]');
      details.querySelector('summary').toggleAttribute('data-current', Boolean(article || details.querySelector('[aria-current]')));
      details.querySelectorAll('i').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
    }
  }
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { enhanceSiteNavigation };
