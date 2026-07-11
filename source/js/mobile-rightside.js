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

  setup();
  mediaQuery.addEventListener && mediaQuery.addEventListener('change', setup);
  document.addEventListener('pjax:complete', setup);
}());
