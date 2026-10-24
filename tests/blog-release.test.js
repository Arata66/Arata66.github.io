const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { readyRevision, prepareRelease } = require('../scripts/blog-release');

function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-release-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  git(root, ['init', '-b', 'main']);
  // Git在Linux把符号链接当作文件，夹具须同时忽略目录和同名链接。
  fs.writeFileSync(path.join(root, '.gitignore'), '/public\n/.private\nsource/_drafts/\n');
  fs.writeFileSync(path.join(root, 'post.md'), '已批准内容');
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=测试', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: 建立本地测试基线']);
  fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'public/index.html'), '构建首页');
  return root;
}

test('当分支或源码状态不满足发布条件时应该拒绝打包', (t) => {
  const root = fixture(t);
  assert.match(readyRevision(root), /^[a-f0-9]{40}$/);
  fs.writeFileSync(path.join(root, 'post.md'), '还在修改的稿件');
  assert.throws(() => readyRevision(root), /工作区/);
  git(root, ['checkout', '--', 'post.md']);
  git(root, ['switch', '-c', 'Arata66/test']);
  assert.throws(() => readyRevision(root), /main/);
});

test('当准备已提交版本时应该生成完整清单归档且排除私人草稿', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'source/_drafts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'source/_drafts/secret.md'), '私人草稿');
  const calls = [];
  const output = prepareRelease(root, path.join(root, '.private'), task => calls.push(task));
  assert.deepEqual(calls, ['check', 'clean', 'build']);
  assert.equal(fs.readFileSync(path.join(output, 'payload/index.html'), 'utf8'), '构建首页');
  assert.match(fs.readFileSync(path.join(output, 'manifest.txt'), 'utf8'), /^[a-f0-9]{64} {2}index\.html\n$/);
  const meta = JSON.parse(fs.readFileSync(path.join(output, '发布摘要.json'), 'utf8'));
  assert.equal(meta.revision, readyRevision(root));
  assert.equal(meta.files, 1);
  assert.match(meta.archiveSha256, /^[a-f0-9]{64}$/);
  const entries = execFileSync('tar', ['-tzf', path.join(output, 'site.tar.gz')], { encoding: 'utf8' });
  assert.ok(!entries.includes('secret.md'));
  assert.ok(entries.includes('payload/index.html'));
});

test('当检查失败或构建期间源码改变时应该不生成发布包', (t) => {
  const root = fixture(t);
  const state = path.join(root, '.private');
  assert.throws(() => prepareRelease(root, state, () => { throw new Error('质量检查失败'); }), /质量检查失败/);
  assert.throws(() => prepareRelease(root, state, task => { if (task === 'build') fs.writeFileSync(path.join(root, 'post.md'), '中途改变'); }), /工作区/);
  assert.equal(fs.existsSync(path.join(state, 'releases')), false);
});

test('当产物目录是链接或发布缓存落进public时应该在清理前拒绝操作', (t) => {
  const root = fixture(t);
  const calls = [];
  assert.throws(() => prepareRelease(root, path.join(root, 'public/cache'), task => calls.push(task)), /产物目录/);
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside);
  fs.unlinkSync(path.join(root, 'public/index.html'));
  fs.rmdirSync(path.join(root, 'public'));
  fs.symlinkSync(outside, path.join(root, 'public'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(git(root, ['status', '--porcelain']), '');
  assert.throws(() => prepareRelease(root, path.join(root, '.private'), task => calls.push(task)), /链接/);
  assert.deepEqual(calls, []);
});

test('当缓存的祖先链接指向public时应该在构建前拒绝递归打包', (t) => {
  const root = fixture(t);
  fs.symlinkSync(path.join(root, 'public'), path.join(root, '.private'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(git(root, ['status', '--porcelain']), '');
  const calls = [];
  assert.throws(() => prepareRelease(root, path.join(root, '.private/writing'), task => { calls.push(task); throw new Error('不应进入检查'); }), /链接/);
  assert.deepEqual(calls, []);
});
