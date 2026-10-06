(function () {
  let pageVersion = 0;

  function init() {
    document.querySelectorAll('#article-container figure.highlight').forEach(figure => {
      if (!(figure instanceof HTMLElement) || figure.dataset.codeReady) return;
      const tools = figure.querySelector('.highlight-tools');
      const region = figure.querySelector('table');
      const pre = figure.querySelector('.code pre');
      if (!(tools instanceof HTMLElement) || !(region instanceof HTMLElement) || !(pre instanceof HTMLElement)) return;
      figure.dataset.codeReady = 'true';
      const language = tools.querySelector('.code-lang')?.textContent?.toUpperCase() || '代码';
      region.tabIndex = 0;
      region.setAttribute('role', 'region');
      region.setAttribute('aria-label', language + '代码，可横向滚动');

      function upgrade(selector, label) {
        const icon = tools.querySelector(selector);
        if (!(icon instanceof HTMLElement)) return null;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = icon.className;
        button.setAttribute('aria-label', label);
        button.title = label;
        icon.replaceWith(button);
        return button;
      }

      const expand = upgrade('.expand', '收起代码');
      const fullpage = upgrade('.fullpage-button', '全屏查看代码');
      function sync() {
        const open = !tools.classList.contains('closed');
        if (expand) {
          expand.setAttribute('aria-expanded', String(open));
          expand.setAttribute('aria-label', open ? '收起代码' : '展开代码');
          expand.title = open ? '收起代码' : '展开代码';
        }
        if (fullpage) {
          const full = figure.classList.contains('code-fullpage');
          fullpage.setAttribute('aria-pressed', String(full));
          fullpage.setAttribute('aria-label', full ? '退出代码全屏' : '全屏查看代码');
          fullpage.title = full ? '退出代码全屏' : '全屏查看代码';
        }
      }
      // 沿用主题的展开和全屏委托，状态在主题处理后同步。
      tools.addEventListener('click', sync);
      sync();

      const oldCopy = tools.querySelector('.copy-button');
      if (!oldCopy) return;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'code-copy';
      copy.textContent = '复制';
      copy.setAttribute('aria-label', '复制' + language + '代码');
      oldCopy.replaceWith(copy);
      const status = document.createElement('div');
      status.className = 'code-copy-status';
      status.setAttribute('role', 'status');
      const fallback = document.createElement('textarea');
      fallback.className = 'code-copy-fallback';
      fallback.readOnly = true;
      fallback.hidden = true;
      fallback.setAttribute('aria-label', language + '代码，选中后可手动复制');
      figure.append(status, fallback);
      copy.addEventListener('click', async function () {
        const version = pageVersion;
        let focusMoved = false;
        const rememberFocus = event => { if (event.target !== copy) focusMoved = true; };
        document.addEventListener('focusin', rememberFocus);
        if (tools.classList.contains('closed')) expand?.click();
        // 高亮的每行之间是 br，直接读 textContent 会把命令连在一起。
        const lines = Array.from(pre.querySelectorAll('.line'));
        const text = lines.length ? lines.map(line => line.textContent).join('\n') : pre.innerText || pre.textContent || '';
        copy.disabled = true;
        status.textContent = '正在复制…';
        try {
          if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
          await navigator.clipboard.writeText(text);
          if (!figure.isConnected || version !== pageVersion) return;
          copy.disabled = false;
          if (document.activeElement === fallback) copy.focus({ preventScroll: true });
          fallback.hidden = true;
          status.textContent = '已复制，可以粘贴使用。';
        } catch {
          // 切页后结束的复制不能抢新页面焦点。
          if (!figure.isConnected || version !== pageVersion) return;
          if (tools.classList.contains('closed')) expand?.click();
          fallback.value = text;
          fallback.rows = Math.min(8, Math.max(2, lines.length));
          fallback.hidden = false;
          status.textContent = '可选中下方代码手动复制。';
          // 等待期间读者可能已转去评论输入框，保留新的操作焦点。
          if (!focusMoved || document.activeElement === copy) {
            fallback.focus();
            fallback.select();
          }
        } finally {
          document.removeEventListener('focusin', rememberFocus);
          if (figure.isConnected) copy.disabled = false;
        }
      });
    });
  }

  function exitFullpage(restoreFocus) {
    const button = document.querySelector('#article-container .code-fullpage .fullpage-button');
    if (!(button instanceof HTMLButtonElement)) return;
    button.click();
    if (restoreFocus) button.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') exitFullpage(true);
  });
  document.addEventListener('pjax:send', () => {
    pageVersion++;
    exitFullpage(false);
  });
  // Pjax 的主题回调创建工具条后，再升级当前正文。
  document.addEventListener('pjax:complete', () => queueMicrotask(init));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => queueMicrotask(init));
  else queueMicrotask(init);
})();
