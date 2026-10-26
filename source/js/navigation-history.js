(function () {
  const positions = new Map();
  let currentUrl = location.href;
  let currentKey = entryKey(history.state, currentUrl);
  let navigating = false;
  let pending = null;
  let fragment = null;
  let generation = 0;

  function entryKey(state, url) {
    return typeof state?.uid === 'string' ? `${state.uid}\n${url}` : null;
  }

  function validPosition(value) {
    return Array.isArray(value) && value.length === 2 && value.every(item => Number.isFinite(item) && item >= 0) ? [...value] : null;
  }

  function remember() {
    if (!currentKey || navigating) return;
    positions.delete(currentKey);
    positions.set(currentKey, [Math.max(0, scrollX), Math.max(0, scrollY)]);
    if (positions.size > 100) positions.delete(positions.keys().next().value);
  }

  // 此时地址已变化，但浏览器还没有恢复滚动，先记录离开页面的位置。
  window.addEventListener('popstate', event => {
    generation++;
    const url = location.href;
    const key = entryKey(event.state, url);
    // 只跳过点击产生的那一次章节跳转，历史前进到空状态仍要记录。
    const fragmentClick = fragment?.url === url && !fragment.event.defaultPrevented;
    fragment = null;
    if (!fragmentClick) remember();
    const fallback = event.state?.url === url ? validPosition(event.state.scrollPos) : null;
    pending = key && !fragmentClick ? { key, url, position: positions.get(key) || fallback } : null;
    if (pending) navigating = true;
  }, true);

  document.addEventListener('pjax:send', event => {
    fragment = null;
    if (!('history' in event) || event.history !== false) {
      remember();
      pending = null;
    }
    generation++;
    navigating = true;
  });

  document.addEventListener('pjax:success', () => {
    currentUrl = location.href;
    currentKey = entryKey(history.state, currentUrl);
    const target = pending;
    const version = generation;
    pending = null;
    if (!target?.position || target.key !== currentKey) { navigating = false; return; }
    // 等主题和手账的章节定位结束，历史往返才回到实际读过的位置。
    requestAnimationFrame(() => {
      if (generation !== version) return;
      if (location.href === target.url) window.scrollTo({ left: target.position[0], top: target.position[1], behavior: 'instant' });
      currentUrl = location.href;
      currentKey = entryKey(history.state, currentUrl);
      navigating = false;
    });
  });

  document.addEventListener('pjax:error', () => {
    generation++;
    pending = null;
    navigating = false;
    if (location.href !== currentUrl) currentKey = null;
  });

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash && url.href !== location.href) {
      remember();
      fragment = { url: url.href, event };
    }
  }, true);

  window.addEventListener('hashchange', () => {
    fragment = null;
    if (navigating) return;
    currentUrl = location.href;
    currentKey = entryKey(history.state, currentUrl);
  });
})();
