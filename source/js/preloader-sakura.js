// 樱花加载动画 — 替换 Butterfly 默认 preloader
(function () {
  function override() {
    var box = document.getElementById('loading-box');
    if (!box) return;

    // 只替换一次
    if (box.querySelector('.sakura-loader')) return;

    // 移除默认内容
    var configure = box.querySelector('.configure');
    if (configure) configure.remove();

    // 插入樱花动画
    var loader = document.createElement('div');
    loader.className = 'sakura-loader';
    var html = '';
    for (var i = 0; i < 6; i++) {
      html += '<div class="sakura-petal"></div>';
    }
    html += '<div class="sakura-center"></div>';
    loader.innerHTML = html;

    // 插到 loading-word 前面
    var word = box.querySelector('.loading-word');
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.insertBefore(loader, word);
  }

  // 立即尝试 + 延迟重试
  override();
  setTimeout(override, 100);
  setTimeout(override, 500);
})();
