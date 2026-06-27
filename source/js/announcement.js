// 公告弹窗 — 首次访问弹出，当天不再显示
(function () {
  var today = new Date();
  var dateKey = 'announcement_' + today.getFullYear() + '_' + (today.getMonth() + 1) + '_' + today.getDate();
  if (localStorage.getItem(dateKey)) return;

  function showAnnouncement() {
    var overlay = document.createElement('div');
    overlay.id = 'announcement-overlay';
    overlay.innerHTML =
      '<div id="announcement-modal">' +
        '<div id="announcement-header">' +
          '<i class="fas fa-bullhorn" id="announcement-icon"></i>' +
          '<span id="announcement-title">公告</span>' +
          '<button id="announcement-close"><i class="fas fa-xmark"></i></button>' +
        '</div>' +
        '<div id="announcement-body">' +
          '<p>Welcome to Arata66 の Blog ~</p>' +
          '<p style="margin-top:10px;color:var(--text-muted);font-size:0.9em;">这里是二次元爱好者的自留地，记录技术与日常。</p>' +
        '</div>' +
        '<div id="announcement-footer">' +
          '<button id="announcement-confirm">我知道了</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    // 触发动画
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    function close() {
      overlay.classList.remove('show');
      setTimeout(function () { overlay.remove(); }, 400);
      localStorage.setItem(dateKey, '1');
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.id === 'announcement-confirm' || e.target.id === 'announcement-close' || e.target.closest('#announcement-close')) {
        close();
      }
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });
  }

  // 等页面稳定后再弹
  if (document.readyState === 'complete') {
    setTimeout(showAnnouncement, 1000);
  } else {
    window.addEventListener('load', function () { setTimeout(showAnnouncement, 1000); });
  }

  // Pjax
  document.addEventListener('pjax:complete', function () {
    if (localStorage.getItem(dateKey)) return;
    setTimeout(showAnnouncement, 500);
  });
})();
