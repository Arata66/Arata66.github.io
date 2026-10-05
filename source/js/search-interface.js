(function () {
  function init() {
    const root = document.querySelector('#local-search');
    const panel = root?.querySelector('.search-dialog');
    const field = root?.querySelector('.local-search-input input');
    const backdrop = root?.querySelector('#search-mask');
    const results = root?.querySelector('#local-search-results');
    const status = root?.querySelector('#local-search-stats');
    const closeButton = root?.querySelector('.search-close-button');
    const config = GLOBAL_CONFIG.localSearch;
    if (!(root instanceof HTMLElement) || root.dataset.searchReady || !(panel instanceof HTMLElement) ||
        !(field instanceof HTMLInputElement) || !(backdrop instanceof HTMLElement) || !results || !status || !closeButton || !config) return;
    const dialog = panel;
    const mask = backdrop;
    const input = field;
    root.dataset.searchReady = 'true';
    dialog.id = 'local-search-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '站内搜索');
    input.setAttribute('aria-label', '搜索文章标题或正文');
    input.setAttribute('aria-describedby', 'local-search-stats');
    input.placeholder = '搜索标题或正文';
    closeButton.setAttribute('aria-label', '关闭搜索');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    results.before(status);
    // 主题通过加载节点的后续兄弟选择器隐藏内容，移除它才会解除遮挡。
    root.querySelector('#loading-database')?.remove();
    const title = root.querySelector('.search-dialog-title');
    if (title) title.textContent = '站内搜索';
    const clear = document.createElement('button');
    clear.className = 'search-clear';
    clear.type = 'button';
    clear.textContent = '清空';
    input.after(clear);
    const retry = document.createElement('button');
    retry.className = 'search-retry';
    retry.type = 'button';
    retry.textContent = '重新加载';
    retry.hidden = true;
    status.after(retry);
    const browse = document.createElement('nav');
    browse.className = 'search-browse';
    browse.setAttribute('aria-label', '也可以直接浏览');
    browse.innerHTML = '<a href="/archives/">全部文章</a><a href="/categories/%E7%94%9F%E6%B4%BB/">生活随笔</a><a href="/categories/%E6%8A%80%E6%9C%AF/">学习与折腾</a>';
    results.after(browse);

    const search = new LocalSearch({ path: config.path, unescape: false, top_n_per_article: config.top_n_per_article ?? 1 });
    let state = 'idle';
    let opened = false;
    let opener = null;
    let previousScroll = { html: '', body: '', padding: '' };
    let background = [];
    const escapeText = value => {
      const element = document.createElement('span');
      element.textContent = value;
      return element.innerHTML;
    };

    function render() {
      const query = input.value.trim();
      clear.hidden = !input.value;
      retry.hidden = state !== 'error';
      results.setAttribute('aria-busy', String(state === 'loading'));
      results.textContent = '';
      if (state === 'loading') status.textContent = '正在加载文章，输入的关键词会保留…';
      else if (state === 'error') status.textContent = '未能加载文章，请重试，也可以先浏览全部文章。';
      else if (state !== 'ready' || !query) status.textContent = '搜索文章标题或正文，例如 Hexo、音乐、手机。';
      else {
        const items = search.getResultItems(escapeText(query.toLowerCase()).split(/[-\s]+/));
        items.sort((a, b) => b.includedCount - a.includedCount || b.hitCount - a.hitCount || b.id - a.id);
        status.textContent = items.length ? `找到 ${items.length} 篇文章` : '没有找到相关内容，试试更短的关键词，或从下面的入口逛逛。';
        if (items.length) {
          results.innerHTML = `<ol class="search-result-list">${items.map(item => item.item).join('')}</ol>`;
          window.pjax?.refresh(results);
        }
      }
    }

    async function loadData() {
      if (state === 'loading' || state === 'ready') return;
      state = 'loading';
      render();
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(config.path, { signal: controller.signal });
        if (!response.ok) throw new Error('文章请求失败');
        const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');
        if (xml.querySelector('parsererror') || xml.documentElement.tagName !== 'search') throw new Error('文章数据无效');
        search.datas = [...xml.querySelectorAll('entry')].flatMap(entry => {
          const title = entry.querySelector('title')?.textContent?.trim();
          const rawUrl = entry.querySelector('url')?.textContent?.trim();
          if (!title || !rawUrl) throw new Error('文章字段缺失');
          const url = new URL(rawUrl, location.origin);
          if (!['https:', 'http:'].includes(url.protocol) || url.origin !== location.origin) return [];
          const contentHtml = document.createElement('template');
          contentHtml.innerHTML = entry.querySelector('content')?.textContent || '';
          contentHtml.content.querySelectorAll('script, style').forEach(element => element.remove());
          const content = contentHtml.content.textContent.trim();
          return [{ title: escapeText(title), content: escapeText(content), url: url.href }];
        });
        state = 'ready';
      } catch {
        state = 'error';
      } finally {
        clearTimeout(deadline);
        render();
      }
    }

    function prepareTriggers() {
      document.querySelectorAll('#search-button > .search').forEach(trigger => {
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-controls', dialog.id);
        trigger.setAttribute('aria-expanded', String(opened));
      });
    }

    function open(trigger) {
      if (opened) return;
      opener = trigger;
      opened = true;
      previousScroll = { html: document.documentElement.style.overflow, body: document.body.style.overflow, padding: document.body.style.paddingRight };
      const gap = Math.max(0, innerWidth - document.documentElement.clientWidth);
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + gap}px`;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      dialog.style.display = 'block';
      mask.style.display = 'block';
      input.style.visibility = 'visible';
      input.focus();
      background = [...document.querySelectorAll('#body-wrap, #rightside')].filter(element => element instanceof HTMLElement).map(element => ({ element, inert: element.inert === true }));
      background.forEach(item => { item.element.inert = true; });
      prepareTriggers();
      loadData();
    }

    function close(restoreFocus = true) {
      if (!opened) return;
      opened = false;
      dialog.style.display = 'none';
      mask.style.display = 'none';
      document.documentElement.style.overflow = previousScroll.html;
      document.body.style.overflow = previousScroll.body;
      document.body.style.paddingRight = previousScroll.padding;
      background.forEach(item => { item.element.inert = item.inert; });
      background = [];
      prepareTriggers();
      if (restoreFocus && opener?.isConnected) opener.focus();
    }

    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest('#search-button > .search');
      if (trigger) { event.preventDefault(); open(trigger); }
      else if (event.target.closest('#local-search .search-close-button') || event.target === mask) close();
    });
    document.addEventListener('keydown', event => {
      if (event.target instanceof Element && event.target.closest('#search-button > .search') && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open(event.target.closest('#search-button > .search'));
      } else if (opened && event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (opened && event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll('button, input, a[href]')].filter(element => element instanceof HTMLElement).filter(element => !element.hidden && !element.closest('[hidden]') && getComputedStyle(element).display !== 'none');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
    retry.addEventListener('click', loadData);
    input.addEventListener('input', render);
    window.addEventListener('pjax:send', () => close(false));
    window.addEventListener('pjax:complete', () => {
      close(false);
      prepareTriggers();
      search.highlightSearchWords(document.getElementById('article-container'));
    });
    search.highlightSearchWords(document.getElementById('article-container'));
    prepareTriggers();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
