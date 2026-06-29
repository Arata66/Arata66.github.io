// 作品展示页 — 读取注入数据并渲染分类过滤与卡片
(function () {
  var PROJECTS = window.WORKS_DATA || [];

  var ALL_TAGS = ['全部'];
  PROJECTS.forEach(function (p) {
    if (!Array.isArray(p.tags)) return;
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
      var tags = Array.isArray(p.tags) ? p.tags : [];
      var tagsHtml = tags.map(function (t) {
        return '<span class="works-card-tag">#' + t + '</span>';
      }).join('');

      html +=
        '<div class="works-card" data-tags="' + tags.join(',') + '" style="animation-delay:' + (i * 0.08) + 's">' +
          '<div class="works-card-header">' +
            '<span class="works-card-icon">' + (p.icon || '✨') + '</span>' +
            '<span class="works-card-status ' + (p.status || '') + '">' + (p.statusText || '') + '</span>' +
          '</div>' +
          '<div class="works-card-title">' + (p.name || '') + '</div>' +
          '<div class="works-card-desc">' + (p.desc || '') + '</div>' +
          '<div class="works-card-tags">' + tagsHtml + '</div>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function filterCards() {
    var cards = document.querySelectorAll('.works-card');
    var visibleCount = 0;
    cards.forEach(function (card) {
      var tags = card.dataset.tags.split(',').filter(Boolean);
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
    if (!filtersEl || !gridEl) return;

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
