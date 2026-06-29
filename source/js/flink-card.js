// 友链侧栏卡片
// 数据与 source/_data/link.yml 保持同步
(function () {
  var FLINK_DATA = [
    {
      class_name: '我的链接',
      class_desc: '本站信息',
      link_list: [
        {
          name: "arata66's Blog",
          link: 'https://arata66.top',
          avatar: 'https://arata66.top/img/theme/azusa-sidebar.jpg',
          descr: 'Java 学习者 | 二次元爱好者'
        }
      ]
    },
    {
      class_name: '友链',
      class_desc: 'friends',
      link_list: [
        {
          name: '鹤川',
          link: 'https://www.yoseaholic.top/',
          avatar: '/img/friend_404.gif',
          descr: '鹤川的博客'
        }
      ]
    }
  ];

  var DEFAULT_AVATAR = '/img/friend_404.gif';

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderLinkItem(link) {
    var name = escapeHtml(link.name || '');
    var firstChar = name.charAt(0) || '?';
    var avatarSrc = link.avatar || DEFAULT_AVATAR;
    var descr = escapeHtml(link.descr || '');

    return (
      '<a class="flink-item" href="' + escapeHtml(link.link || '#') + '" ' +
        'target="_blank" rel="noopener noreferrer" title="' + name + '">' +
        '<img class="flink-avatar" src="' + avatarSrc + '" alt="' + name + '" ' +
          'onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
        '<span class="flink-avatar-fallback" style="display:none">' + firstChar + '</span>' +
        '<div class="flink-info">' +
          '<div class="flink-name">' + name + '</div>' +
          (descr ? '<div class="flink-desc">' + descr + '</div>' : '') +
        '</div>' +
      '</a>'
    );
  }

  function createFlinkCard() {
    var stickyLayout = document.querySelector('.sticky_layout');
    if (!stickyLayout) return;

    var anchor = stickyLayout.querySelector('.card-webinfo');
    if (!anchor) return;

    // 去重：pjax 切换时已存在则跳过
    if (stickyLayout.querySelector('.card-flink')) return;

    var card = document.createElement('div');
    card.className = 'card-widget card-flink';

    var html =
      '<div class="item-headline">' +
        '<i class="fas fa-link"></i>' +
        '<span>友情链接</span>' +
      '</div>' +
      '<div class="flink-list">';

    FLINK_DATA.forEach(function (group) {
      if (!group.link_list || group.link_list.length === 0) return;

      html += '<div class="flink-group">';

      if (FLINK_DATA.length > 1 && group.class_name) {
        html += '<div class="flink-group-title">' + escapeHtml(group.class_name) + '</div>';
      }

      group.link_list.forEach(function (link) {
        html += renderLinkItem(link);
      });

      html += '</div>';
    });

    html += '</div>';
    card.innerHTML = html;

    // 交错动画延迟
    var items = card.querySelectorAll('.flink-item');
    items.forEach(function (item, i) {
      item.style.animationDelay = (i * 0.06) + 's';
    });

    anchor.parentNode.insertBefore(card, anchor.nextSibling);
  }

  function init() {
    createFlinkCard();
  }

  document.addEventListener('pjax:complete', function () {
    setTimeout(init, 100);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
