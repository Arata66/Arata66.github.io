const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 构建后合并自定义 CSS/JS，减少 HTTP 请求数
// 由 package.json build 脚本在 hexo generate 之后调用

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE_DIR = path.join(__dirname, '..', 'source');

const CSS_FILES = [
  '/css/custom.css',
  '/css/float-decor.css',
  '/css/weather-clock.css',
  '/css/works-page.css',
  '/css/music-ball.css',
  '/css/terminal-home.css',
  '/css/visitor-egg.css',
  '/css/flink-card.css',
  '/css/post-pin.css',
  '/css/sakura-petals.css',
  '/css/site-stats.css',
  '/css/tape-card.css'
];

const JS_FILES = [
  '/js/music-ball.js',
  '/js/custom-menu.js',
  '/js/float-decor.js',
  '/js/weather-clock.js',
  '/js/works-page.js',
  '/js/error-decor.js',
  '/js/terminal-home.js',
  '/js/visitor-egg.js',
  '/js/flink-card.js',
  '/js/sakura-petals.js',
  '/js/site-stats.js'
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

function generateFlinkData() {
  const linkYml = path.join(SOURCE_DIR, '_data', 'link.yml');
  if (!fs.existsSync(linkYml)) {
    console.warn('[merge-assets] link.yml 不存在，跳过友链数据生成');
    return;
  }
  const data = yaml.load(fs.readFileSync(linkYml, 'utf8'));
  const js = 'window.__FLINK_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
  const outPath = path.join(PUBLIC_DIR, 'js', 'flink-data.js');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, js, 'utf8');
  console.log('[merge-assets] 已生成 /js/flink-data.js（友链数据）');
}

function generateSiteStats() {
  const postsDir = path.join(SOURCE_DIR, '_posts');
  let postCount = 0;
  if (fs.existsSync(postsDir)) {
    postCount = fs.readdirSync(postsDir).filter(f => f.endsWith('.md')).length;
  }
  const js = `window.__SITE_STATS = { postCount: ${postCount} };\n`;
  const outPath = path.join(PUBLIC_DIR, 'js', 'site-stats-data.js');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, js, 'utf8');
  console.log(`[merge-assets] 已生成 /js/site-stats-data.js（文章数：${postCount}）`);
}

function main() {
  generateFlinkData();
  generateSiteStats();
  mergeFiles(CSS_FILES, '/css/custom-bundle.css');
  mergeFiles(JS_FILES, '/js/custom-bundle.js');
  console.log('[merge-assets] 完成');
}

if (require.main === module) {
  main();
}
