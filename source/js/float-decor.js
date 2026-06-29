// 悬浮角色装饰 — DOM 注入 + 交互逻辑
(function () {
  function init() {
    if (document.getElementById('float-decor')) return;

    var decor = document.createElement('div');
    decor.id = 'float-decor';
    decor.title = '和我互动~';
    decor.innerHTML = '<img src="/img/theme/azusa-float.png" alt="Azusa" />';

    var bubble = document.createElement('div');
    bubble.id = 'float-bubble';

    document.body.appendChild(decor);
    document.body.appendChild(bubble);

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

    var hideTimer = null;

    function showRandomMessage() {
      var msg = messages[Math.floor(Math.random() * messages.length)];
      bubble.textContent = msg;
      bubble.classList.add('show');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        bubble.classList.remove('show');
      }, 3000);
    }

    decor.addEventListener('mouseenter', showRandomMessage);

    decor.addEventListener('click', function () {
      decor.classList.remove('clicked');
      void decor.offsetWidth;
      decor.classList.add('clicked');
      showRandomMessage();
      setTimeout(function () {
        decor.classList.remove('clicked');
      }, 700);
    });

    setTimeout(showRandomMessage, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', function () {
    setTimeout(init, 100);
  });
})();
