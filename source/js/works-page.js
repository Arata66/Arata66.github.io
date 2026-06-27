// 作品展示页 — 分类过滤 + 卡片动画
(function () {
  var PROJECTS = [
    {
      name: 'Arata66 の Blog',
      desc: 'Hexo + Butterfly 二次元风格个人博客，自定义开场动画、音乐播放器、光标特效等',
      icon: '🌸',
      tags: ['Hexo', 'CSS', 'JavaScript'],
      status: 'done',
      statusText: '已完成'
    },
    {
      name: '苍穹外卖',
      desc: 'JavaWeb 课程实战项目，SpringBoot + MyBatis-Plus + Redis，完整餐饮管理系统',
      icon: '🍜',
      tags: ['Java', 'SpringBoot', 'MySQL'],
      status: 'wip',
      statusText: '进行中'
    },
    {
      name: '学习笔记库',
      desc: 'JavaSE / JavaWeb / 数据库等学习过程中的笔记整理',
      icon: '📚',
      tags: ['Java', '学习'],
      status: 'wip',
      statusText: '持续更新'
    }
  ];

  var ALL_TAGS = ['全部'];
  PROJECTS.forEach(function (p) {
    p.tags.forEach(function (t) {
      if (ALL_TAGS.indexOf(t) === -1) ALL_TAGS.push(t);
    });
  });

  var activeTag = '全部';

  function renderFilters(container) {
    var html = '';
    ALL_TAGS.forEach(function (tag) {
      var cls = tag === activeTag ? 'works-filter-btn active' : 'works-filter-btn';
      html += '<button class="' + cls + '" data-tag="' + tag + '">' + tag + '</button>';
    });
    container.innerHTML = html;

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.works-filter-btn');
      if (!btn) return;
      activeTag = btn.dataset.tag;
      container.querySelectorAll('.works-filter-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.tag === activeTag);
      });
      filterCards();
    });
  }

  function renderCards(container) {
    var html = '';
    PROJECTS.forEach(function (p, i) {
      var tagsHtml = p.tags.map(function (t) {
        return '<span class="works-card-tag">#' + t + '</span>';
      }).join('');

      html +=
        '<div class="works-card" data-tags="' + p.tags.join(',') + '" style="animation-delay:' + (i * 0.08) + 's">' +
          '<div class="works-card-header">' +
            '<span class="works-card-icon">' + p.icon + '</span>' +
            '<span class="works-card-status ' + p.status + '">' + p.statusText + '</span>' +
          '</div>' +
          '<div class="works-card-title">' + p.name + '</div>' +
          '<div class="works-card-desc">' + p.desc + '</div>' +
          '<div class="works-card-tags">' + tagsHtml + '</div>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function filterCards() {
    var cards = document.querySelectorAll('.works-card');
    var visibleCount = 0;
    cards.forEach(function (card) {
      var tags = card.dataset.tags.split(',');
      var show = activeTag === '全部' || tags.indexOf(activeTag) !== -1;
      card.classList.toggle('hidden', !show);
      if (show) visibleCount++;
    });

    // 空状态提示
    var empty = document.querySelector('.works-empty');
    if (visibleCount === 0 && !empty) {
      var grid = document.querySelector('.works-grid');
      var div = document.createElement('div');
      div.className = 'works-empty';
      div.innerHTML = '<div class="works-empty-icon">🔍</div><div>暂无该分类的作品</div>';
      grid.parentNode.appendChild(div);
    } else if (visibleCount > 0 && empty) {
      empty.remove();
    }
  }

  function init() {
    var page = document.querySelector('.works-page');
    if (!page) return;

    var filtersEl = page.querySelector('.works-filters');
    var gridEl = page.querySelector('.works-grid');

    renderFilters(filtersEl);
    renderCards(gridEl);
  }

  document.addEventListener('pjax:complete', function () { setTimeout(init, 100); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
