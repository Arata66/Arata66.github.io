const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { mergeFiles } = require('../scripts/merge-assets');

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-assets-'));
  // 只清理本测试创建的临时目录，避免影响构建产物。
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'css'));
  return dir;
}

test('当必需资源缺失时应该报错并保留已有合并包', (t) => {
  const dir = setup(t);
  const bundle = path.join(dir, 'css/bundle.css');
  fs.writeFileSync(bundle, '旧合并包');
  fs.writeFileSync(path.join(dir, 'css/first.css'), '第一份样式');
  assert.throws(() => mergeFiles(['/css/first.css', '/css/missing.css'], '/css/bundle.css', dir), /必需资源不存在.*missing\.css/);
  assert.equal(fs.readFileSync(bundle, 'utf8'), '旧合并包');
});

test('当资源完整时应该按登记顺序合并内容', (t) => {
  const dir = setup(t);
  fs.writeFileSync(path.join(dir, 'css/first.css'), '第一份样式');
  fs.writeFileSync(path.join(dir, 'css/second.css'), '第二份样式');
  mergeFiles(['/css/first.css', '/css/second.css'], '/css/bundle.css', dir);
  const bundle = fs.readFileSync(path.join(dir, 'css/bundle.css'), 'utf8');
  assert.ok(bundle.includes('第一份样式'));
  assert.ok(bundle.includes('第二份样式'));
  assert.ok(bundle.indexOf('第一份样式') < bundle.indexOf('第二份样式'));
});
