const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../source/js/mobile-performance.js'), 'utf8');

function setup(t) {
  const dom = new JSDOM('<img id="offscreen"><img id="other"><img id="visible" loading="lazy">', {runScripts:'outside-only'});
  dom.window.matchMedia = () => ({matches:true, media:'(max-width: 900px)', onchange:null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return true;}});
  const document = dom.window.document;
  document.getElementById('offscreen').getBoundingClientRect = () => ({top:2000,bottom:2100,left:0,right:100,width:100,height:100,x:0,y:2000,toJSON(){}});
  document.getElementById('visible').getBoundingClientRect = () => ({top:300,bottom:450,left:0,right:300,width:300,height:150,x:0,y:300,toJSON(){}});
  dom.window.eval(script);
  t.after(() => dom.window.close());
  return dom;
}

test('当手机首屏图片排在较后位置时应该立即加载', t => {
  const dom = setup(t);
  assert.equal(dom.window.document.images.namedItem('visible').loading, 'eager');
});

test('当图片排在前面但位于屏幕外时应该延迟加载', t => {
  const dom = setup(t);
  assert.equal(dom.window.document.images.namedItem('offscreen').loading, 'lazy');
});

test('当 Pjax 换入首屏图片时应该重新按可见范围处理', t => {
  const dom = setup(t);
  const image = dom.window.document.createElement('img');
  image.loading = 'lazy';
  image.getBoundingClientRect = () => ({top:50,bottom:100,left:0,right:100,width:100,height:50,x:0,y:50,toJSON(){}});
  dom.window.document.body.appendChild(image);
  dom.window.document.dispatchEvent(new dom.window.Event('pjax:complete'));
  assert.equal(image.loading, 'eager');
});
