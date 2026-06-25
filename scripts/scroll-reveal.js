/* ========================================
   滚动揭示动画
   Intersection Observer 驱动
   ======================================== */

hexo.extend.injector.register('body_end', `
<script>
(function() {
  function markRevealTargets() {
    var selectors = ['.card-widget', '.recent-post-item', '.aside-list-item', '#footer'];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        if (!el.classList.contains('scroll-reveal')) {
          el.classList.add('scroll-reveal');
        }
      });
    });
    document.querySelectorAll('.recent-post-item').forEach(function(el, i) {
      el.classList.add('scroll-reveal-delay-' + Math.min(i + 1, 4));
    });
    document.querySelectorAll('.aside-list-item').forEach(function(el, i) {
      el.classList.add('scroll-reveal-delay-' + Math.min(i + 1, 3));
    });
  }

  function initObserver() {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.scroll-reveal').forEach(function(el) {
      observer.observe(el);
    });
    return observer;
  }

  // 立即执行，不等 DOMContentLoaded（脚本已在 body 末尾）
  markRevealTargets();
  var observer = initObserver();

  document.addEventListener('pjax:complete', function() {
    markRevealTargets();
    document.querySelectorAll('.scroll-reveal:not(.revealed)').forEach(function(el) {
      observer.observe(el);
    });
  });
})();
</script>
`);
