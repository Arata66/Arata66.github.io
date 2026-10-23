(function () {
  function revealTarget(hash) {
    if (typeof hash !== 'string' || !/^#journal-[a-z0-9-]+$/.test(hash)) return;
    var target = document.getElementById(hash.slice(1));
    var root = target?.closest('[data-journal="page"]');
    if (!(target instanceof HTMLElement) || !root) return;
    root.setAttribute('data-journal-positioned', 'true');
    if (target.hidden) {
      var all = root.querySelector('button[data-journal-filter="all"]');
      if (all instanceof HTMLButtonElement) all.click();
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function init() {
    document.querySelectorAll('[data-journal="page"]').forEach(function (root) {
      if (root.getAttribute('data-journal-ready')) return;
      var filters = root.querySelector('[data-journal-filters]');
      if (!filters) return;
      var buttons = filters.querySelectorAll('button[data-journal-filter]');
      var entries = root.querySelectorAll('[data-journal-entry]');
      var status = root.querySelector('[role="status"]');
      buttons.forEach(function (button) {
        button.addEventListener('click', function () {
          var selected = button.getAttribute('data-journal-filter');
          var count = 0;
          entries.forEach(function (entry) {
            var visible = selected === 'all' || entry.getAttribute('data-journal-entry') === selected;
            entry.toggleAttribute('hidden', !visible);
            if (visible) count++;
          });
          buttons.forEach(function (item) {
            item.setAttribute('aria-pressed', String(item === button));
          });
          if (status) status.textContent = (selected === 'all' ? '全部' : selected) + ' · ' + count + ' 条记录';
        });
      });
      filters.removeAttribute('hidden');
      root.setAttribute('data-journal-ready', 'true');
    });
  }
  function start() {
    init();
    revealTarget(location.hash);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  document.addEventListener('pjax:complete', function () {
    init();
    var hash = location.hash;
    if (!/^#journal-[a-z0-9-]+$/.test(hash)) return;
    // Pjax 随后还会滚动一次，下一帧再保留导航间距并取消平滑滚动。
    requestAnimationFrame(function () { if (location.hash === hash) revealTarget(hash); });
  });
  window.addEventListener('hashchange', function () { revealTarget(location.hash); });
  document.addEventListener('journal:reveal', function (event) {
    if (event instanceof CustomEvent) revealTarget(event.detail);
  });
})();
