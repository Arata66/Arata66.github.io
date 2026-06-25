/* ========================================
   悬浮角色装饰 — Hexo Injector
   ======================================== */

// CSS 注入
hexo.extend.injector.register('head_begin', `
<link rel="stylesheet" href="/css/float-decor.css">
`);

// HTML + JS 注入
hexo.extend.injector.register('body_end', `
<div id="float-decor" title="和我互动~">
  <img src="/img/theme/azusa-float.png" alt="Azusa" />
</div>
<div id="float-bubble"></div>

<script>
(function() {
  var messages = [
    '今天也要加油哦~',
    '要记得休息眼睛！',
    '写代码辛苦了~',
    '来杯咖啡吧☕',
    '困了就去睡觉！',
    '文章写完了吗？',
    '喵~',
    '要开心哦！',
    '学习使我快乐！',
    '不要停下来啊！'
  ];

  var decor = document.getElementById('float-decor');
  var bubble = document.getElementById('float-bubble');
  if (!decor || !bubble) return;

  var hideTimer = null;

  // 随机显示一句话
  function showRandomMessage() {
    var msg = messages[Math.floor(Math.random() * messages.length)];
    bubble.textContent = msg;
    bubble.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function() {
      bubble.classList.remove('show');
    }, 3000);
  }

  // 悬停显示
  decor.addEventListener('mouseenter', function() {
    showRandomMessage();
  });

  // 点击挥手 + 换一句话
  decor.addEventListener('click', function() {
    decor.classList.remove('clicked');
    // 强制 reflow 以重新触发动画
    void decor.offsetWidth;
    decor.classList.add('clicked');
    showRandomMessage();
    setTimeout(function() {
      decor.classList.remove('clicked');
    }, 700);
  });

  // 页面加载 3 秒后自动弹一次
  setTimeout(showRandomMessage, 3000);
})();
</script>
`);
