(function () {
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('pjax:complete', init);
})();
