(function () {
  const failedScripts = new WeakSet();
  const displayedFrames = new WeakSet();
  let current = null;

  function getClient(wrap) {
    return [...wrap.querySelectorAll('script[src]')].find(script => {
      if (!(script instanceof HTMLScriptElement)) return false;
      const url = new URL(script.src);
      return url.origin === 'https://giscus.app' && url.pathname === '/client.js';
    });
  }

  function clearWait(app) {
    window.clearTimeout(app.timer);
    app.timer = 0;
  }

  function render(app, state = app.state) {
    if (current !== app || !app.wrap.isConnected) return;
    app.state = state;
    const focused = document.activeElement === app.retry;
    app.panel.hidden = state === 'ready' && !focused;
    app.panel.dataset.state = state;
    app.status.textContent = {
      idle: '评论将在靠近这里时加载。',
      loading: '正在加载评论…',
      failed: '评论未能加载，可以重试。',
      slow: '评论等待较久，可能是网络暂时不畅。',
      ready: '评论区域已显示。'
    }[state];
    app.retry.hidden = state === 'idle' || (state === 'loading' && !app.recovering) || (state === 'ready' && !focused);
    app.retry.setAttribute('aria-disabled', String(state === 'loading' || state === 'ready'));
    app.retry.textContent = state === 'loading' ? '正在重试…' : app.frame ? '重新加载评论' : state === 'failed' ? '重试加载' : '重新加载页面';
    app.hint.hidden = state !== 'slow';
    app.hint.textContent = '重新加载会清除尚未发送的文字，请先保存。';
    if (state === 'ready' || state === 'failed') clearWait(app);
  }

  function begin(app) {
    clearWait(app);
    render(app, 'loading');
    app.timer = window.setTimeout(() => render(app, 'slow'), 15000);
  }

  function sync(app) {
    if (current !== app || !app.wrap.isConnected) return;
    const client = getClient(app.wrap);
    app.frame = app.wrap.querySelector('iframe');
    if (app.frame) app.frame.title = '评论区';
    if (client && client !== app.client) {
      app.client = client;
      begin(app);
    }
    if (app.frame && displayedFrames.has(app.frame)) render(app, 'ready');
    else if (client && failedScripts.has(client) && !app.frame) render(app, 'failed');
    else render(app);
  }

  function cleanup() {
    if (!current) return;
    clearWait(current);
    current.observer.disconnect();
    current = null;
  }

  function init() {
    const wrap = document.getElementById('giscus-wrap');
    if (current?.wrap === wrap) return;
    cleanup();
    if (!wrap) return;
    if (wrap.previousElementSibling?.classList.contains('comment-feedback')) wrap.previousElementSibling.remove();
    const panel = document.createElement('div');
    panel.className = 'comment-feedback';
    const status = document.createElement('span');
    status.className = 'comment-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
    const retry = document.createElement('button');
    retry.className = 'comment-retry';
    retry.type = 'button';
    const hint = document.createElement('span');
    hint.className = 'comment-hint';
    panel.append(status, retry, hint);
    wrap.before(panel);
    const app = { wrap, panel, status, retry, hint, client: null, frame: null, state: 'idle', timer: 0, recovering: false, observer: null };
    current = app;
    app.observer = new MutationObserver(() => sync(app));
    app.observer.observe(wrap, { childList: true, subtree: true });
    retry.addEventListener('click', () => {
      if (current !== app || !wrap.isConnected || app.state === 'loading' || app.state === 'ready') return;
      sync(app);
      if (app.state === 'ready') return;
      app.recovering = true;
      if (app.frame) {
        displayedFrames.delete(app.frame);
        begin(app);
        // 保留同一个 iframe，让第三方客户端的高度和主题监听继续有效。
        const url = app.frame.src;
        app.frame.src = url;
      } else if (app.state === 'failed' && app.client) {
        const replacement = document.createElement('script');
        for (const attribute of app.client.attributes) replacement.setAttribute(attribute.name, attribute.value);
        app.client.replaceWith(replacement);
        sync(app);
      } else {
        // 未返回的脚本不能并发重试，否则可能覆盖稍后显示的评论输入。
        window.location.reload();
      }
    });
    retry.addEventListener('blur', () => { if (app.state === 'ready') render(app); });
    sync(app);
  }

  // 先登记捕获监听，以保留 DOM 就绪前已经发生的资源失败。
  document.addEventListener('error', event => {
    const target = event.target;
    if (!(target instanceof HTMLScriptElement) || !target.closest('#giscus-wrap')) return;
    failedScripts.add(target);
    if (current?.wrap.contains(target)) sync(current);
  }, true);

  document.addEventListener('load', event => {
    const frame = event.target;
    if (!(frame instanceof HTMLIFrameElement) || frame !== document.querySelector('#giscus-wrap iframe')) return;
    // 恢复期间可能切换过模式，复用主题已有映射而不复制主题配置。
    window.globalFn?.themeChange?.giscus?.(document.documentElement.getAttribute('data-theme'));
  }, true);

  window.addEventListener('message', event => {
    const wrap = document.getElementById('giscus-wrap');
    const client = wrap && getClient(wrap);
    const frame = wrap?.querySelector('iframe');
    if (!client || !frame || event.source !== frame.contentWindow) return;
    if (event.origin !== new URL(client.getAttribute('src'), location.href).origin || event.origin !== new URL(frame.src).origin) return;
    const height = event.data?.giscus?.resizeHeight;
    if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return;
    displayedFrames.add(frame);
    if (current?.wrap === wrap) sync(current);
  });

  document.addEventListener('pjax:send', cleanup);
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
