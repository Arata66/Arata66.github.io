// 自定义右键菜单保留桌面操作，手机使用原生菜单。
(function () {
  if (window.matchMedia('(pointer: fine)').matches === false) return;
  var menu = null;
  var previousFocus = null;
  var generation = 0;
  var position = { x: 0, y: 0 };

  async function copyLink(item) {
    if (item.getAttribute('aria-disabled') === 'true') return;
    var currentMenu = menu;
    var currentGeneration = generation;
    var status = currentMenu.querySelector('.ctx-feedback');
    var input = currentMenu.querySelector('.ctx-copy-url');
    if (!(input instanceof HTMLInputElement) || !status) return;
    var canonical = document.querySelector('link[rel="canonical"]');
    input.value = canonical instanceof HTMLLinkElement ? canonical.href : location.href;
    input.hidden = true;
    item.setAttribute('aria-disabled', 'true');
    status.textContent = '正在复制…';
    placeMenu();
    function isCurrent() {
      return currentMenu.isConnected && menu === currentMenu && generation === currentGeneration && currentMenu.classList.contains('show');
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
      await navigator.clipboard.writeText(input.value);
      if (!isCurrent()) return;
      status.textContent = '已复制，可以粘贴分享。';
      placeMenu();
    } catch {
      // 关闭或切页后，迟到的复制结果不能重新打开菜单或抢焦点。
      if (!isCurrent()) return;
      input.hidden = false;
      status.textContent = '可选中下方地址手动复制。';
      placeMenu();
      if (currentMenu.contains(document.activeElement)) {
        input.focus({ preventScroll: true });
        input.select();
      }
    } finally {
      if (isCurrent()) item.setAttribute('aria-disabled', 'false');
    }
  }

  function createMenu() {
    if (menu) return;
    menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', '页面快捷操作');
    menu.setAttribute('inert', '');
    menu.innerHTML = '<button type="button" class="ctx-item" data-action="top"><i class="fas fa-arrow-up" aria-hidden="true"></i>返回顶部</button>' +
      '<button type="button" class="ctx-item" data-action="theme"><i class="fas fa-circle-half-stroke" aria-hidden="true"></i>切换主题</button>' +
      '<div class="ctx-sep"></div>' +
      '<button type="button" class="ctx-item" data-action="copy" aria-disabled="false"><i class="fas fa-link" aria-hidden="true"></i>复制链接</button>' +
      '<button type="button" class="ctx-item" data-action="share"><i class="fab fa-weibo" aria-hidden="true"></i>分享到微博</button>' +
      '<p class="ctx-feedback" role="status" aria-live="polite"></p>' +
      '<input class="ctx-copy-url" aria-label="当前页面链接，可手动复制" readonly hidden>';
    document.body.appendChild(menu);
    menu.addEventListener('click', function (e) {
      if (!(e.target instanceof Element)) return;
      var item = e.target.closest('.ctx-item');
      if (!(item instanceof HTMLElement)) return;
      var action = item.dataset.action;
      if (action === 'copy') { copyLink(item); return; }
      hideMenu(true);
      if (action === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'theme') {
        // 复用主题原入口，保持存储格式、浏览器配色和评论同步。
        var themeButton = document.getElementById('darkmode');
        if (themeButton instanceof HTMLButtonElement) themeButton.click();
      } else if (action === 'share') {
        var url = encodeURIComponent(location.href);
        var title = encodeURIComponent(document.title);
        window.open('https://service.weibo.com/share/share.php?url=' + url + '&title=' + title, '_blank');
      }
    });
  }

  function showMenu(x, y, keyboard) {
    createMenu();
    if (!menu.contains(document.activeElement)) previousFocus = document.activeElement;
    generation++;
    position = { x: x, y: y };
    menu.querySelector('.ctx-feedback').textContent = '';
    menu.querySelector('.ctx-copy-url').hidden = true;
    menu.querySelector('[data-action="copy"]').setAttribute('aria-disabled', 'false');
    menu.removeAttribute('inert');
    // 先隐藏测量，再定位，反馈展开后同样保持在视口内。
    menu.style.left = '-9999px';
    menu.style.top = '0';
    menu.classList.add('show');
    placeMenu();
    if (keyboard) menu.querySelector('button').focus({ preventScroll: true });
  }

  function placeMenu() {
    var mw = menu.offsetWidth;
    var mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(position.x, window.innerWidth - mw - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(position.y, window.innerHeight - mh - 8)) + 'px';
  }

  function hideMenu(restoreFocus = false) {
    generation++;
    if (!menu) return;
    if (restoreFocus && menu.contains(document.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
      if (menu.contains(document.activeElement) && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    menu.classList.remove('show');
    menu.setAttribute('inert', '');
  }

  function usesNativeMenu(target) {
    var selection = window.getSelection();
    // 复制选区、保存媒体和编辑文字需要浏览器原生操作。
    return (selection && !selection.isCollapsed) || target.closest('input, textarea, select, button, a, pre, code, img, picture, video, audio, canvas, [contenteditable], [role="textbox"]');
  }

  document.addEventListener('contextmenu', function (e) {
    if (!(e.target instanceof Element)) return;
    if (usesNativeMenu(e.target)) { hideMenu(); return; }
    e.preventDefault();
    var keyboard = e.button === 0 && e.clientX === 0 && e.clientY === 0;
    var bounds = e.target.getBoundingClientRect();
    showMenu(keyboard ? bounds.left : e.clientX, keyboard ? bounds.bottom : e.clientY, keyboard);
  });
  document.addEventListener('click', function (e) {
    if (e.target instanceof Node && menu?.contains(e.target)) return;
    hideMenu(true);
  });
  document.addEventListener('scroll', function (e) {
    if (e.target instanceof Node && menu?.contains(e.target)) return;
    hideMenu(true);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideMenu(true);
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      if (!(e.target instanceof Element)) return;
      if (usesNativeMenu(e.target)) { hideMenu(); return; }
      e.preventDefault();
      var bounds = e.target.getBoundingClientRect();
      showMenu(bounds.left, bounds.bottom, true);
    }
    if (e.key === 'Tab' && menu?.classList.contains('show')) {
      // 保留浏览器正常 Tab 顺序，离开菜单后不留下遮挡。
      setTimeout(function () { if (menu && !menu.contains(document.activeElement)) hideMenu(); }, 0);
    }
  });
  document.addEventListener('pjax:complete', function () {
    generation++;
    if (menu) { menu.remove(); menu = null; }
    previousFocus = null;
  });
})();
