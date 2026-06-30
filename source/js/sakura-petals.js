// 花瓣飘落粒子效果（仅首页）
(function () {
  if (!document.getElementById('recent-posts')) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'sakura-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
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
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < petals.length; i++) {
      petals[i].update();
      petals[i].draw();
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  init();
  loop();
})();
