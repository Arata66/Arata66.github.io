function buildTerminalData(posts, now = Date.now(), includeFuture = false) {
  return posts.filter(post => post.published !== false && (includeFuture || post.timestamp <= now))
    .slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
    .map(post => ({ title: post.title, url: '/' + post.path.replace(/^\/+/, ''), date: post.date }));
}

function serializeTerminalData(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

module.exports = { buildTerminalData, serializeTerminalData };

if (typeof hexo !== 'undefined') {
  let terminalData = '[]';
  // 注入器注册时尚未加载文章，生成前再读取完整清单。
  hexo.extend.filter.register('before_generate', function () {
    const posts = hexo.locals.get('posts').data.map(post => ({
      title: post.title, path: post.path, date: post.date.format('YYYY-MM-DD'),
      timestamp: post.date.valueOf(), published: post.published
    }));
    terminalData = serializeTerminalData(buildTerminalData(posts, Date.now(), hexo.config.future));
  });
  // 从子页面通过 Pjax 返回首页时，也需要这份静态数据。
  hexo.extend.filter.register('after_render:html', function (html) {
    return html.replace('</body>', `<script id="terminal-home-data" type="application/json">${terminalData}</script></body>`);
  });
}
