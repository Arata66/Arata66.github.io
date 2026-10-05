(function () {
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
      button.disabled = true;
      status.textContent = '正在复制…';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
        await navigator.clipboard.writeText(input.value);
        if (!tools.isConnected) return;
        status.textContent = '已复制，可以粘贴分享。';
      } catch {
        // 切页后的异步结果不能抢夺新页面焦点。
        if (!tools.isConnected) return;
        input.hidden = false;
        status.textContent = '可选中下方地址手动复制。';
        input.focus();
        input.select();
      } finally {
        if (tools.isConnected) button.disabled = false;
      }
    });
  }

  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
