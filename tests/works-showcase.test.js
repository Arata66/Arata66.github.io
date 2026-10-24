const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { JSDOM } = require('jsdom');
const { readWorks, renderWorks, enhanceWorks } = require('../scripts/works-showcase');

function fixture(t, content) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-works-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'works.yml');
  fs.writeFileSync(file, content);
  return file;
}

test('当浏览器没有脚本时应该仍能阅读两个真实项目并访问记录和源码', (t) => {
  const projects = readWorks(path.join(__dirname, '../source/_data/works.yml'));
  const dom = new JSDOM(renderWorks(projects));
  t.after(() => dom.window.close());
  const document = dom.window.document;
  assert.equal(document.querySelectorAll('.works-project').length, 2);
  assert.deepEqual([...document.querySelectorAll('h2')].map(x => x.textContent), ['Arata66 の Blog', 'OtakuLog']);
  assert.equal(document.querySelectorAll('.works-features li').length, 6);
  assert.ok(document.querySelector('a[href="/2026/06/29/otakulog/"]'));
  assert.ok(document.querySelector('a[href="https://github.com/Arata66/OtakuLog"]'));
  assert.match(document.querySelector('#work-otakulog figcaption').textContent, /文章封面/);
  assert.ok(!document.querySelector('.works-filters'));
  assert.match(document.querySelector('#work-blog img').getAttribute('src'), /blog-home-20261024\.jpg$/);
});

test('当项目文案包含特殊字符时应该作为文字显示且外链有安全属性', (t) => {
  const projects = readWorks(path.join(__dirname, '../source/_data/works.yml'));
  projects[0].name = '<img src=x onerror=alert(1)>';
  const dom = new JSDOM(renderWorks(projects));
  t.after(() => dom.window.close());
  const document = dom.window.document;
  assert.equal(document.querySelector('h2').textContent, projects[0].name);
  assert.equal(document.querySelector('img[onerror]'), null);
  for (const link of document.querySelectorAll('a[href^="https:"]')) {
    assert.equal(link.getAttribute('target'), '_blank');
    assert.match(link.getAttribute('rel'), /noopener/);
  }
});

test('当项目数据含危险或伪装链接时应该中止构建并说明字段', (t) => {
  const original = fs.readFileSync(path.join(__dirname, '../source/_data/works.yml'), 'utf8');
  for (const unsafe of ['javascript:alert(1)', '//evil.test/', '/\\evil.test/', 'https://github.com.evil.test/a', 'https://user@github.com/a', '/%5cevil.test/']) {
    const content = original.replace('https://github.com/Arata66/OtakuLog', unsafe);
    assert.throws(() => readWorks(fixture(t, content)), /作品链接/);
  }
});

test('当项目内容缺少必需字段或编号重复时应该明确报错', (t) => {
  assert.throws(() => readWorks(fixture(t, '- name: 只有名称')), /作品缺少/);
  const original = fs.readFileSync(path.join(__dirname, '../source/_data/works.yml'), 'utf8');
  assert.throws(() => readWorks(fixture(t, original.replace('id: otakulog', 'id: blog'))), /作品编号/);
});

test('当只更新作品数据后再次构建缓存页面时应该替换旧内容且不重复项目', (t) => {
  const projects = readWorks(path.join(__dirname, '../source/_data/works.yml'));
  const cached = enhanceWorks('<html><head><title>作品展示</title></head><body><div id="works-showcase"></div></body></html>', projects);
  const previous = projects[0].desc;
  projects[0].desc = '数据更新后的新介绍';
  const dom = new JSDOM(enhanceWorks(cached, projects));
  t.after(() => dom.window.close());
  const document = dom.window.document;
  assert.equal(document.title, '作品展示');
  assert.equal(document.querySelectorAll('.works-project').length, 2);
  assert.match(document.querySelector('#work-blog').textContent, /数据更新后的新介绍/);
  assert.ok(!document.querySelector('#work-blog').textContent.includes(previous));
});
