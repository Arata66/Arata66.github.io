const path = require('path');
const { readWorks } = require('./works-showcase');

// 终端仍在各页面读取同一份项目数据。
hexo.extend.injector.register('head_end', function () {
  const projects = readWorks(path.join(hexo.source_dir, '_data', 'works.yml'));
  const summaries = projects.map(({ name, desc, icon, tags, status, statusText, link, linkText }) => ({ name, desc, icon, tags, status, statusText, link, linkText }));
  return `<script>window.WORKS_DATA = ${JSON.stringify(summaries).replace(/</g, '\\u003c')};</script>`;
});
