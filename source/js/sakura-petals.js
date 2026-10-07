// 花瓣飘落粒子效果（仅首页）
(function () {
  var root = document.documentElement;
  if (root.dataset.sakuraPetalsInitialized) return;
  root.dataset.sakuraPetalsInitialized = 'true';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var canvas = null;
  var ctx = null;
  var frame = 0;
  var navigating = false;
  var W, H;
  var petals = [];
  var maxPetals = 18;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Petal() {
    this.reset(true);
  }

  Petal.prototype.reset = function (init) {
    this.x = Math.random() * W;
    this.y = init ? Math.random() * H : -30;
    this.size = 8 + Math.random() * 10;
    this.speedY = 0.6 + Math.random() * 1.0;
    this.speedX = -0.3 + Math.random() * 0.6;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.04;
    this.wave = Math.random() * Math.PI * 2;
    this.waveSpeed = 0.01 + Math.random() * 0.02;
    this.waveAmp = 0.5 + Math.random() * 1.0;
    this.opacity = 0.4 + Math.random() * 0.4;
  };

  Petal.prototype.update = function () {
    this.wave += this.waveSpeed;
    this.x += this.speedX + Math.sin(this.wave) * this.waveAmp;
    this.y += this.speedY;
    this.rotation += this.rotSpeed;
    if (this.y > H + 30) this.reset(false);
  };

  Petal.prototype.draw = function () {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.opacity;
    ctx.beginPath();
    // 花瓣形状
    ctx.moveTo(0, -this.size / 2);
    ctx.bezierCurveTo(
      this.size / 2, -this.size / 2,
      this.size / 2, this.size / 4,
      0, this.size / 2
    );
    ctx.bezierCurveTo(
      -this.size / 2, this.size / 4,
      -this.size / 2, -this.size / 2,
      0, -this.size / 2
    );
    ctx.fillStyle = '#f9b5d0';
    ctx.fill();
    ctx.strokeStyle = '#f4a9c0';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  };

  function init() {
    resize();
    petals = [];
    for (var i = 0; i < maxPetals; i++) {
      petals.push(new Petal());
    }
  }

  function loop() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < petals.length; i++) {
      petals[i].update();
      petals[i].draw();
    }
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    canvas?.remove();
    canvas = null;
    ctx = null;
    petals = [];
  }

  function sync() {
    if (navigating || reduced.matches || document.hidden || document.body.classList.contains('read-mode') || !document.getElementById('recent-posts')) {
      stop();
      return;
    }
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'sakura-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    if (!ctx) { canvas = null; return; }
    document.body.appendChild(canvas);
    init();
    loop();
  }

  window.addEventListener('resize', () => { if (canvas) resize(); });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('pjax:send', () => { navigating = true; stop(); });
  document.addEventListener('pjax:complete', () => { navigating = false; sync(); });
  // 阅读模式只改变body类名，及时释放它不再展示的装饰帧。
  new MutationObserver(sync).observe(document.body, {attributes:true,attributeFilter:['class']});
  sync();
})();
