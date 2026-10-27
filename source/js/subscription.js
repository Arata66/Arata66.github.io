(function () {
  const pendingCopies = new Map();
  function initChannel(page) {
    if (!(page instanceof HTMLElement) || page.dataset.subscriptionReady) return;
    const input = page.querySelector('.subscription-url');
    const button = page.querySelector('.subscription-copy');
    const status = page.querySelector('.subscription-feedback');
    if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement) || !status) return;
    page.dataset.subscriptionReady = 'true';
    button.hidden = false;

    button.addEventListener('click', async function () {
      const attempt = { status, cancel: () => {} };
      pendingCopies.set(button, attempt);
      let timer = 0;
      let focusMoved = false;
      const rememberFocus = event => { if (event.target !== button && event.target !== document.body) focusMoved = true; };
      const leaveWindow = () => { focusMoved = true; };
      document.addEventListener('focusin', rememberFocus);
      window.addEventListener('blur', leaveWindow);
      button.disabled = true;
      status.textContent = '正在复制…';
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('剪贴板不可用');
        await new Promise((resolve, reject) => {
          timer = window.setTimeout(() => reject(new Error('复制等待超时')), 3000);
          attempt.cancel = () => { window.clearTimeout(timer); reject(new Error('复制等待已取消')); };
          navigator.clipboard.writeText(input.value).then(resolve, reject);
        });
        if (!page.isConnected || pendingCopies.get(button) !== attempt) return;
        status.textContent = '已复制，可以粘贴到阅读器。';
      } catch {
        if (!page.isConnected || pendingCopies.get(button) !== attempt) return;
        status.textContent = '复制未成功，可选中上方地址手动复制。';
        // 地址始终可手动复制，等待期间转去的输入和窗口不能被打断。
        if (!focusMoved && !(document.activeElement instanceof HTMLIFrameElement)) {
          input.focus();
          input.select();
        }
      } finally {
        window.clearTimeout(timer);
        document.removeEventListener('focusin', rememberFocus);
        window.removeEventListener('blur', leaveWindow);
        if (pendingCopies.get(button) === attempt) {
          pendingCopies.delete(button);
          if (page.isConnected) button.disabled = false;
        }
      }
    });
  }

  function init() {
    const page = document.querySelector('.subscription-page');
    if (!page) return;
    const channels = page.querySelectorAll('.subscription-channel');
    if (channels.length) channels.forEach(initChannel);
    else initChannel(page);
  }

  document.addEventListener('pjax:send', () => {
    pendingCopies.forEach((attempt, button) => {
      attempt.cancel();
      if (button.isConnected) {
        button.disabled = false;
        attempt.status.textContent = '复制等待已取消，可以重新复制。';
      }
    });
    pendingCopies.clear();
  });
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
