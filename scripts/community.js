const fs = require('node:fs');
const yaml = require('js-yaml');
const { JSDOM } = require('jsdom');

function readSiteCard(file, siteUrl) {
  const origin = new URL(siteUrl).origin;
  const groups = yaml.load(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(groups) ? groups.flatMap(group => Array.isArray(group?.link_list) ? group.link_list : []) : [];
  const own = entries.find(entry => {
    try { const url = new URL(entry.link); return url.origin === origin && url.pathname === '/'; }
    catch { return false; }
  });
  if (!own || ['name', 'link', 'avatar', 'descr'].some(key => typeof own[key] !== 'string' || !own[key].trim())) throw new Error('友链数据缺少完整的本站信息');
  const avatar = new URL(own.avatar, siteUrl);
  if (avatar.protocol !== 'https:' || avatar.username || avatar.password) throw new Error('本站头像须为HTTPS图片地址');
  return { name: own.name, url: new URL(own.link).href, avatar: avatar.href, description: own.descr };
}

function enhanceCommunity(html, card) {
  if (!html.includes('data-community-card')) return html;
  const dom = new JSDOM(html);
  const document = dom.window.document;
  for (const slot of document.querySelectorAll('[data-community-card]')) {
    const input = document.createElement('textarea');
    input.className = 'community-site-info';
    input.readOnly = true;
    input.rows = 5;
    input.setAttribute('aria-label', '本站友链信息');
    input.textContent = `名称：${card.name}\n地址：${card.url}\n头像：${card.avatar}\n简介：${card.description}`;
    const button = document.createElement('button');
    button.className = 'community-copy';
    button.type = 'button';
    button.hidden = true;
    button.textContent = '复制本站信息';
    const status = document.createElement('p');
    status.className = 'community-feedback';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = '也可以选中上方信息手动复制。';
    // 替换固定容器，让只改link.yml的增量构建也能同步信息。
    slot.replaceChildren(input, button, status);
  }
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { readSiteCard, enhanceCommunity };
