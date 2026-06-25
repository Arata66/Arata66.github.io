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
  var PETAL_COUNT = 12;
  var TITLE_TEXT = 'Arata66 の Blog';
  var TYPE_SPEED = 100;

  function createPetals() {
    var container = document.getElementById('intro-petals');
    if (!container) return;
    for (var i = 0; i < PETAL_COUNT; i++) {
      var petal = document.createElement('div');
      petal.className = 'intro-petal';
      var startX = 30 + Math.random() * 40;
      var startY = 30 + Math.random() * 30;
      petal.style.left = startX + '%';
      petal.style.top = startY + '%';
      petal.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      petal.style.setProperty('--dy', (100 + Math.random() * 200) + 'px');
      petal.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      petal.style.setProperty('--dur', (1.5 + Math.random() * 1.5) + 's');
      petal.style.setProperty('--delay', (0.8 + Math.random() * 0.6) + 's');
      petal.style.width = (8 + Math.random() * 8) + 'px';
      petal.style.height = petal.style.width;
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
        setTimeout(callback, 800);
      }
    }, TYPE_SPEED);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var intro = document.getElementById('relume-intro');
    var title = document.getElementById('intro-title');
    var subtitle = document.getElementById('intro-subtitle');
    if (!intro) return;

    createPetals();

    // 0.3s: 花瓣散开
    setTimeout(function() {
      document.querySelectorAll('.intro-petal').forEach(function(p) { p.classList.add('active'); });
    }, 300);

    // 0.5s: 标题打字
    setTimeout(function() {
      typeTitle(title, TITLE_TEXT, function() {
        subtitle.classList.add('visible');
        setTimeout(function() {
          intro.classList.add('fade-out');
          setTimeout(function() { intro.style.display = 'none'; }, 900);
        }, 800);
      });
    }, 500);
  });
})();
</script>
`, 'home');
