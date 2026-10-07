/* ========================================
   鼠标跟随光标 + 粒子拖尾
   仅桌面端 (pointer: fine) 启用
   ======================================== */

hexo.extend.injector.register('body_end', `
<style>
  @media (pointer: fine) and (prefers-reduced-motion: no-preference) {
    html[data-magic-cursor="active"] *, html[data-magic-cursor="active"] *::before, html[data-magic-cursor="active"] *::after { cursor: none !important; }
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

<script src="/js/magic-cursor.js"></script>
`);
