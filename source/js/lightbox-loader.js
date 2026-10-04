(function () {
  const script = document.currentScript;
  const source = script && script.dataset.fancyboxSrc;
  if (!source || !window.btf || window.btf.lightboxDeferred) return;
  window.btf.lightboxDeferred = true;
  const original = window.btf.loadLightbox;
  let request;

  window.btf.loadLightbox = function (images) {
    if (GLOBAL_CONFIG.lightbox !== 'fancybox') return original(images);
    const current = Array.from(images);
    if (!current.length) return;
    if (window.Fancybox) return original(current);
    // 没有正文图片的页面不下载图库；失败时保留普通图片查看。
    if (!request) {
      request = window.btf.getScript(source).then(() => true).catch(() => {
        request = null;
        return false;
      });
    }
    request.then(loaded => {
      const connected = current.filter(image => image.isConnected);
      if (loaded && connected.length) original(connected);
    });
  };
})();
