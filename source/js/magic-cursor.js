(function () {
  var root = document.documentElement;
  if (root.dataset.magicCursorInitialized) return;
  root.dataset.magicCursorInitialized = 'true';
  var fine = window.matchMedia('(pointer: fine)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var outer = null;
  var inner = null;
  var particles = [];
  var lastParticleTime = 0;
  var interactSelector = 'a, button, .card-widget, .recent-post-item, #float-decor, .nav-menu a, .aside-list-item, .card-archive-list-link';

  function hide() {
    root.removeAttribute('data-magic-cursor');
    outer?.classList.remove('active');
    inner?.classList.remove('active');
  }

  function cleanup() {
    hide();
    outer?.remove();
    inner?.remove();
    particles.forEach(particle => particle.remove());
    outer = null;
    inner = null;
    particles = [];
    lastParticleTime = 0;
  }

  function enabled() {
    return fine.matches && !reduced.matches && !document.hidden;
  }

  function spawnParticle(x, y) {
    var particle = particles.length >= 20 ? particles.shift() : document.createElement('div');
    particle.className = 'cursor-particle';
    if (!particle.isConnected) document.body.appendChild(particle);
    var colors = ['rgba(244, 169, 192, 0.8)', 'rgba(180, 142, 173, 0.7)', 'rgba(212, 181, 224, 0.7)', 'rgba(255, 255, 255, 0.5)'];
    var size = 3 + Math.random() * 4;
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.setProperty('--px', (Math.random() - 0.5) * 40 + 'px');
    particle.style.setProperty('--py', (Math.random() - 0.5) * 40 + 'px');
    particle.style.animation = 'none';
    void particle.offsetWidth;
    particle.style.animation = '';
    particles.push(particle);
  }

  function move(event) {
    if (!enabled() || document.querySelector('#relume-intro[data-intro-active]')) { hide(); return; }
    if (!outer) {
      outer = document.createElement('div');
      outer.className = 'magic-cursor-outer';
      inner = document.createElement('div');
      inner.className = 'magic-cursor-inner';
      outer.setAttribute('aria-hidden', 'true');
      inner.setAttribute('aria-hidden', 'true');
      document.body.append(outer, inner);
    }
    for (var cursor of [outer, inner]) {
      cursor.style.left = event.clientX + 'px';
      cursor.style.top = event.clientY + 'px';
      cursor.classList.add('active');
    }
    // 只有替代光标已经定位并显示时，才隐藏系统光标。
    root.setAttribute('data-magic-cursor', 'active');
    var now = Date.now();
    if (now - lastParticleTime > 50) {
      spawnParticle(event.clientX, event.clientY);
      lastParticleTime = now;
    }
  }

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseover', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('iframe')) { hide(); return; }
    if (!outer || !enabled()) return;
    var target = event.target.closest(interactSelector);
    outer.classList.toggle('cursor-card', Boolean(target?.closest('.card-widget, .recent-post-item')));
    outer.classList.toggle('cursor-hover', Boolean(target && !target.closest('.card-widget, .recent-post-item')));
  });
  document.addEventListener('mouseout', () => { outer?.classList.remove('cursor-hover', 'cursor-card'); });
  root.addEventListener('mouseleave', hide);
  function sync() { if (!enabled()) cleanup(); }
  fine.addEventListener?.('change', sync);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('pjax:send', cleanup);
})();
