// 文章置顶排序脚本
// 在 front matter 中设置 sticky: true 的文章会排在列表最前面

hexo.on('after_init', function () {
  const posts = hexo.locals.get('posts');
  posts.data.sort(function (a, b) {
    const pinA = a.sticky || a.top || false;
    const pinB = b.sticky || b.top || false;
    if (pinA && !pinB) return -1;
    if (!pinA && pinB) return 1;
    return b.date - a.date;
  });
});
