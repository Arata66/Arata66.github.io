hexo.extend.injector.register('body_begin', `
<div id="relume-intro">
  <!-- 花瓣粒子容器 -->
  <div class="intro-petals" id="intro-petals"></div>
  <!-- 标题 -->
  <div class="intro-title" id="intro-title"></div>
  <!-- 副标题 -->
  <div class="intro-subtitle" id="intro-subtitle">不要停下来啊</div>
</div>

<script>
(function() {
  // pjax 切换时跳过动画
  if (window.__introPlayed) {
    var el = document.getElementById('relume-intro');
    if (el) el.style.display = 'none';
    return;
  }
  window.__introPlayed = true;

  var PETAL_COUNT = 15;
  var TITLE_TEXT = 'Arata66 の Blog';
  var TYPE_SPEED = 100;

  // 粉紫色花瓣颜色
  var PETAL_COLORS = [
    'rgba(244, 169, 192, 0.9)',
    'rgba(180, 142, 173, 0.9)',
    'rgba(200, 170, 220, 0.9)',
    'rgba(255, 200, 220, 0.9)',
    'rgba(160, 130, 180, 0.9)'
  ];

  function createPetals() {
    var container = document.getElementById('intro-petals');
    if (!container) return;
    for (var i = 0; i < PETAL_COUNT; i++) {
      var petal = document.createElement('div');
      petal.className = 'intro-petal';
      petal.style.background = PETAL_COLORS[i % PETAL_COLORS.length];
      var startX = 20 + Math.random() * 60;
      var startY = 20 + Math.random() * 40;
      petal.style.left = startX + '%';
      petal.style.top = startY + '%';
      petal.style.setProperty('--dx', (Math.random() * 300 - 150) + 'px');
      petal.style.setProperty('--dy', (80 + Math.random() * 250) + 'px');
      petal.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      petal.style.setProperty('--dur', (1.8 + Math.random() * 1.5) + 's');
      petal.style.setProperty('--delay', (0.5 + Math.random() * 0.8) + 's');
      var size = 6 + Math.random() * 10;
      petal.style.width = size + 'px';
      petal.style.height = size + 'px';
      container.appendChild(petal);
    }
  }

  function typeTitle(el, text, callback) {
    var i = 0;
    el.classList.add('visible');
    var cursor = document.createElement('span');
    cursor.className = 'intro-cursor';
    el.appendChild(cursor);
    var timer = setInterval(function() {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
      } else {
        clearInterval(timer);
        setTimeout(callback, 600);
      }
    }, TYPE_SPEED);
  }

  // 花瓣循环飘落，直到页面加载完成
  var petalLoopTimer = null;
  var introFinished = false;

  function startPetalLoop() {
    var container = document.getElementById('intro-petals');
    if (!container) return;
    function spawnPetal() {
      if (introFinished) return;
      var petal = document.createElement('div');
      petal.className = 'intro-petal active';
      petal.style.background = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
      petal.style.left = (10 + Math.random() * 80) + '%';
      petal.style.top = (-5 + Math.random() * 20) + '%';
      var size = 5 + Math.random() * 8;
      petal.style.width = size + 'px';
      petal.style.height = size + 'px';
      petal.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      petal.style.setProperty('--dy', (80 + Math.random() * 150) + 'px');
      petal.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
      petal.style.setProperty('--dur', (2 + Math.random() * 1.5) + 's');
      petal.style.setProperty('--delay', '0s');
      container.appendChild(petal);
      // 动画结束后移除
      setTimeout(function() { petal.remove(); }, 4000);
      petalLoopTimer = setTimeout(spawnPetal, 200 + Math.random() * 300);
    }
    spawnPetal();
  }

  document.addEventListener('DOMContentLoaded', function() {
    var intro = document.getElementById('relume-intro');
    var title = document.getElementById('intro-title');
    var subtitle = document.getElementById('intro-subtitle');
    if (!intro) return;

    createPetals();
    startPetalLoop();

    // 0.3s: 花瓣散开
    setTimeout(function() {
      document.querySelectorAll('.intro-petal:not(.active)').forEach(function(p) {
        p.classList.add('active');
      });
    }, 300);

    // 0.5s: 标题打字
    setTimeout(function() {
      typeTitle(title, TITLE_TEXT, function() {
        subtitle.classList.add('visible');
        setTimeout(function() {
          introFinished = true;
          clearTimeout(petalLoopTimer);
          intro.classList.add('fade-out');
          setTimeout(function() { intro.style.display = 'none'; }, 900);
        }, 600);
      });
    }, 500);
  });
})();
</script>
`, 'home');
