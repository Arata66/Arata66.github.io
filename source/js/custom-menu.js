// 自定义右键菜单 — 毛玻璃风格，移动端不启用
(function () {
  if (window.matchMedia('(pointer: fine)').matches === false) return;

  var menu = null;

  function createMenu() {
    if (menu) return;
    menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.innerHTML = '<div class="ctx-item" data-action="top"><i class="fas fa-arrow-up"></i>返回顶部</div>' +
      '<div class="ctx-item" data-action="theme"><i class="fas fa-circle-half-stroke"></i>暗色切换</div>' +
      '<div class="ctx-sep"></div>' +
      '<div class="ctx-item" data-action="copy"><i class="fas fa-link"></i>复制链接</div>' +
      '<div class="ctx-item" data-action="share"><i class="fab fa-weibo"></i>分享到微博</div>';
    document.body.appendChild(menu);

    menu.addEventListener('click', function (e) {
      var item = e.target.closest('.ctx-item');
      if (!item) return;
      var action = item.dataset.action;
      if (action === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'theme') {
        var html = document.documentElement;
        var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      } else if (action === 'copy') {
        navigator.clipboard.writeText(location.href).then(function () {
          item.querySelector('i').className = 'fas fa-check';
          item.lastChild.textContent = '已复制';
          setTimeout(function () {
            item.querySelector('i').className = 'fas fa-link';
            item.lastChild.textContent = '复制链接';
          }, 1500);
        });
      } else if (action === 'share') {
        var url = encodeURIComponent(location.href);
        var title = encodeURIComponent(document.title);
        window.open('https://service.weibo.com/share/share.php?url=' + url + '&title=' + title, '_blank');
      }
      hideMenu();
    });
  }

  function showMenu(x, y) {
    createMenu();
    // 先隐藏测量，再定位
    menu.style.left = '-9999px';
    menu.style.top = '0';
    menu.classList.add('show');

    var mw = menu.offsetWidth;
    var mh = menu.offsetHeight;
    var ww = window.innerWidth;
    var wh = window.innerHeight;

    menu.style.left = (x + mw > ww ? x - mw : x) + 'px';
    menu.style.top = (y + mh > wh ? y - mh : y) + 'px';
  }

  function hideMenu() {
    if (menu) menu.classList.remove('show');
  }

  document.addEventListener('contextmenu', function (e) {
    // 不拦截输入框、链接、代码块的右键
    if (e.target.closest('input, textarea, a, pre, code')) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY);
  });

  document.addEventListener('click', hideMenu);
  document.addEventListener('scroll', hideMenu, true);

  // Pjax 兼容
  document.addEventListener('pjax:complete', function () {
    if (menu) { menu.remove(); menu = null; }
  });
})();
