(function () {
  let navigationVersion = 0;
  function initChannel(page) {
    if (!(page instanceof HTMLElement) || page.dataset.subscriptionReady) return;
    const input = page.querySelector('.subscription-url');
    const button = page.querySelector('.subscription-copy');
    const status = page.querySelector('.subscription-feedback');
    if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement) || !status) return;
    page.dataset.subscriptionReady = 'true';
    button.hidden = false;

    button.addEventListener('click', async function () {
      const version = navigationVersion;
      button.disabled = true;
      status.textContent = '正在复制…';
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('剪贴板不可用');
        await navigator.clipboard.writeText(input.value);
        if (!page.isConnected || version !== navigationVersion) return;
        status.textContent = '已复制，可以粘贴到阅读器。';
      } catch {
        // 复制权限不可用时，仍让访客通过输入框继续操作。
        if (!page.isConnected || version !== navigationVersion) return;
        status.textContent = '复制未成功，可选中上方地址手动复制。';
        input.focus();
        input.select();
      } finally {
        if (page.isConnected) button.disabled = false;
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

  // 慢切页时旧节点还在文档中，从导航启动起就忽略旧复制结果。
  document.addEventListener('pjax:send', () => { navigationVersion++; });
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
