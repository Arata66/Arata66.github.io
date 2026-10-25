(function () {
  let version = 0;
  const pending = new Set();

  function init() {
    for (const card of document.querySelectorAll('[data-community-card]')) {
      if (!(card instanceof HTMLElement) || card.dataset.communityReady) continue;
      const input = card.querySelector('textarea');
      const button = card.querySelector('button.community-copy');
      const status = card.querySelector('.community-feedback');
      if (!(input instanceof HTMLTextAreaElement) || !(button instanceof HTMLButtonElement) || !status) continue;
      const ui = { input, button, status };
      card.dataset.communityReady = 'true';
      ui.button.hidden = false;
      ui.button.addEventListener('click', async () => {
        const current = version;
        ui.button.disabled = true;
        ui.status.textContent = '正在复制…';
        let timer = 0;
        let cancel = () => {};
        try {
          if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
          await new Promise((resolve, reject) => {
            timer = window.setTimeout(() => reject(new Error('复制超时')), 3000);
            cancel = () => { window.clearTimeout(timer); reject(new Error('页面已切换')); };
            pending.add(cancel);
            navigator.clipboard.writeText(ui.input.value).then(resolve, reject);
          });
          if (!card.isConnected || current !== version) return;
          ui.status.textContent = '本站信息已复制。';
        } catch {
          if (!card.isConnected || current !== version) return;
          ui.status.textContent = '复制未成功，可选中上方信息手动复制。';
          ui.input.focus();
          ui.input.select();
        } finally {
          window.clearTimeout(timer);
          pending.delete(cancel);
          if (card.isConnected) ui.button.disabled = false;
        }
      });
    }
  }

  document.addEventListener('pjax:send', () => { version++; for (const cancel of pending) cancel(); });
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
