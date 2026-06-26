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

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8');
      const updated = addVersionToRefs(html);
      if (updated !== html) {
        fs.writeFileSync(full, updated, 'utf8');
        console.log(`[cache-bust] ${path.relative(PUBLIC_DIR, full)}`);
      }
    }
  }
}

walk(PUBLIC_DIR);
console.log('[cache-bust] 完成');
