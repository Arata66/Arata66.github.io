(function () {
  function refreshStats() {
    var el = document.getElementById('site-stats');
    if (!el) return;
    // 与文章日期保持一致，按上海日历日期计算建站天数。
    var days = Math.max(0, Math.floor((Date.now() + 8 * 3600000 - Date.UTC(2025, 10, 13)) / 86400000));
    var daysEl = el.querySelector('.stats-days');
    var postsEl = el.querySelector('.stats-posts');
    if (daysEl) daysEl.textContent = String(days);
    if (postsEl && window.__SITE_STATS) postsEl.textContent = String(window.__SITE_STATS.postCount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshStats, { once: true });
  else refreshStats();
  document.addEventListener('pjax:complete', refreshStats);
})();
