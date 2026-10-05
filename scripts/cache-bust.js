const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 构建后自动给 public/ 里所有本地引用资源加 ?v=<文件md5>
// 解决 nginx immutable 长缓存导致更新不生效的问题

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 10);
}

function addVersionToRefs(html) {
  return html.replace(
    /(src|href)="\/([^"]+\.(css|js))(?:\?[^"]*)?"/g,
    (match, attr, resPath) => {
      const fullPath = path.join(PUBLIC_DIR, resPath);
      if (!fs.existsSync(fullPath)) return match;
      const content = fs.readFileSync(fullPath);
      const hash = md5(content);
      return `${attr}="/${resPath}?v=${hash}"`;
    }
  );
}

function deferIconStyles(html) {
  // 图标服务变慢时仍应先显示正文，并保留禁用脚本时的样式。
  return html.replace(
    /<noscript\b[^>]*>[\s\S]*?<\/noscript>|<link rel="stylesheet" href="([^"]*\/fontawesome-free[^"]*\.css(?:\?[^"]*)?)">/g,
    (match, href) => href
      ? `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'"><noscript>${match}</noscript>`
      : match
  );
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8');
      const updated = addVersionToRefs(guardTypedDestroy(asyncNavigationPrefetch(deferLightboxScript(deferIconStyles(html)))));
      if (updated !== html) {
        fs.writeFileSync(full, updated, 'utf8');
        console.log(`[cache-bust] ${path.relative(PUBLIC_DIR, full)}`);
      }
    }
  }
}

function main() {
  walk(PUBLIC_DIR);
  console.log('[cache-bust] 完成');
}

if (require.main === module) {
  main();
}

function deferLightboxScript(html) {
  return html.replace(
    /<script src="([^"]*\/@fancyapps\/ui[^"]*\/fancybox\.umd(?:\.min)?\.js)"><\/script>/g,
    (_, source) => `<script data-fancybox-src="${source}" defer src="/js/lightbox-loader.js"></script>`
  );
}

function asyncNavigationPrefetch(html) {
  // 预取下一页只增强后续导航，不能拖延当前正文就绪。
  return html.replace(
    /<script src="([^"]*\/instant\.page[^"]*\/instantpage(?:\.min)?\.js)" type="module"><\/script>/g,
    (_, source) => `<script async src="${source}" type="module"></script>`
  );
}

function guardTypedDestroy(html) {
  // 快速切页时打字动画可能尚未加载，销毁动作需要允许实例缺席。
  return html.replace(/\btyped\.destroy\(\)/g, 'window.typed?.destroy()');
}

module.exports = { deferIconStyles, deferLightboxScript, asyncNavigationPrefetch, guardTypedDestroy };
