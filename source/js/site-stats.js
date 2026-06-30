// 页脚站点统计计数器
(function () {
  // 站点创建日期
  var startDate = new Date('2025-11-13');
  var now = new Date();
  var days = Math.floor((now - startDate) / 86400000);

  var el = document.getElementById('site-stats');
  if (!el) return;

  el.querySelector('.stats-days').textContent = days;

  // 文章数由构建脚本注入 window.__SITE_STATS
  if (window.__SITE_STATS) {
    el.querySelector('.stats-posts').textContent = window.__SITE_STATS.postCount;
  }
})();
