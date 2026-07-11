// 手机端收起右侧工具，减少固定按钮对正文的干扰。
(function () {
  var mediaQuery = window.matchMedia('(max-width: 900px)');

  function setup() {
    var rightside = document.getElementById('rightside');
    if (!rightside) return;

    var toggle = document.getElementById('mobile-rightside-toggle');
    if (!mediaQuery.matches) {
      rightside.classList.remove('mobile-tools-collapsed', 'mobile-tools-expanded');
      if (toggle) toggle.remove();
      return;
    }

    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'mobile-rightside-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-label', '展开阅读工具');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';
      rightside.insertBefore(toggle, rightside.firstChild);
      toggle.addEventListener('click', function () {
        var expanded = rightside.classList.toggle('mobile-tools-expanded');
        rightside.classList.toggle('mobile-tools-collapsed', !expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.setAttribute('aria-label', expanded ? '收起阅读工具' : '展开阅读工具');
      });
    }

    if (!rightside.classList.contains('mobile-tools-expanded')) {
      rightside.classList.add('mobile-tools-collapsed');
    }
  }

  function collapseAfterAction(event) {
    var rightside = document.getElementById('rightside');
    if (!rightside || !mediaQuery.matches || !rightside.classList.contains('mobile-tools-expanded')) return;
    if (event.target.closest('#mobile-rightside-toggle')) return;
    if (event.target.closest('#rightside-config-show a, #rightside-config-show button, #rightside-config-hide button')) {
      rightside.classList.remove('mobile-tools-expanded');
      rightside.classList.add('mobile-tools-collapsed');
      var toggle = document.getElementById('mobile-rightside-toggle');
      toggle && toggle.setAttribute('aria-expanded', 'false');
      toggle && toggle.setAttribute('aria-label', '展开阅读工具');
    }
  }

  setup();
  mediaQuery.addEventListener && mediaQuery.addEventListener('change', setup);
  document.addEventListener('pjax:complete', setup);
  document.addEventListener('click', collapseAfterAction);
  document.addEventListener('scroll', function () {
    var rightside = document.getElementById('rightside');
    if (!rightside || !mediaQuery.matches || !rightside.classList.contains('mobile-tools-expanded')) return;
    rightside.classList.remove('mobile-tools-expanded');
    rightside.classList.add('mobile-tools-collapsed');
    var toggle = document.getElementById('mobile-rightside-toggle');
    toggle && toggle.setAttribute('aria-expanded', 'false');
    toggle && toggle.setAttribute('aria-label', '展开阅读工具');
  }, { passive: true });
}());
