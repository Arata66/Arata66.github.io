const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceThemeMotion } = require('../scripts/reading-conditions');

const petalsSource = fs.readFileSync(path.join(__dirname, '../source/js/sakura-petals.js'), 'utf8');
const cursorFile = path.join(__dirname, '../source/js/magic-cursor.js');
let cursorMarkup = '';
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/magic-effects.js'), 'utf8'), {
  hexo: { extend: { injector: { register(position, markup) { cursorMarkup = markup; } } } }
});
const cursorSource = fs.existsSync(cursorFile) ? fs.readFileSync(cursorFile, 'utf8') : /<script>([\s\S]*?)<\/script>/.exec(cursorMarkup)[1];

function setup(t, { reduced = false, home = true, fine = true } = {}) {
  const dom = new JSDOM(home ? '<main id="recent-posts"></main>' : '<main id="post"></main>', {runScripts:'outside-only',pretendToBeVisual:true});
  const { window } = dom;
  const { document } = window;
  const createMedia = (matches, query) => Object.assign(new window.EventTarget(), {
    matches, media:query,onchange:null,addListener(){},removeListener(){}
  });
  const media = createMedia(reduced, '(prefers-reduced-motion: reduce)');
  const pointer = createMedia(fine, '(pointer: fine)');
  window.matchMedia = query => query.includes('reduced-motion') ? media : pointer;
  let hidden = false;
  Object.defineProperty(document, 'hidden', {get:()=>hidden,configurable:true});
  const frames = new Map();
  let nextFrame = 0;
  let draws = 0;
  window.requestAnimationFrame = callback => { frames.set(++nextFrame,callback); return nextFrame; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const intervals = new Map();
  let nextInterval = 0;
  window.setInterval = callback => { intervals.set(++nextInterval,callback); return nextInterval; };
  window.clearInterval = id => intervals.delete(id);
  const context = {save(){},translate(){},rotate(){},beginPath(){},moveTo(){},bezierCurveTo(){},fill(){draws++;},stroke(){},restore(){},clearRect(){}};
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {value:()=>context,configurable:true});
  t.after(()=>window.close());
  return {
    window,document,frames,intervals,
    runPetals(){window.eval(petalsSource);},
    runCursor(){window.eval(cursorSource);},
    reduced(value){media.matches=value;media.dispatchEvent(new window.Event('change'));},
    fine(value){pointer.matches=value;pointer.dispatchEvent(new window.Event('change'));},
    hidden(value){hidden=value;document.dispatchEvent(new window.Event('visibilitychange'));},
    move(){document.dispatchEvent(new window.MouseEvent('mousemove',{clientX:120,clientY:180,bubbles:true}));},
    drawCount(){return draws;},
    frame(){const [id,callback]=frames.entries().next().value;frames.delete(id);callback();},
    flushIntervals(){for(const callback of [...intervals.values()]) callback();}
  };
}

test('当选择减少动态效果时应该不启动花瓣和鼠标拖尾',t=>{
  const app=setup(t,{reduced:true});
  app.runPetals();app.runCursor();app.move();app.flushIntervals();
  assert.equal(app.document.querySelectorAll('#sakura-canvas, .magic-cursor-outer, .cursor-particle').length,0);
  assert.equal(app.frames.size,0);
  assert.equal(app.intervals.size,0);
});

test('当首页进入后台再回来时应该暂停并仅恢复一组花瓣',t=>{
  const app=setup(t);app.runPetals();
  assert.equal(app.frames.size,1);app.frame();assert.ok(app.drawCount()>0);
  app.hidden(true);assert.equal(app.frames.size,0);assert.equal(app.document.querySelectorAll('#sakura-canvas').length,0);
  app.hidden(false);assert.equal(app.frames.size,1);assert.equal(app.document.querySelectorAll('#sakura-canvas').length,1);
});

test('当切离首页再从文章回来时应该回收花瓣并正常恢复',t=>{
  const app=setup(t);app.runPetals();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.frames.size,0);
  app.document.body.innerHTML='<main id="post"></main>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelector('#sakura-canvas'),null);
  app.document.body.innerHTML='<main id="recent-posts"></main>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelectorAll('#sakura-canvas').length,1);
  assert.equal(app.frames.size,1);
});

