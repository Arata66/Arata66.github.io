(function () {
  const root = document.documentElement;
  const intro = document.getElementById('relume-intro');
  if (!intro) return;

  // 切页或重复执行时沿用本次访问状态，避免重新遮住正文。
  if (root.dataset.introInitialized || root.dataset.pageVisited) {
    if (!intro.dataset.introActive) intro.style.display = 'none';
    return;
  }
  root.dataset.introInitialized = 'true';
  intro.dataset.introActive = 'true';

  const title = document.getElementById('intro-title');
  const subtitle = document.getElementById('intro-subtitle');
  const petals = document.getElementById('intro-petals');
  const text = 'Arata66 の Blog';
  const colors = ['#f4a9c0', '#b48ead', '#c8aadc', '#ffc8dc', '#a082b4'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  let finished = false;
  let started = false;

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(timer => clearTimeout(timer));
    intro.style.display = 'none';
    delete intro.dataset.introActive;
    document.removeEventListener('DOMContentLoaded', start);
  }

  function typeTitle(index) {
    if (finished || !title) return;
    title.textContent = text.slice(0, index);
    if (index < text.length) timers.push(setTimeout(() => typeTitle(index + 1), 30));
  }

  function start() {
    if (started || finished) return;
    started = true;
    if (reduced) {
      finish();
      return;
    }
    if (petals) {
      for (let i = 0; i < 15; i++) {
        const petal = document.createElement('div');
        petal.className = 'intro-petal active';
        petal.style.background = colors[i % colors.length];
        petal.style.left = (20 + Math.random() * 60) + '%';
        petal.style.top = (20 + Math.random() * 40) + '%';
        petal.style.setProperty('--dx', (Math.random() * 300 - 150) + 'px');
        petal.style.setProperty('--dy', (80 + Math.random() * 250) + 'px');
        petal.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        petal.style.setProperty('--dur', (1 + Math.random() * 0.4) + 's');
        petal.style.setProperty('--delay', '0s');
        const size = 6 + Math.random() * 10;
        petal.style.width = size + 'px';
        petal.style.height = size + 'px';
        petals.appendChild(petal);
      }
    }
    if (title) title.classList.add('visible');
    typeTitle(0);
    timers.push(setTimeout(() => {
      if (subtitle) subtitle.classList.add('visible');
    }, 450));
    timers.push(setTimeout(() => {
      intro.classList.add('fade-out');
      timers.push(setTimeout(finish, 350));
    }, 900));
  }

  // defer 与 DOM 就绪确保阻塞样式已经准备好，不等待音乐、天气或图片。
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  if (!finished) timers.push(setTimeout(finish, 6000));

  document.addEventListener('pjax:complete', () => {
    finish();
    const current = document.getElementById('relume-intro');
    if (current) current.style.display = 'none';
  });
})();
