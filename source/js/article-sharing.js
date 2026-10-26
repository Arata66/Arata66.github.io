(function () {
  const pendingCopies = new Map();
  function init() {
    const tools = document.querySelector('#post .article-copy-tools');
    if (!(tools instanceof HTMLElement) || tools.dataset.copyReady) return;
    const input = tools.querySelector('.article-copy-url');
    const button = tools.querySelector('.article-copy');
    const status = tools.querySelector('.article-copy-feedback');
    if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement) || !status) return;
    tools.dataset.copyReady = 'true';
    button.hidden = false;
    button.addEventListener('click', async function () {
      const attempt = { status, cancel: () => {} };
      pendingCopies.set(button, attempt);
      let timeout;
      let focusMoved = false;
      const rememberFocus = event => { if (event.target !== button) focusMoved = true; };
      document.addEventListener('focusin', rememberFocus);
      button.disabled = true;
      status.textContent = '正在复制…';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
        const deadline = new Promise((resolve, reject) => {
          attempt.cancel = () => reject(new Error('复制操作已取消'));
          timeout = setTimeout(() => reject(new Error('复制等待超时')), 3000);
        });
        await Promise.race([navigator.clipboard.writeText(input.value), deadline]);
        if (!tools.isConnected || pendingCopies.get(button) !== attempt) return;
        button.disabled = false;
        if (document.activeElement === input) button.focus({ preventScroll: true });
        input.hidden = true;
        status.textContent = '已复制，可以粘贴分享。';
      } catch {
        // 切页后的异步结果不能抢夺新页面焦点。
        if (!tools.isConnected || pendingCopies.get(button) !== attempt) return;
        input.hidden = false;
        status.textContent = '可选中下方地址手动复制。';
        // 评论位于iframe中，父文档收不到框内的focusin。
        const currentFocus = document.activeElement;
        if (!(currentFocus instanceof HTMLIFrameElement) && (!focusMoved || currentFocus === button)) {
          input.focus();
          input.select();
        }
      } finally {
        clearTimeout(timeout);
        document.removeEventListener('focusin', rememberFocus);
        if (pendingCopies.get(button) === attempt) {
          pendingCopies.delete(button);
          if (tools.isConnected) button.disabled = false;
        }
      }
    });
  }

  document.addEventListener('pjax:send', () => {
    pendingCopies.forEach((attempt, button) => {
      attempt.cancel();
      if (button.isConnected) {
        button.disabled = false;
        attempt.status.textContent = '复制操作已取消，可以重新复制。';
      }
    });
    pendingCopies.clear();
  });
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
