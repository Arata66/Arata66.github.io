(function () {
  const root = document.documentElement;
  if (root.dataset.sakuraLoaderInitialized) return;
  root.dataset.sakuraLoaderInitialized = 'true';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let started = false;
  let finished = false;
  let fadeTimer;
  let fallbackTimer;
  let observer;

  function decorate() {
    const box = document.getElementById('loading-box');
    if (!box || reduced || box.querySelector('.sakura-loader')) return;
    const configure = box.querySelector('.configure');
    if (configure) configure.remove();
    const loader = document.createElement('div');
    loader.className = 'sakura-loader';
    loader.innerHTML = '<div class="sakura-petal"></div>'.repeat(6) + '<div class="sakura-center"></div>';
    const word = box.querySelector('.loading-word');
    box.appendChild(loader);
    if (word) box.appendChild(word);
  }

  function hide() {
    finished = true;
    clearTimeout(fadeTimer);
    clearTimeout(fallbackTimer);
    if (observer) observer.disconnect();
    const box = document.getElementById('loading-box');
    if (box) {
      box.classList.add('loaded');
      box.style.display = 'none';
    }
  }

  function release() {
    if (started || finished) return;
    started = true;
    root.dataset.pageVisited = 'true';
    clearTimeout(fallbackTimer);
    // 仅首次退场释放主题的初始锁滚动，切页不干预侧栏等组件。
    document.body.style.overflow = '';
    const box = document.getElementById('loading-box');
    decorate();
    if (box) box.classList.add('fade-out');
    // 文章页直接开始阅读，首页的淡出与入场动画同时进行。
    if (reduced || !box || !document.getElementById('relume-intro')) hide();
    else fadeTimer = setTimeout(hide, 350);
  }

  decorate();
  // head 执行时正文尚未解析，节点出现后就显示樱花，不等待慢脚本。
  if (!reduced && !document.getElementById('loading-box')) {
    observer = new MutationObserver(() => {
      if (!document.getElementById('loading-box')) return;
      decorate();
      observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
  }
  fallbackTimer = setTimeout(release, 6000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', release, { once: true });
  else release();

  document.addEventListener('pjax:complete', hide);
})();
