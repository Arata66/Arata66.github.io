// 手机端降低非首屏图片的加载优先级，减少首屏网络竞争。
(function () {
  function optimizeImages() {
    if (!window.matchMedia('(max-width: 900px)').matches) return;

    var images = document.querySelectorAll('img');
    images.forEach(function (image) {
      image.decoding = 'async';
      const rect = image.getBoundingClientRect();
      // DOM 顺序不等于屏幕位置，首屏图片不能被统一懒加载拖延。
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
        image.loading = 'eager';
      } else if (!image.hasAttribute('loading')) {
        image.loading = 'lazy';
      }
    });
  }

  optimizeImages();
  document.addEventListener('pjax:complete', optimizeImages);
}());
