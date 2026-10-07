(function () {
  let opener = null;

  function isVisible(element) {
    for (let current = element; current instanceof HTMLElement; current = current.parentElement) {
      if (current.id === 'rightside' && window.innerWidth > 900 && !current.classList.contains('rightside-show')) return false;
      const style = getComputedStyle(current);
      if (current.hidden || current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return true;
  }

  function restoreFocus() {
    const title = document.querySelector('#post-info h1');
    // 主题的滚动隐藏有节流，页顶不能依赖尚未更新的工具栏状态。
    const atTitle = window.scrollY === 0 && title instanceof HTMLElement && isVisible(title);
    const controls = atTitle ? [] : [document.getElementById('mobile-rightside-toggle'), opener, document.getElementById('rightside-config')];
    const control = controls.find(item => item instanceof HTMLElement && item.isConnected && isVisible(item));
    if (control instanceof HTMLElement) {
      control.focus({ preventScroll: true });
    } else {
      // 响应式重排回到页顶时，主题会隐藏整组工具，改回文章标题。
      if (title instanceof HTMLElement && isVisible(title)) {
        if (!title.hasAttribute('tabindex')) title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    }
    opener = null;
  }

  function clearMode() {
    document.body.classList.remove('read-mode');
    document.querySelectorAll('.exit-readmode').forEach(button => button.remove());
    opener = null;
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.exit-readmode')) {
      restoreFocus();
      return;
    }
    const entry = event.target.closest('#readmode');
    if (!entry || !document.body.classList.contains('read-mode')) return;
    const exits = [...document.querySelectorAll('.exit-readmode')];
    const exit = exits.pop();
    if (!(exit instanceof HTMLButtonElement)) return;
    exits.forEach(button => button.remove());
    opener = entry;
    exit.setAttribute('aria-label', '退出阅读模式');
    exit.title = '退出阅读模式（Esc）';
    const label = document.createElement('span');
    label.className = 'reading-exit-label';
    label.textContent = '退出阅读';
    exit.appendChild(label);
    exit.focus({ preventScroll: true });
  });

  // 先检查内层界面，避免同一次 Escape 连带退出阅读模式。
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !document.body.classList.contains('read-mode')) return;
    if (document.querySelector('.code-fullpage, #custom-context-menu.show') || [...document.querySelectorAll('[role="dialog"]')].some(isVisible)) return;
    const exit = document.querySelector('.exit-readmode');
    if (!(exit instanceof HTMLButtonElement)) return;
    event.preventDefault();
    exit.click();
  }, true);

  // 切页直接回收状态，不能把焦点拉回已经离开的文章。
  document.addEventListener('pjax:send', clearMode);
  document.addEventListener('pjax:complete', clearMode);
})();
