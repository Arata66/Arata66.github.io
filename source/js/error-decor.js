// 404 页面漂浮装饰元素
// 注入 emoji 漂浮物，仅在 #error_404 页面生效
(function () {
  var target = document.getElementById('error_404');
  if (!target) return;

  var emojis = ['🌸', '💫', '🦋', '⭐'];
  emojis.forEach(function (e) {
    var span = document.createElement('span');
    span.className = 'error-float';
    span.textContent = e;
    target.appendChild(span);
  });
})();