test('当从文章首次进入首页时应该创建一组花瓣而不是漏掉效果',t=>{
  const app=setup(t,{home:false});app.runPetals();assert.equal(app.frames.size,0);
  app.document.body.innerHTML='<main id="recent-posts"></main>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelectorAll('#sakura-canvas').length,1);
});

test('当实时改变动态效果偏好时应该立即回收并可恢复装饰',t=>{
  const app=setup(t);app.runPetals();app.runCursor();app.move();
  assert.equal(app.document.querySelectorAll('.magic-cursor-outer').length,1);
  app.reduced(true);app.move();
  assert.equal(app.document.querySelectorAll('#sakura-canvas, .magic-cursor-outer, .cursor-particle').length,0);
  assert.equal(app.frames.size,0);
  assert.equal(app.document.documentElement.hasAttribute('data-magic-cursor'),false);
  app.reduced(false);app.move();
  assert.equal(app.document.querySelectorAll('#sakura-canvas').length,1);
  assert.equal(app.document.querySelectorAll('.magic-cursor-outer').length,1);
});

test('当重复执行脚本和连续切页时应该不叠加画布和光标',t=>{
  const app=setup(t);app.runPetals();app.runPetals();app.runCursor();app.runCursor();app.move();
  for(let i=0;i<3;i++) app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(app.document.querySelectorAll('#sakura-canvas').length,1);
  assert.equal(app.document.querySelectorAll('.magic-cursor-outer').length,1);
  assert.equal(app.frames.size,1);
});

test('当进入阅读模式时应该暂停花瓣而退出后恢复',async t=>{
  const app=setup(t);app.runPetals();
  app.document.body.classList.add('read-mode');await Promise.resolve();
  assert.equal(app.frames.size,0);
  app.document.body.classList.remove('read-mode');await Promise.resolve();
  assert.equal(app.frames.size,1);
});

test('当自定义光标尚未跟随鼠标或鼠标离开时应该保留原生光标',t=>{
  const app=setup(t);app.runCursor();
  assert.equal(app.document.documentElement.hasAttribute('data-magic-cursor'),false);
  app.move();assert.equal(app.document.documentElement.getAttribute('data-magic-cursor'),'active');
  app.document.documentElement.dispatchEvent(new app.window.MouseEvent('mouseleave'));
  assert.equal(app.document.documentElement.hasAttribute('data-magic-cursor'),false);
});

test('当设备使用粗指针时应该不创建鼠标拖尾',t=>{
  const app=setup(t,{fine:false});app.runCursor();app.move();
  assert.equal(app.document.querySelectorAll('.magic-cursor-outer, .cursor-particle').length,0);
});

test('当减少动态效果时应该直接定位并保留主题导航偏移',t=>{
  const app=setup(t,{reduced:true});
  app.document.body.innerHTML='<header id="page-header" class="fixed"></header>';
  const scrolls=[];
  Object.defineProperty(app.window,'scrollTo',{value:options=>scrolls.push(options)});
  app.window.eval(enhanceThemeMotion(fs.readFileSync(require.resolve('hexo-theme-butterfly/source/js/utils.js'),'utf8')));
  app.window.eval('btf.scrollToDest(300)');
  assert.equal(scrolls[0].top,230);
  assert.equal(scrolls[0].behavior,'auto');
  app.reduced(false);
  app.window.eval('btf.scrollToDest(300)');
  assert.equal(scrolls[1].behavior,'smooth');
});

test('当主题结构改变时应该阻止静默丢失减少动态效果支持',()=>{
  assert.throws(()=>enhanceThemeMotion('新主题结构'),/主题滚动结构已改变/);
  const source=fs.readFileSync(require.resolve('hexo-theme-butterfly/source/js/utils.js'),'utf8');
  const enhanced=enhanceThemeMotion(source);
  assert.equal(enhanceThemeMotion(enhanced),enhanced);
});

test('当减少动态效果时应该保留手机遮罩关闭所需的动画结束事件',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../source/css/reading-conditions.css'),'utf8');
  assert.doesNotMatch(css,/animation\s*:\s*none/);
  assert.match(css,/animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css,/animation-iteration-count:\s*1\s*!important/);
});
