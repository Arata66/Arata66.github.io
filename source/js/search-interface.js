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
    input.setAttribute('aria-label', '搜索文章或手账的标题或正文');
    input.setAttribute('aria-describedby', 'local-search-stats');
    input.placeholder = '搜索文章或手账';
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
    browse.innerHTML = '<a href="/archives/">全部文章</a><a href="/journal/">兴趣手账</a><a href="/categories/%E6%8A%80%E6%9C%AF/">学习与折腾</a>';
    results.after(browse);

    const scopes = document.createElement('div');
    scopes.className = 'search-scopes';
    scopes.setAttribute('role', 'group');
    scopes.setAttribute('aria-label', '搜索范围');
    let scope = 'all';
    for (const [value, label] of [['all', '全部内容'], ['article', '文章'], ['journal', '手账']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.searchScope = value;
      button.textContent = label;
      button.setAttribute('aria-pressed', String(value === scope));
      button.addEventListener('click', () => { scope = value; render(); });
      scopes.append(button);
    }
    status.before(scopes);

    const search = new LocalSearch({ path: config.path, unescape: false, top_n_per_article: config.top_n_per_article ?? 1 });
    let state = 'idle';
    let opened = false;
    let composing = false;
    let opener = null;
    let previousScroll = { html: '', body: '', padding: '' };
    let background = [];
    let documents = [];
    const metadata = new Map();
    const contentKey = url => url.origin + url.pathname + url.hash;
    const escapeText = value => {
      const element = document.createElement('span');
      element.textContent = value;
      return element.innerHTML;
    };

    function render() {
      const query = input.value.trim();
      clear.hidden = !input.value;
      if (composing) return;
      retry.hidden = state !== 'error';
      scopes.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.searchScope === scope)));
      results.setAttribute('aria-busy', String(state === 'loading'));
      results.textContent = '';
      if (state === 'loading') status.textContent = '正在加载内容，输入的关键词会保留…';
      else if (state === 'error') status.textContent = '未能加载内容，请重试，也可以先浏览文章或手账。';
      else if (state !== 'ready' || !query) status.textContent = '搜索文章或手账的标题或正文，例如 Hexo、物语、影之刃零。';
      else {
        search.datas = documents.filter(item => scope === 'all' || item.kind === scope);
        const items = search.getResultItems(escapeText(query.toLowerCase()).split(/[-\s]+/));
        items.sort((a, b) => b.includedCount - a.includedCount || b.hitCount - a.hitCount || b.id - a.id);
        status.textContent = '没有找到相关内容，试试更短的关键词，或切换搜索范围。';
        if (items.length) {
          results.innerHTML = `<ol class="search-result-list">${items.map(item => item.item).join('')}</ol>`;
          let journalCount = 0;
          results.querySelectorAll('.local-search-hit-item').forEach(item => {
            const link = item.querySelector('a');
            const entry = metadata.get(contentKey(new URL(link.href)));
            const meta = document.createElement('p');
            meta.className = 'search-result-meta';
            if (entry?.kind === 'journal') {
              journalCount++;
              meta.textContent = ['手账', entry.category, entry.date].filter(Boolean).join(' · ');
            } else meta.textContent = '文章';
            link.prepend(meta);
          });
          const counts = [];
          if (items.length > journalCount) counts.push(`${items.length - journalCount} 篇文章`);
          if (journalCount) counts.push(`${journalCount} 条手账`);
          status.textContent = `找到 ${counts.join('、')}`;
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
        if (!response.ok) throw new Error('内容请求失败');
        const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');
        if (xml.querySelector('parsererror') || xml.documentElement.tagName !== 'search') throw new Error('搜索数据无效');
        documents = [...xml.querySelectorAll('entry')].flatMap(entry => {
          const title = entry.querySelector('title')?.textContent?.trim();
          const rawUrl = entry.querySelector('url')?.textContent?.trim();
          if (!title || !rawUrl) throw new Error('搜索字段缺失');
          const url = new URL(rawUrl, location.origin);
          if (!['https:', 'http:'].includes(url.protocol) || url.origin !== location.origin) return [];
          const kind = entry.querySelector('kind')?.textContent === 'journal' ? 'journal' : 'article';
          let content = entry.querySelector('content')?.textContent || '';
          if (kind === 'article') {
            const contentHtml = document.createElement('template');
            contentHtml.innerHTML = content;
            contentHtml.content.querySelectorAll('script, style').forEach(element => element.remove());
            content = contentHtml.content.textContent.trim();
          }
          return [{ title: escapeText(title), content: escapeText(content), url: url.href, kind, category: entry.querySelector('category')?.textContent || '', date: entry.querySelector('date')?.textContent || '' }];
        });
        metadata.clear();
        documents.forEach(entry => metadata.set(contentKey(new URL(entry.url)), entry));
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
        trigger.setAttribute('aria-label', '搜索本站内容');
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
      render();
      loadData();
    }

    function close(restoreFocus = true) {
      if (!opened) return;
      opened = false;
      composing = false;
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
      else {
        const link = event.target.closest('#local-search-results a');
        if (link instanceof HTMLAnchorElement && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
          close(false);
          const url = new URL(link.href);
          if (url.origin === location.origin && url.pathname === location.pathname && url.pathname === '/journal/') {
            document.dispatchEvent(new CustomEvent('journal:reveal', { detail: url.hash }));
          }
        }
      }
    });
    document.addEventListener('keydown', event => {
      // 选字阶段的按键先交给输入法，尤其是取消候选的 Escape。
      if (composing || event.isComposing) return;
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
    clear.addEventListener('click', () => { composing = false; input.value = ''; render(); input.focus(); });
    retry.addEventListener('click', loadData);
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; render(); });
    input.addEventListener('input', event => {
      if (event instanceof InputEvent && event.isComposing) composing = true;
      render();
    });
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
