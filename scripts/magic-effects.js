/* ========================================
   鼠标跟随光标 + 粒子拖尾
   仅桌面端 (pointer: fine) 启用
   ======================================== */

hexo.extend.injector.register('body_end', `
<style>
  @media (pointer: fine) {
    *, *::before, *::after { cursor: none !important; }
  }

  .magic-cursor-outer {
    position: fixed;
    top: 0; left: 0;
    width: 40px; height: 40px;
    border: 3px solid rgba(244, 169, 192, 0.8);
    border-radius: 50%;
    pointer-events: none;
    z-index: 99998;
    transition: width 0.3s ease, height 0.3s ease, border-color 0.3s ease, background 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease;
    transform: translate(-50%, -50%);
    mix-blend-mode: difference;
    opacity: 0;
    box-shadow: 0 0 8px rgba(244, 169, 192, 0.3);
  }

  .magic-cursor-inner {
    position: fixed;
    top: 0; left: 0;
    width: 8px; height: 8px;
    background: #f4a9c0;
    border-radius: 50%;
    pointer-events: none;
    z-index: 99998;
    transform: translate(-50%, -50%);
    opacity: 0;
  }

  .magic-cursor-outer.active,
  .magic-cursor-inner.active {
    opacity: 1;
  }

  .magic-cursor-outer.cursor-hover {
    width: 60px; height: 60px;
    border-color: rgba(244, 169, 192, 0.9);
    background: rgba(244, 169, 192, 0.08);
  }

  .magic-cursor-outer.cursor-card {
    width: 20px; height: 20px;
    border-color: rgba(180, 142, 173, 0.8);
    border-radius: 4px;
  }

  .cursor-particle {
    position: fixed;
    width: 5px; height: 5px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 99997;
    transform: translate(-50%, -50%);
    animation: particleFade 0.6s ease-out forwards;
  }

  @keyframes particleFade {
    0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--px)), calc(-50% + var(--py))) scale(0.2); }
  }
</style>

<script>
(function() {
  // 仅靠 pointer: fine 判断是否桌面端，不检查触摸（避免触屏笔记本误杀）
  if (!window.matchMedia('(pointer: fine)').matches) return;

  var outer = document.createElement('div');
  outer.className = 'magic-cursor-outer';
  var inner = document.createElement('div');
  inner.className = 'magic-cursor-inner';
  document.body.appendChild(outer);
  document.body.appendChild(inner);

  var mouseX = 0, mouseY = 0;
  var particlePool = [];
  var POOL_SIZE = 20;
  var lastParticleTime = 0;
  var PARTICLE_INTERVAL = 50;
  var cursorActive = false;

  function activateCursor() {
    if (cursorActive) return;
    cursorActive = true;
    outer.classList.add('active');
    inner.classList.add('active');
  }

  // 轮询检测开场动画是否结束
  var checkCount = 0;
  var checkTimer = setInterval(function() {
    checkCount++;
    var intro = document.getElementById('relume-intro');
    // intro 不存在或已隐藏 → 激活
    if (!intro || intro.style.display === 'none') {
      clearInterval(checkTimer);
      activateCursor();
    }
    // 最多检测 10 秒后强制激活
    if (checkCount >= 40) {
      clearInterval(checkTimer);
      activateCursor();
    }
  }, 250);

  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    inner.style.left = mouseX + 'px';
    inner.style.top = mouseY + 'px';
    outer.style.left = mouseX + 'px';
    outer.style.top = mouseY + 'px';

    var now = Date.now();
    if (now - lastParticleTime > PARTICLE_INTERVAL) {
      spawnParticle(mouseX, mouseY);
      lastParticleTime = now;
    }
  });

  var interactSelector = 'a, button, .card-widget, .recent-post-item, #float-decor, .nav-menu a, .aside-list-item, .card-archive-list-link';

  document.addEventListener('mouseover', function(e) {
    var target = e.target.closest(interactSelector);
    if (target) {
      if (target.closest('.card-widget, .recent-post-item')) {
        outer.classList.remove('cursor-hover');
        outer.classList.add('cursor-card');
      } else {
        outer.classList.remove('cursor-card');
        outer.classList.add('cursor-hover');
      }
    }
  });

  document.addEventListener('mouseout', function(e) {
    if (e.target.closest(interactSelector)) {
      outer.classList.remove('cursor-hover', 'cursor-card');
    }
  });

  // iframe（如 Giscus 评论区）内事件无法传回父页面，进入时隐藏自定义光标
  function bindIframeCursor() {
    document.querySelectorAll('iframe').forEach(function(iframe) {
      iframe.addEventListener('mouseenter', function() {
        outer.style.display = 'none';
        inner.style.display = 'none';
        outer.style.pointerEvents = 'auto';
      });
      iframe.addEventListener('mouseleave', function() {
        outer.style.display = '';
        inner.style.display = '';
        outer.style.pointerEvents = 'none';
      });
    });
  }
  var bindIframeCounter = setInterval(function() {
    if (document.querySelectorAll('iframe').length > 0) {
      bindIframeCursor();
      clearInterval(bindIframeCounter);
    }
  }, 1000);

  // 鼠标移出页面时隐藏自定义光标，移回时恢复
  document.documentElement.addEventListener('mouseleave', function() {
    outer.style.display = 'none';
    inner.style.display = 'none';
  });
  document.documentElement.addEventListener('mouseenter', function() {
    outer.style.display = '';
    inner.style.display = '';
  });

  function spawnParticle(x, y) {
    var particle;
    if (particlePool.length >= POOL_SIZE) {
      particle = particlePool.shift();
    } else {
      particle = document.createElement('div');
      particle.className = 'cursor-particle';
      document.body.appendChild(particle);
    }
    var colors = [
      'rgba(244, 169, 192, 0.8)',
      'rgba(180, 142, 173, 0.7)',
      'rgba(212, 181, 224, 0.7)',
      'rgba(255, 255, 255, 0.5)'
    ];
    var color = colors[Math.floor(Math.random() * colors.length)];
    var size = 3 + Math.random() * 4;
    var dx = (Math.random() - 0.5) * 40;
    var dy = (Math.random() - 0.5) * 40;
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.background = color;
    particle.style.setProperty('--px', dx + 'px');
    particle.style.setProperty('--py', dy + 'px');
    particle.style.animation = 'none';
    void particle.offsetWidth;
    particle.style.animation = '';
    particlePool.push(particle);
  }
})();
</script>
`);
