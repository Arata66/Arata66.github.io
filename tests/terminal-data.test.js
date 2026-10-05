const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Injector = require('hexo/dist/extend/injector');
const { buildTerminalData, serializeTerminalData } = require('../scripts/terminal-data');

function post(day, extra = {}) {
  return { title: `记录 ${day}`, path: `2026/10/${day}/note/`, date: `2026-10-${day}`,
    timestamp: Number(day), published: true, ...extra };
}

test('当文章含置顶和未发表记录时应该按日期显示最近五篇已发表文章', () => {
  const posts = [post('01', { sticky: 10 }), post('06'), post('03'), post('02'),
    post('05'), post('04'), post('07', { published: false }), post('09')];
  const before = JSON.stringify(posts);
  assert.deepEqual(buildTerminalData(posts, 6).map(p => p.title), ['记录 06', '记录 05', '记录 04', '记录 03', '记录 02']);
  assert.equal(JSON.stringify(posts), before);
  assert.deepEqual(buildTerminalData([post('03')], 6), [
    { title: '记录 03', url: '/2026/10/03/note/', date: '2026-10-03' }
  ]);
});

test('当站点允许未来文章时应该包含已发表的未来记录', () => {
  assert.equal(buildTerminalData([post('09')], 6, true)[0].title, '记录 09');
});

test('当文章标题包含脚本结束标签时应该保留内容并安全嵌入页面', () => {
  const data = [{ title: '</script><script>alert(1)</script>', url: '/note/', date: '2026-10-05' }];
  const json = serializeTerminalData(data);
  assert.equal(json.includes('<'), false);
  assert.deepEqual(JSON.parse(json), data);
});

test('当 Hexo 在注册脚本后加载文章并重新生成时应该输出最新数据且不重复注入', () => {
  const filters = new Map();
  const injector = new Injector();
  let loaded = [];
  const hexo = {
    config: { future: false },
    locals: { get: () => ({ data: loaded }) },
    extend: { injector, filter: { register: (name, callback) => filters.set(name, callback) } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/terminal-data.js'), 'utf8'), { hexo, module: { exports: {} } });
  function generate(title) {
    loaded = [{ title, path: 'note/', published: true, date: {
      format: () => '2026-10-05', valueOf: () => 1
    } }];
    if (filters.has('before_generate')) filters.get('before_generate')();
    let html = '<html><body>页面</body></html>';
    if (filters.has('after_render:html')) html = filters.get('after_render:html')(html);
    return injector.exec(html);
  }
  assert.ok(generate('第一篇').includes('第一篇'));
  const updated = generate('更新后的文章');
  assert.ok(updated.includes('更新后的文章'));
  assert.equal(updated.includes('第一篇'), false);
  assert.equal((updated.match(/id="terminal-home-data"/g) || []).length, 1);
});
