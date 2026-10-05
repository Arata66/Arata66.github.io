const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// 各页面共享数据，支持从其他入口通过 Pjax 打开作品页。
hexo.extend.injector.register('head_end', function () {
  const dataPath = path.join(hexo.source_dir, '_data', 'works.yml');
  if (!fs.existsSync(dataPath)) return '';

  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = yaml.load(raw) || [];

  return `<script>window.WORKS_DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>`;
});
