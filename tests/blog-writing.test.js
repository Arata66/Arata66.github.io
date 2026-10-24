const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { createDraft, preparePost, createPreviewWorkspace, removePreview } = require('../scripts/blog-writing');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-writing-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const dir of ['source/_posts', 'source/_drafts', 'source/img', 'scripts', 'scaffolds', 'node_modules', 'public']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const file of ['package.json', '_config.yml', '_config.butterfly.yml']) fs.writeFileSync(path.join(root, file), '{}');
  fs.writeFileSync(path.join(root, 'source/img/cover.jpg'), '封面');
  fs.writeFileSync(path.join(root, 'source/_posts/existing.md'), '已发表文章');
  fs.writeFileSync(path.join(root, 'public/index.html'), '原正式产物');
  return root;
}

function finish(root, slug) {
  createDraft(root, slug, '测试草稿');
  const file = path.join(root, 'source/_drafts', slug + '.md');
  const content = fs.readFileSync(file, 'utf8').replace("description: ''", 'description: 这是一段已填写的摘要').replace("cover: ''", 'cover: /img/cover.jpg') + '\n这是已经填写的正文。\n';
  fs.writeFileSync(file, content);
  fs.writeFileSync(path.join(root, 'source/_drafts', slug, 'photo.txt'), '选定附件');
  return file;
}

test('当新建中文标题草稿时应该只写入被忽略的草稿区并保留原文章', (t) => {
  const root = fixture(t);
  const file = createDraft(root, 'my-note', '今天：看了什么 # 测试');
  const metadata = Object(yaml.load(fs.readFileSync(file, 'utf8').split('---')[1]));
  assert.equal(metadata.title, '今天：看了什么 # 测试');
  assert.equal(metadata.published, false);
  assert.match(metadata.date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'source/_posts')), ['existing.md']);
  assert.equal(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), '原正式产物');
  assert.throws(() => createDraft(root, 'my-note', '重复标题'), /已存在/);
});

test('当短名含路径穿越或已被文章占用时应该拒绝创建或转换', (t) => {
  const root = fixture(t);
  for (const slug of ['../escape', '/abs', 'x\\y', 'CON', 'nul', 'x.md', '']) assert.throws(() => createDraft(root, slug, '测试'), /短名/);
  assert.throws(() => createDraft(root, 'existing', '占用'), /已存在/);
});

test('当摘要封面或正文尚未填写时应该保留草稿并指出缺项', (t) => {
  const root = fixture(t);
  const file = createDraft(root, 'unfinished', '待写');
  assert.throws(() => preparePost(root, 'unfinished'), /摘要|description/);
  assert.ok(fs.existsSync(file));
  assert.equal(fs.existsSync(path.join(root, 'source/_posts/unfinished.md')), false);
});

test('当显式整理完成稿时应该创建待提交文章和附件且保留原草稿不覆盖旧文', (t) => {
  const root = fixture(t);
  const file = finish(root, 'finished');
  const original = fs.readFileSync(file, 'utf8');
  const result = preparePost(root, 'finished');
  const metadata = Object(yaml.load(fs.readFileSync(result, 'utf8').split('---')[1]));
  assert.equal(metadata.published, true);
  assert.equal(metadata.excerpt, metadata.description);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.equal(fs.readFileSync(path.join(root, 'source/_posts/finished/photo.txt'), 'utf8'), '选定附件');
  assert.throws(() => preparePost(root, 'finished'), /已存在/);
});

test('当预览指定草稿时应该只复制所选内容并隔离正式产物和其它草稿', (t) => {
  const root = fixture(t);
  const draft = finish(root, 'selected');
  createDraft(root, 'other-secret', '不应出现在预览里');
  const state = path.join(root, '.private');
  const preview = createPreviewWorkspace(root, state, 'selected');
  try {
    assert.equal(fs.existsSync(path.join(preview, 'source/_drafts')), false);
    assert.equal(Object(yaml.load(fs.readFileSync(path.join(preview, '_config.butterfly.yml'), 'utf8'))).comments.use, '');
    assert.equal(fs.existsSync(path.join(preview, 'source/_posts/other-secret.md')), false);
    assert.ok(fs.existsSync(path.join(preview, 'source/_posts/selected/photo.txt')));
    const data = Object(yaml.load(fs.readFileSync(path.join(preview, 'source/_posts/selected.md'), 'utf8').split('---')[1]));
    assert.equal(data.published, true);
    assert.equal(data.comments, false);
    assert.match(fs.readFileSync(draft, 'utf8'), /published: false/);
    assert.equal(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), '原正式产物');
    assert.equal(fs.existsSync(path.join(preview, 'public')), false);
  } finally { removePreview(preview); }
  assert.equal(fs.existsSync(preview), false);
  assert.ok(fs.existsSync(path.join(root, 'node_modules')));
  assert.throws(() => removePreview(root), /本次/);
});

test('当不选择草稿预览时应该只复制已发表源码且不带已有public和数据库', (t) => {
  const root = fixture(t);
  createDraft(root, 'private', '私人草稿');
  fs.writeFileSync(path.join(root, 'db.json'), '原数据库');
  const preview = createPreviewWorkspace(root, path.join(root, '.private'));
  try {
    assert.deepEqual(fs.readdirSync(path.join(preview, 'source/_posts')), ['existing.md']);
    assert.equal(fs.existsSync(path.join(preview, 'db.json')), false);
    assert.equal(fs.existsSync(path.join(preview, 'source/_drafts')), false);
  } finally { removePreview(preview); }
});

test('当手填未加引号的日期时应该保持北京时间并拒绝无效日历日期', (t) => {
  const root = fixture(t);
  const file = finish(root, 'manual-date');
  const original = fs.readFileSync(file, 'utf8').replace(/^date:.*$/m, 'date: 2026-10-24 12:00:00');
  fs.writeFileSync(file, original);
  const post = preparePost(root, 'manual-date');
  const data = Object(yaml.load(fs.readFileSync(post, 'utf8').split('---')[1], { schema: yaml.JSON_SCHEMA }));
  assert.equal(data.date, '2026-10-24 12:00:00');
  fs.writeFileSync(file, original.replace('2026-10-24 12:00:00', '2026-02-30 12:00:00'));
  assert.throws(() => preparePost(root, 'manual-date'), /日期/);
});

test('当草稿目录或文章目录是链接时应该拒绝写入链接目的地', (t) => {
  const root = fixture(t);
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside);
  const drafts = path.join(root, 'source/_drafts');
  fs.rmdirSync(drafts);
  fs.symlinkSync(outside, drafts, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createDraft(root, 'escape', '不应写出'), /链接/);
  assert.deepEqual(fs.readdirSync(outside), []);
  fs.unlinkSync(drafts);
  fs.mkdirSync(drafts);
  finish(root, 'safe');
  const posts = path.join(root, 'source/_posts');
  fs.unlinkSync(path.join(posts, 'existing.md'));
  fs.rmdirSync(posts);
  fs.symlinkSync(outside, posts, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => preparePost(root, 'safe'), /链接/);
  assert.deepEqual(fs.readdirSync(outside), []);
});
