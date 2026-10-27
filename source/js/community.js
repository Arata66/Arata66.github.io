(function () {
  const pending = new Map();

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
        const attempt = { status: ui.status, cancel: () => {} };
        pending.set(ui.button, attempt);
        let focusMoved = false;
        const rememberFocus = event => { if (event.target !== ui.button && event.target !== document.body) focusMoved = true; };
        const leaveWindow = () => { focusMoved = true; };
        document.addEventListener('focusin', rememberFocus);
        window.addEventListener('blur', leaveWindow);
        ui.button.disabled = true;
        ui.status.textContent = '正在复制…';
        let timer = 0;
        try {
          if (!navigator.clipboard?.writeText) throw new Error('剪贴板不可用');
          await new Promise((resolve, reject) => {
            timer = window.setTimeout(() => reject(new Error('复制超时')), 3000);
            attempt.cancel = () => { window.clearTimeout(timer); reject(new Error('页面已切换')); };
            navigator.clipboard.writeText(ui.input.value).then(resolve, reject);
          });
          if (!card.isConnected || pending.get(ui.button) !== attempt) return;
          ui.status.textContent = '本站信息已复制。';
        } catch {
          if (!card.isConnected || pending.get(ui.button) !== attempt) return;
          ui.status.textContent = '复制未成功，可选中上方信息手动复制。';
          // 名片始终可手选，等待期间开始的新输入不能被旧失败打断。
          if (!focusMoved && !(document.activeElement instanceof HTMLIFrameElement)) {
            ui.input.focus();
            ui.input.select();
          }
        } finally {
          window.clearTimeout(timer);
          document.removeEventListener('focusin', rememberFocus);
          window.removeEventListener('blur', leaveWindow);
          if (pending.get(ui.button) === attempt) {
            pending.delete(ui.button);
            if (card.isConnected) ui.button.disabled = false;
          }
        }
      });
    }
  }

  document.addEventListener('pjax:send', () => {
    pending.forEach((attempt, button) => {
      attempt.cancel();
      if (button.isConnected) {
        button.disabled = false;
        attempt.status.textContent = '复制等待已取消，可以重新复制。';
      }
    });
    pending.clear();
  });
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
