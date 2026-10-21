// 手机端直接展开常用工具，操作结束后留出正文空间。
(function () {
  const mediaQuery = window.matchMedia('(max-width: 900px)');
  const labels = { readmode: '阅读', darkmode: '主题', 'mobile-toc-button': '目录', to_comment: '评论', 'go-up': '顶部' };

  function setExpanded(rightside, expanded) {
    rightside.classList.toggle('mobile-tools-expanded', expanded);
    rightside.classList.toggle('mobile-tools-collapsed', !expanded);
    const toggle = rightside.querySelector('#mobile-rightside-toggle');
    toggle?.setAttribute('aria-expanded', String(expanded));
    toggle?.setAttribute('aria-label', expanded ? '收起阅读工具' : '展开阅读工具');
    rightside.querySelectorAll('#rightside-config-hide, #rightside-config-show').forEach(group => {
      group.toggleAttribute('inert', !expanded);
    });
  }

  function collapse(restoreFocus = false) {
    const rightside = document.getElementById('rightside');
    if (!rightside || !mediaQuery.matches || !rightside.classList.contains('mobile-tools-expanded')) return;
    const hadFocus = rightside.contains(document.activeElement);
    setExpanded(rightside, false);
    const toggle = rightside.querySelector('#mobile-rightside-toggle');
    if ((restoreFocus || hadFocus) && toggle instanceof HTMLElement) toggle.focus({ preventScroll: true });
  }

  function setup() {
    const rightside = document.getElementById('rightside');
    if (!rightside) return;
    let toggle = rightside.querySelector('#mobile-rightside-toggle');
    if (!mediaQuery.matches) {
      rightside.classList.remove('mobile-tools-collapsed', 'mobile-tools-expanded');
      rightside.querySelectorAll('[inert]').forEach(group => group.removeAttribute('inert'));
      toggle?.remove();
      return;
    }
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'mobile-rightside-toggle';
      toggle.setAttribute('type', 'button');
      toggle.setAttribute('aria-controls', 'rightside-config-hide rightside-config-show');
      toggle.innerHTML = '<i class="fas fa-chevron-up" aria-hidden="true"></i>';
      // 主题的设置功能依赖第一个工具组，不能把箭头插到它前面。
      rightside.appendChild(toggle);
      toggle.addEventListener('click', () => {
        const expanded = !rightside.classList.contains('mobile-tools-expanded');
        if (!expanded) {
          collapse(true);
          return;
        }
        setExpanded(rightside, true);
        const firstTool = rightside.querySelector('#readmode, #darkmode, #mobile-toc-button, #to_comment, #go-up');
        if (firstTool instanceof HTMLElement) firstTool.focus({ preventScroll: true });
      });
    }
    for (const [id, label] of Object.entries(labels)) {
      const control = rightside.querySelector('#' + id);
      if (!control || control.querySelector('.mobile-tool-label')) continue;
      const text = document.createElement('span');
      text.className = 'mobile-tool-label';
      text.textContent = label;
      control.appendChild(text);
    }
    setExpanded(rightside, rightside.classList.contains('mobile-tools-expanded'));
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const rightside = document.getElementById('rightside');
    if (!rightside || !mediaQuery.matches) return;
    if (!rightside.contains(event.target)) {
      collapse();
      return;
    }
    if (event.target.closest('#mobile-rightside-toggle, #rightside-config')) return;
    const control = event.target.closest('#rightside button, #rightside a');
    if (!control) return;
    collapse();
  });
  document.addEventListener('keydown', event => {
    const rightside = document.getElementById('rightside');
    if (event.key !== 'Escape' || !mediaQuery.matches || !rightside?.classList.contains('mobile-tools-expanded')) return;
    event.preventDefault();
    collapse(true);
  });
  document.addEventListener('scroll', () => collapse(), { passive: true });
  document.addEventListener('pjax:send', () => collapse());
  document.addEventListener('pjax:complete', setup);
  mediaQuery.addEventListener('change', setup);
  setup();
})();

(function () {
  const mediaQuery = window.matchMedia('(max-width: 900px)');
  let readingPosition = null;

  function syncToc() {
    const toc = document.getElementById('card-toc');
    const button = document.getElementById('mobile-toc-button');
    if (!toc || !button) return;
    const expanded = toc.classList.contains('open');
    toc.querySelector('.toc-content')?.toggleAttribute('inert', mediaQuery.matches && !expanded);
    button.setAttribute('aria-controls', 'card-toc');
    button.setAttribute('aria-expanded', String(expanded));
  }

  function returnToReading(toc) {
    if (readingPosition?.toc === toc) {
      window.scrollTo({ top: readingPosition.top, behavior: 'instant' });
    }
    readingPosition = null;
    document.getElementById('mobile-rightside-toggle')?.focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    if (!mediaQuery.matches || !(event.target instanceof Element)) return;
    const toc = document.getElementById('card-toc');
    if (!toc) return;
    if (event.target.closest('#mobile-toc-button')) {
      syncToc();
      if (toc.classList.contains('open')) {
        readingPosition = { toc, top: window.scrollY };
        // 流式目录在文章后方，主题只展开卡片不会将它带入视野。
        toc.scrollIntoView({ block: 'start', behavior: 'instant' });
        const link = toc.querySelector('.toc-link.active') || toc.querySelector('.toc-link');
        if (link instanceof HTMLElement) {
          link.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          link.focus({ preventScroll: true });
        }
      } else {
        returnToReading(toc);
      }
      return;
    }
    const link = event.target.closest('#card-toc .toc-link');
    if (!(link instanceof HTMLAnchorElement)) return;
    toc.classList.remove('open');
    syncToc();
    readingPosition = null;
    const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (heading) {
      // 按实际渲染位置避开固定导航，焦点也不能留在隐藏目录里。
      heading.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });

  document.addEventListener('keydown', event => {
    const toc = document.getElementById('card-toc');
    if (event.key !== 'Escape' || event.defaultPrevented || !mediaQuery.matches || !toc?.classList.contains('open') || !toc.contains(document.activeElement)) return;
    event.preventDefault();
    toc.classList.remove('open');
    syncToc();
    returnToReading(toc);
  });

  function setupToc() {
    readingPosition = null;
    syncToc();
  }

  document.addEventListener('pjax:send', () => { readingPosition = null; });
  document.addEventListener('pjax:complete', setupToc);
  mediaQuery.addEventListener('change', setupToc);
  setupToc();
})();
