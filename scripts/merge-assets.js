const fs = require('fs');
const path = require('path');

// 构建后合并自定义 CSS/JS，减少 HTTP 请求数
// 由 package.json build 脚本在 hexo generate 之后调用

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const CSS_FILES = [
  '/css/custom.css',
  '/css/float-decor.css',
  '/css/weather-clock.css',
  '/css/works-page.css',
  '/css/music-ball.css',
  '/css/terminal-home.css',
  '/css/visitor-egg.css'
];

const JS_FILES = [
  '/js/music-ball.js',
  '/js/custom-menu.js',
  '/js/float-decor.js',
  '/js/weather-clock.js',
  '/js/works-page.js',
  '/js/error-decor.js',
  '/js/terminal-home.js',
  '/js/visitor-egg.js'
];

function mergeFiles(files, outPath) {
  const parts = [];
  for (const file of files) {
    const src = path.join(PUBLIC_DIR, file);
    if (!fs.existsSync(src)) {
      console.warn(`[merge-assets] 文件不存在，跳过: ${file}`);
      continue;
    }
    parts.push(`/* === ${file} === */`);
    parts.push(fs.readFileSync(src, 'utf8'));
    parts.push('');
  }

  const content = parts.join('\n');
  const fullOut = path.join(PUBLIC_DIR, outPath);
  fs.mkdirSync(path.dirname(fullOut), { recursive: true });
  fs.writeFileSync(fullOut, content, 'utf8');
  console.log(`[merge-assets] 已生成 ${outPath} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
}

function main() {
  mergeFiles(CSS_FILES, '/css/custom-bundle.css');
  mergeFiles(JS_FILES, '/js/custom-bundle.js');
  console.log('[merge-assets] 完成');
}

if (require.main === module) {
  main();
}
