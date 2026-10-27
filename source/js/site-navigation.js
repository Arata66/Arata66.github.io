(function () {
  let mobile = null;
  let navigating = false;

  function releaseBackground() {
    mobile?.background.forEach(item => item.element.toggleAttribute('inert', item.inert));
    if (mobile) mobile.background = [];
  }

  function syncMobile() {
    if (!mobile) return;
    const { panel } = mobile;
    const trigger = document.getElementById('toggle-menu');
    const open = panel.classList.contains('open');
    trigger?.setAttribute('aria-expanded', String(open));
    if (open === mobile.open) return;
    mobile.open = open;
    if (open) {
      panel.setAttribute('aria-modal', 'true');
      mobile.background = Array.from(document.body.children).filter(element => element instanceof HTMLElement && !element.contains(panel) && !element.matches('script, style, link')).map(element => ({ element, inert: element.hasAttribute('inert') }));
      mobile.background.forEach(item => item.element.setAttribute('inert', ''));
      const first = panel.querySelector('.menus_items a[href]');
      (first instanceof HTMLElement ? first : panel).focus({ preventScroll: true });
    } else {
      panel.removeAttribute('aria-modal');
      const focused = panel.contains(document.activeElement) || mobile.returnFocus;
      mobile.returnFocus = false;
      releaseBackground();
      if (!navigating && focused && trigger instanceof HTMLElement && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
    }
  }

  function initMobile() {
    const panel = document.getElementById('sidebar-menus');
    if (mobile?.panel === panel) { syncMobile(); return; }
    releaseBackground();
    mobile?.observer.disconnect();
    mobile = null;
    if (!(panel instanceof HTMLElement)) return;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '站点导航');
    panel.tabIndex = -1;
    const observer = new MutationObserver(syncMobile);
    mobile = { panel, observer, open: false, returnFocus: false, background: [] };
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    syncMobile();
  }

  function closeMobile() {
    if (!mobile?.panel.classList.contains('open')) return;
    // 委托主题关闭遮罩，避免另写滚动锁和动画状态。
    document.getElementById('menu-mask')?.click();
    syncMobile();
  }

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
    syncMobile();
  });

  document.addEventListener('pointerdown', function (event) {
    // 遮罩会先使链接失焦，需在浏览器改变焦点前保留返回意图。
    if (mobile?.open && event.target === document.getElementById('menu-mask')) mobile.returnFocus = mobile.panel.contains(document.activeElement);
  });

  document.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
    const target = event.target;
    if (event.key === 'Escape') {
      if (target instanceof Element && target.closest('details[data-site-menu][open]')) {
        event.preventDefault();
        event.stopPropagation();
        closeGroups(null, true);
      } else if (mobile?.open) {
        event.preventDefault();
        event.stopPropagation();
        closeMobile();
      }
    } else if (event.key === 'Tab' && mobile?.open && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const items = Array.from(mobile.panel.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')).filter(item => item instanceof HTMLElement && item.getClientRects().length && !item.closest('[inert]'));
      const first = items[0];
      const last = items[items.length - 1];
      if (!items.length || !mobile.panel.contains(document.activeElement) || document.activeElement === (event.shiftKey ? first : last)) {
        event.preventDefault();
        const next = event.shiftKey ? last : first;
        (next instanceof HTMLElement ? next : mobile.panel).focus({ preventScroll: true });
      }
    }
  });

  // 切页先收起旧菜单，避免焦点回到即将被替换的导航。
  document.addEventListener('pjax:send', function () { navigating = true; closeGroups(null, false); closeMobile(); });
  document.addEventListener('pjax:complete', function () { navigating = false; syncSidebar(); initMobile(); });
  syncSidebar();
  initMobile();
})();
