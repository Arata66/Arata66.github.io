const { JSDOM } = require('jsdom');

function enhanceArticleSharing(html) {
  if (!html.includes('post-copyright')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const copyright = document.querySelector('#post .post-copyright');
  const link = copyright?.querySelector('.post-copyright__type a');
  if (!copyright || !link || copyright.querySelector('.article-copy-tools')) {
    dom.window.close();
    return html;
  }
  const url = link.getAttribute('href');
  if (!url || !/^https?:\/\//.test(url)) {
    dom.window.close();
    return html;
  }
  const tools = document.createElement('div');
  tools.className = 'article-copy-tools';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'article-copy';
  button.hidden = true;
  button.textContent = '复制文章链接';
  const status = document.createElement('span');
  status.className = 'article-copy-feedback';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'article-copy-url';
  input.setAttribute('value', url);
  input.readOnly = true;
  input.hidden = true;
  input.setAttribute('aria-label', '文章固定地址');
  tools.append(button, status, input);
  copyright.appendChild(tools);
  // 社交分享与手动复制使用相同地址，不携带搜索词或目录位置。
  const share = document.querySelector('#post .social-share');
  if (share) {
    share.setAttribute('data-url', url);
    for (const [property, attribute] of [['og:image', 'data-image'], ['og:title', 'data-title'], ['og:description', 'data-description']]) {
      const value = document.querySelector(`meta[property="${property}"]`)?.getAttribute('content');
      if (value) share.setAttribute(attribute, value);
    }
  }
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { enhanceArticleSharing };
