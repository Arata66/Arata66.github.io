const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 在作品页注入数据，供前端读取渲染
hexo.extend.injector.register('head_end', function () {
  const dataPath = path.join(hexo.source_dir, '_data', 'works.yml');
  if (!fs.existsSync(dataPath)) return '';

  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = yaml.load(raw) || [];

  return `<script>window.WORKS_DATA = ${JSON.stringify(data)};</script>`;
});
