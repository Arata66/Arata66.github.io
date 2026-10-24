const fs = require('node:fs');
const yaml = require('js-yaml');
const { JSDOM } = require('jsdom');

function validLink(value) {
  if (typeof value !== 'string' || /[\\\s%]/.test(value)) return false;
  if (/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/[a-zA-Z0-9_./-]+$/.test(url.pathname);
  } catch { return false; }
}

function readWorks(file) {
  const data = yaml.load(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data) || !data.length) throw new Error('作品内容必须是非空列表');
  const ids = new Set();
  for (const project of data) {
    for (const field of ['id', 'name', 'kind', 'desc', 'statusText', 'cover', 'coverCaption', 'link', 'linkText']) {
      if (typeof project?.[field] !== 'string' || !project[field].trim()) throw new Error(`作品缺少有效字段：${field}`);
    }
    if (!/^[a-z0-9-]+$/.test(project.id) || ids.has(project.id)) throw new Error('作品编号无效或重复');
    ids.add(project.id);
    if (!/^\/img\/[a-zA-Z0-9/_.-]+$/.test(project.cover) || project.cover.includes('..')) throw new Error('作品封面必须是站内图片');
    if (!Array.isArray(project.tags) || !project.tags.length || project.tags.some(tag => typeof tag !== 'string' || !tag.trim())) throw new Error('作品技术标签必须是非空文字列表');
    if (!Array.isArray(project.features) || !project.features.length || project.features.some(feature => typeof feature?.title !== 'string' || !feature.title.trim() || typeof feature?.text !== 'string' || !feature.text.trim())) throw new Error('作品功能必须包含标题和说明');
    if (!Array.isArray(project.links) || project.links.some(link => typeof link?.text !== 'string' || !link.text.trim())) throw new Error('作品链接必须包含文字');
    if (![project.link, ...project.links.map(link => link.href)].every(validLink)) throw new Error('作品链接必须是站内路径或 GitHub HTTPS 地址');
  }
  return data;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderWorks(projects) {
  function link(href, text, primary = false) {
    const external = href.startsWith('https:');
    return `<a class="works-link${primary ? ' works-link-primary' : ''}" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(text)}<span aria-hidden="true">${external ? '↗' : '→'}</span></a>`;
  }
  const entries = projects.map((project, index) => `<article class="works-project" id="work-${escapeHtml(project.id)}" aria-labelledby="work-${escapeHtml(project.id)}-title">
    <figure class="works-visual"><img class="no-lightbox" src="${escapeHtml(project.cover)}" alt="${escapeHtml(project.coverCaption)}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async"><figcaption>${escapeHtml(project.coverCaption)}</figcaption></figure>
    <div class="works-copy">
      <div class="works-meta"><span>${String(index + 1).padStart(2, '0')} / ${escapeHtml(project.kind)}</span><span class="works-status">${escapeHtml(project.statusText)}</span></div>
      <h2 id="work-${escapeHtml(project.id)}-title">${escapeHtml(project.name)}</h2>
      <p class="works-desc">${escapeHtml(project.desc)}</p>
      <ul class="works-features">${project.features.map(feature => `<li><h3>${escapeHtml(feature.title)}</h3><p>${escapeHtml(feature.text)}</p></li>`).join('')}</ul>
      <p class="works-tech"><span>使用技术</span>${project.tags.map(escapeHtml).join(' · ')}</p>
      <nav class="works-links" aria-label="${escapeHtml(project.name)}相关入口">${link(project.link, project.linkText, true)}${project.links.map(entry => link(entry.href, entry.text)).join('')}</nav>
    </div>
  </article>`).join('');
  return `<section class="works-page" aria-label="作品介绍"><header class="works-intro"><p class="works-eyebrow">记录日常 / 陪伴追番</p><p>这里放着我正在折腾的两个小东西。一个记录日常，一个陪我追番，都在慢慢完善。</p></header><div class="works-projects">${entries}</div></section>`;
}

function enhanceWorks(html, projects) {
  const dom = new JSDOM(html);
  const slot = dom.window.document.getElementById('works-showcase');
  if (!slot) {
    dom.window.close();
    throw new Error('作品页缺少内容容器');
  }
  // 每次替换同一容器，让仅修改数据的增量构建也能更新正文。
  slot.innerHTML = renderWorks(projects);
  const result = dom.serialize();
  dom.window.close();
  return result;
}

module.exports = { readWorks, renderWorks, enhanceWorks };
