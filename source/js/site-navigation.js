(function () {
  function syncSidebar() {
    const currentLinks = new Map(Array.from(document.querySelectorAll('#nav .menus_items a[aria-current]'), link => [link.getAttribute('href'), link.getAttribute('aria-current')]));
    const currentGroups = new Set(Array.from(document.querySelectorAll('#nav summary[data-current]'), summary => summary.textContent.trim()));
    // 主题切页保留手机侧栏，沿用新导航的标记避免停留在首次页面。
    document.querySelectorAll('#sidebar-menus .menus_items a').forEach(link => {
      const current = currentLinks.get(link.getAttribute('href'));
      if (current) link.setAttribute('aria-current', current);
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('#sidebar-menus summary').forEach(summary => {
      summary.toggleAttribute('data-current', currentGroups.has(summary.textContent.trim()));
    });
  }

  function closeGroups(except, restoreFocus) {
    document.querySelectorAll('details[data-site-menu][open]').forEach(group => {
      if (!(group instanceof HTMLDetailsElement) || group === except) return;
      const focused = group.contains(document.activeElement);
      group.open = false;
      if (restoreFocus && focused) group.querySelector('summary')?.focus();
    });
  }

  document.addEventListener('click', function (event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    closeGroups(target.closest('details[data-site-menu]'), true);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('details[data-site-menu][open]')) return;
    event.preventDefault();
    event.stopPropagation();
    closeGroups(null, true);
  });

  // 切页先收起旧菜单，避免焦点回到即将被替换的导航。
  document.addEventListener('pjax:send', function () { closeGroups(null, false); });
  document.addEventListener('pjax:complete', syncSidebar);
  syncSidebar();
})();
