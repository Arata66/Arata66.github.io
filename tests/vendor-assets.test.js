const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { guardTypedDestroy } = require('../scripts/cache-bust');

const ROOT = path.join(__dirname, '..');
const PJAX_ASSET = path.join(ROOT, 'source', 'js', 'vendor', 'pjax.min.js');
const PJAX_SHA256 = 'c9819844d18cf059f52a7da53f786d418348cc662dd7e243f009ec559bac85e2';

test('当站点启用 Pjax 时应该使用经过校验的本站资源', () => {
  const config = fs.readFileSync(path.join(ROOT, '_config.butterfly.yml'), 'utf8');
  assert.match(config, /^\s*pjax: \/js\/vendor\/pjax\.min\.js$/m);

  const content = fs.readFileSync(PJAX_ASSET);
  const digest = crypto.createHash('sha256').update(content).digest('hex');
  assert.equal(digest, PJAX_SHA256);
});

test('当打字动画尚未加载就切页时应该安全跳过销毁', () => {
  const input = "btf.addGlobalFn('pjaxSendOnce', () => { typed.destroy() }, 'typedDestroy')";
  assert.equal(typeof guardTypedDestroy, 'function');
  const output = guardTypedDestroy(input);
  assert.match(output, /window\.typed\?\.destroy\(\)/);
  assert.equal(guardTypedDestroy(output), output);
  const context = vm.createContext({
    window: {},
    btf: { addGlobalFn: (_name, callback) => callback() }
  });
  assert.throws(() => vm.runInContext(input, context), /typed is not defined/);
  assert.doesNotThrow(() => vm.runInContext(output, context));
});

test('当打字动画已经加载后切页时应该销毁现有实例', () => {
  let destroyed = 0;
  const input = "btf.addGlobalFn('pjaxSendOnce', () => { typed.destroy() }, 'typedDestroy')";
  const context = vm.createContext({
    window: { typed: { destroy: () => { destroyed += 1; } } },
    btf: { addGlobalFn: (_name, callback) => callback() }
  });
  vm.runInContext(guardTypedDestroy(input), context);
  assert.equal(destroyed, 1);
});
