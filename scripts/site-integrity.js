const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { JSDOM } = require('jsdom');

function checkSite(publicDir, siteUrl, expectedPosts = null) {
  const base = new URL(siteUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const files = new Set();
  const pages = new Map();
  const errors = new Set();
  let posts = 0;
  let references = 0;

  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.isFile()) files.add(path.relative(publicDir, full).replaceAll('\\', '/'));
    }
  }
  if (fs.existsSync(publicDir)) collect(publicDir);
  if (!files.has('index.html')) errors.add('输出目录缺少首页 index.html，请先完成构建。');

  function report(file, reason, value = '') {
    errors.add(`${file}：${reason}${value ? '：' + value : ''}`);
  }
  function dateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
    const calendar = new Date(value.slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) return NaN;
    return Date.parse(value);
  }
  const dateFormatter = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  function visibleDate(value) {
    const parts = Object.fromEntries(dateFormatter.formatToParts(value).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    const dom = new JSDOM(fs.readFileSync(path.join(publicDir, file), 'utf8'));
    const document = dom.window.document;
    const url = new URL(path.posix.basename(file) === 'index.html' ? file.slice(0, -10) : file, base);
    const refs = [];
    const ids = new Set();
    for (const element of document.querySelectorAll('[id],a[name]')) {
      if (element.id) ids.add(element.id);
      const name = element.tagName === 'A' ? element.getAttribute('name') : null;
      if (name) ids.add(name);
    }
    const meta = key => document.querySelector(`meta[${key}]`)?.getAttribute('content')?.trim() || '';
    const title = document.querySelector('title')?.textContent?.trim() || '';
    if (!title) report(file, '页面标题缺失');
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    try {
      const fixedUrl = new URL(canonical);
      if (fixedUrl.href !== url.href) report(file, '规范地址与页面地址不一致', canonical);
    } catch {
      report(file, '规范地址缺失或不是完整网址', canonical);
    }

    for (const element of document.querySelectorAll('[href],[src],[lazy-src],[poster]')) {
      for (const attribute of ['href', 'src', 'lazy-src', 'poster']) {
        const value = element.getAttribute(attribute)?.trim();
        if (value) refs.push({ value, anchor: attribute === 'href' && ['A', 'AREA'].includes(element.tagName) });
      }
    }
    if (document.querySelector('#post #article-container')) {
      posts++;
      const heading = document.querySelector('#post-info h1')?.textContent?.trim() || '';
      if (!heading || !title.startsWith(heading) || meta('property="og:title"') !== heading) report(file, '文章标题信息与正文不一致');
      if (!meta('name="description"')) report(file, '文章描述缺失');
      if (meta('property="og:url"') !== canonical) report(file, '文章分享地址与规范地址不一致');
      const published = dateValue(meta('property="article:published_time"'));
      const modified = dateValue(meta('property="article:modified_time"'));
      if (!Number.isFinite(published)) report(file, '文章发表时间缺失或无效');
      if (!Number.isFinite(modified)) report(file, '文章更新时间缺失或无效');
      if (modified < published) report(file, '文章更新时间早于发表时间');
      for (const [selector, value, label] of [['.post-meta-date-created', published, '发表时间'], ['.post-meta-date-updated', modified, '更新时间']]) {
        const time = document.querySelector('#post-meta time' + selector);
        const visible = time?.getAttribute('datetime') || '';
        if (dateValue(visible) !== value) report(file, '文章' + label + '与正文不一致');
        if (Number.isFinite(value) && time?.textContent?.trim() !== visibleDate(value)) report(file, '文章' + label + '与日期文字不一致');
      }
      const cover = meta('property="og:image"');
      if (!/^https?:\/\//i.test(cover)) report(file, '文章封面缺失或不是完整网址');
      else refs.push({ value: cover, anchor: false });
    }
    pages.set(file, { url, ids, refs });
    dom.window.close();
  }

  for (const [file, page] of pages) {
    for (const { value, anchor } of page.refs) {
      let url;
      try { url = new URL(value, page.url); } catch { report(file, '链接格式无效', value); continue; }
      // 外部服务暂时不可达不影响本站静态页面发布，也不在构建中发起网络请求。
      if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== base.hostname || url.port !== base.port) continue;
      references++;
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); } catch { report(file, '链接路径编码无效', value); continue; }
      if (decoded.includes('\\') || Array.from(decoded).some(char => char.charCodeAt(0) < 32) || decoded.split('/').some(part => part === '..' || part === '.')) {
        report(file, '链接路径无效', value);
        continue;
      }
      const prefix = decodeURIComponent(base.pathname);
      const relative = decoded.startsWith(prefix) ? decoded.slice(prefix.length) : '';
      let destination = decoded.startsWith(prefix) ? relative : null;
      if (!files.has(destination)) destination = destination === null ? null : relative.replace(/\/$/, '') + (relative ? '/index.html' : 'index.html');
      if (!destination || !files.has(destination)) { report(file, '站内页面或资源不存在', value); continue; }
      if (!anchor || !url.hash || !pages.has(destination)) continue;
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)).split(':~:text=')[0]; } catch { report(file, '标题锚点编码无效', value); continue; }
      if (id && !pages.get(destination).ids.has(id)) report(file, '标题锚点不存在', value);
    }
  }
  if (expectedPosts !== null && posts !== expectedPosts) errors.add(`文章数量不一致：已发布源文章 ${expectedPosts} 篇，生成正文 ${posts} 篇。`);
  return { pages: pages.size, posts, references, errors: Array.from(errors) };
}

function countPublishedPosts(directory) {
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (/^[_.]/.test(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) count += countPublishedPosts(file);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      const frontmatter = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      const metadata = frontmatter ? yaml.load(frontmatter[1]) : null;
      if (!(metadata && typeof metadata === 'object' && 'published' in metadata && metadata.published === false)) count++;
    }
  }
  return count;
}

function main() {
  const root = path.join(__dirname, '..');
  const config = yaml.load(fs.readFileSync(path.join(root, '_config.yml'), 'utf8'));
  if (!config || typeof config !== 'object' || !('url' in config)) throw new Error('缺少网站地址配置。');
  const result = checkSite(path.join(root, 'public'), String(config.url), countPublishedPosts(path.join(root, 'source/_posts')));
  if (result.errors.length) {
    console.error('[网站检查] 发现以下问题：\n' + result.errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`[网站检查] 通过：${result.pages} 个页面、${result.posts} 篇文章、${result.references} 处站内引用。`);
}

module.exports = { checkSite, countPublishedPosts };
if (require.main === module) main();
