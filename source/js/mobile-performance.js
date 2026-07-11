// 手机端降低非首屏图片的加载优先级，减少首屏网络竞争。
(function () {
  function optimizeImages() {
    if (!window.matchMedia('(max-width: 900px)').matches) return;

    var images = document.querySelectorAll('img');
    images.forEach(function (image, index) {
      image.decoding = 'async';
      if (index > 1 && !image.hasAttribute('loading')) {
        image.loading = 'lazy';
      }
    });
  }

  optimizeImages();
  document.addEventListener('pjax:complete', optimizeImages);
}());
