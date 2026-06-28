// 访客彩蛋 — 随机问候 Toast
(function () {
  var GREETINGS = [
    '今天也要加油哦~',
    '代码写累了就看看窗外吧',
    '二次元是第一生产力！',
    'Bug 是朋友，不是敌人',
    '又是充满希望的一天呢',
    '保持热爱，奔赴山海',
    '今天吃什么好呢？',
    'Console.log 是最好的调试工具',
    '生活不止眼前的 bug，还有远方的 bug',
    '摸鱼时间到！',
    '要记得喝水哦~',
    '代码如诗，bug 如歌',
    '你正在变得更强！',
    'Java 是世界上最好的语言（不接受反驳）',
    '今天也辛苦了~',
    '人生苦短，我用 Python... 等等，我是 Java 党',
    '好好学习，天天向上',
    '记得休息眼睛哦~',
    '保持好奇心，世界很精彩',
    '代码跑通的那一刻最爽了'
  ];

  function show() {
    var msg = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

    var toast = document.createElement('div');
    toast.className = 'visitor-toast';
    toast.textContent = msg;

    document.body.appendChild(toast);

    // 触发动画
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    // 3 秒后消失
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        toast.remove();
      }, 500);
    }, 3000);
  }

  // 页面加载完成后显示
  function init() {
    // 首页不显示，避免干扰
    if (window.location.pathname === '/' || window.location.pathname === '') return;
    setTimeout(show, 1500);
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // pjax 兼容
  document.addEventListener('pjax:complete', function () {
    setTimeout(init, 500);
  });
})();
