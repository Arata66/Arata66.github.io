const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const coreScript = fs.readFileSync(path.join(__dirname, '../source/js/browser-tools-core.js'), 'utf8');
const uiScript = fs.readFileSync(path.join(__dirname, '../source/js/browser-tools.js'), 'utf8');
const markup = fs.readFileSync(path.join(__dirname, '../source/tools/index.md'), 'utf8').replace(/^---[\s\S]*?---/, '');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t, writeText = async () => {}) {
  const dom = new JSDOM(markup, { url: 'https://arata66.top/tools/', runScripts: 'outside-only' });
  const { window } = dom;
  const downloads = [];
  const revoked = [];
  Object.defineProperty(window, 'fetch', { value: () => { throw new Error('工具不得请求网络'); } });
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('工具不得保存输入'); } });
  Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('工具不得写入会话存储'); } });
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText } });
  window.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:test-output'; };
  window.URL.revokeObjectURL = url => revoked.push(url);
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, href: this.href }); };
  window.eval(coreScript); window.eval(uiScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  return { window, document: window.document, core: window.BLOG_TOOLS, downloads, revoked };
}

function field(app, id) { const node = app.document.getElementById(id); assert.ok(node); return node; }
function action(app, name) { const node = app.document.querySelector(`[data-tool-action="${name}"]`); assert.ok(node); return node; }
function input(app, id, value) { const node = field(app, id); node.value = value; node.dispatchEvent(new app.window.Event('input')); }

function enter(app, id, options = {}) {
  const event = new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
  field(app, id).dispatchEvent(event);
  return event;
}

function leaveTools(app) {
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.body.innerHTML = '<main>其他页面</main>';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
}

function returnToTools(app) {
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.body.innerHTML = markup;
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
}

test('当在JSON原始内容按Ctrl或Meta加Enter时应该按当前缩进格式化并保留输入焦点', t => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    const app = setup(t);
    const source = '{"编号":900719925474099312345,"文本":"继续处理"}';
    input(app, 'json-input', source);
    field(app, 'json-indent').value = '4';
    field(app, 'json-input').focus();
    const event = enter(app, 'json-input', { [modifier]: true });
    assert.equal(event.defaultPrevented, true);
    assert.match(field(app, 'json-output').value, /\n {4}"编号": 900719925474099312345/);
    assert.equal(field(app, 'json-input').value, source);
    assert.equal(app.document.activeElement, field(app, 'json-input'));
    assert.equal(action(app, 'json-copy').disabled, false);
    assert.match(field(app, 'json-status').textContent, /4 个空格/);
  }
});

test('当在时间戳输入框按Enter时应该按当前单位和时区完成转换', t => {
  for (const [unit, value] of [['seconds', '1.234'], ['milliseconds', '1234']]) {
    const app = setup(t);
    field(app, 'timestamp-unit').value = unit;
    field(app, 'time-zone').value = '0';
    input(app, 'timestamp-input', value);
    const event = enter(app, 'timestamp-input');
    assert.equal(event.defaultPrevented, true);
    assert.equal(field(app, 'timestamp-ms').value, '1234');
    assert.equal(field(app, 'timestamp-seconds').value, '1.234');
    assert.equal(field(app, 'date-input').value, '1970-01-01T00:00:01.234');
    assert.equal(action(app, 'time-copy-ms').disabled, false);
  }
});

test('当在日期输入框按Ctrl或Meta加Enter时应该按所选时区转换时间戳', t => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    const app = setup(t);
    input(app, 'date-input', '2026-10-27T09:02:03.456');
    const event = enter(app, 'date-input', { [modifier]: true });
    assert.equal(event.defaultPrevented, true);
    assert.equal(field(app, 'timestamp-ms').value, String(Date.UTC(2026, 9, 27, 1, 2, 3, 456)));
    assert.match(field(app, 'time-status').textContent, /转换完成.*北京时间/);
  }
});

test('当普通换行或操作只读结果及其他控件时应该保留原生按键行为', t => {
  const app = setup(t);
  input(app, 'json-input', '{"内容":true}');
  for (const [id, options] of [['json-input', {}], ['json-output', { ctrlKey: true }], ['date-input', {}], ['json-indent', { ctrlKey: true }], ['timestamp-input', { altKey: true }], ['timestamp-input', { shiftKey: true }]]) {
    assert.equal(enter(app, id, options).defaultPrevented, false);
  }
  assert.equal(field(app, 'json-output').value, '');
  assert.equal(field(app, 'timestamp-ms').value, '');
});

test('当中文组字尚未结束时应该保留候选按键且失焦后可以继续使用快捷操作', t => {
  const app = setup(t);
  input(app, 'json-input', '{"文本":"中文"}');
  const editor = field(app, 'json-input'); editor.focus();
  editor.dispatchEvent(new app.window.CompositionEvent('compositionstart', { bubbles: true }));
  for (const isComposing of [true, false]) assert.equal(enter(app, 'json-input', { ctrlKey: true, isComposing }).defaultPrevented, false);
  assert.equal(field(app, 'json-output').value, '');
  editor.dispatchEvent(new app.window.CompositionEvent('compositionend', { bubbles: true }));
  assert.equal(enter(app, 'json-input', { ctrlKey: true, isComposing: true }).defaultPrevented, false);
  editor.dispatchEvent(new app.window.CompositionEvent('compositionstart', { bubbles: true }));
  editor.blur(); editor.focus();
  assert.equal(enter(app, 'json-input', { ctrlKey: true }).defaultPrevented, true);
  assert.match(field(app, 'json-output').value, /"文本": "中文"/);
});

test('当输入法先结束组字再派发确认键时应该保留确认且下一次按键可正常处理', t => {
  for (const { id, source, options, output } of [
    { id: 'json-input', source: '{"文本":"中文"}', options: { ctrlKey: true }, output: 'json-output' },
    { id: 'timestamp-input', source: '0', options: {}, output: 'timestamp-ms' }
  ]) {
    const app = setup(t);
    input(app, id, source);
    const editor = field(app, id);
    editor.dispatchEvent(new app.window.CompositionEvent('compositionstart', { bubbles: true }));
    editor.dispatchEvent(new app.window.CompositionEvent('compositionend', { bubbles: true }));
    assert.equal(enter(app, id, { ...options, keyCode: 229, isComposing: false }).defaultPrevented, false);
    assert.equal(field(app, output).value, '');
    assert.equal(enter(app, id, options).defaultPrevented, true);
    assert.notEqual(field(app, output).value, '');
  }
});

test('当快捷处理遇到无效输入时应该沿用校验反馈并停用旧结果', t => {
  const app = setup(t);
  input(app, 'json-input', '{}'); action(app, 'json-format').click();
  input(app, 'json-input', '{"缺少":}'); enter(app, 'json-input', { ctrlKey: true });
  assert.equal(field(app, 'json-output').value, '');
  assert.equal(action(app, 'json-copy').disabled, true);
  assert.match(field(app, 'json-status').textContent, /JSON 格式有误/);
  input(app, 'timestamp-input', '0'); action(app, 'time-from-stamp').click();
  input(app, 'timestamp-input', '不是时间戳'); enter(app, 'timestamp-input');
  assert.equal(field(app, 'timestamp-ms').value, '');
  assert.equal(action(app, 'time-copy-ms').disabled, true);
  assert.match(field(app, 'time-status').textContent, /有效秒数/);
});

test('当长按快捷键产生重复事件时应该阻止额外换行且不反复处理', t => {
  const app = setup(t);
  input(app, 'json-input', '{"内容":true}');
  assert.equal(enter(app, 'json-input', { ctrlKey: true, repeat: true }).defaultPrevented, true);
  assert.equal(field(app, 'json-output').value, '');
  enter(app, 'json-input', { ctrlKey: true });
  assert.match(field(app, 'json-output').value, /"内容": true/);
});

test('当切页等待中再按快捷键时应该停止旧处理且返回后可处理最新输入', t => {
  const app = setup(t);
  input(app, 'json-input', '{"版本":1}'); action(app, 'json-format').click();
  const previous = field(app, 'json-output').value;
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  input(app, 'json-input', '{"版本":2}');
  assert.equal(enter(app, 'json-input', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(field(app, 'json-output').value, previous);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  enter(app, 'json-input', { ctrlKey: true });
  assert.match(field(app, 'json-output').value, /"版本": 2/);
});

test('当站内切页后返回工具时应该恢复JSON输入与结果并能继续修改', t => {
  const app = setup(t);
  const source = '{"编号":900719925474099312345,"文本":"继续处理"}';
  input(app, 'json-input', source);
  field(app, 'json-indent').value = '4';
  action(app, 'json-format').click();
  const output = field(app, 'json-output').value;
  leaveTools(app);
  returnToTools(app);
  assert.equal(field(app, 'json-input').value, source);
  assert.equal(field(app, 'json-indent').value, '4');
  assert.equal(field(app, 'json-output').value, output);
  assert.equal(action(app, 'json-copy').disabled, false);
  assert.equal(action(app, 'json-download').disabled, false);
  assert.match(field(app, 'json-status').textContent, /恢复/);
  input(app, 'json-input', '[]');
  assert.equal(field(app, 'json-output').value, '');
  assert.equal(action(app, 'json-copy').disabled, true);
  action(app, 'json-minify').click();
  assert.equal(field(app, 'json-output').value, '[]');
});

test('当零时间戳转换后离页返回时应该保留单位时区和结果', t => {
  const app = setup(t);
  field(app, 'timestamp-unit').value = 'milliseconds';
  field(app, 'time-zone').value = '0';
  input(app, 'timestamp-input', '0');
  action(app, 'time-from-stamp').click();
  const date = field(app, 'date-input').value;
  leaveTools(app);
  returnToTools(app);
  assert.equal(field(app, 'timestamp-input').value, '0');
  assert.equal(field(app, 'timestamp-unit').value, 'milliseconds');
  assert.equal(field(app, 'time-zone').value, '0');
  assert.equal(field(app, 'date-input').value, date);
  assert.equal(field(app, 'timestamp-ms').value, '0');
  assert.equal(action(app, 'time-copy-ms').disabled, false);
  field(app, 'time-zone').value = '480';
  field(app, 'time-zone').dispatchEvent(new app.window.Event('change'));
  assert.match(field(app, 'date-input').value, /T08:00/);
  assert.equal(field(app, 'timestamp-ms').value, '0');
});

test('当尚未完成输入或清空后再次返回时应该保留最新内容并停用无效输出', t => {
  const app = setup(t);
  input(app, 'json-input', '{"未完成":');
  input(app, 'timestamp-input', '还没填完');
  leaveTools(app);
  returnToTools(app);
  assert.equal(field(app, 'json-input').value, '{"未完成":');
  assert.equal(field(app, 'timestamp-input').value, '还没填完');
  assert.equal(action(app, 'json-copy').disabled, true);
  assert.equal(action(app, 'time-copy-ms').disabled, true);
  action(app, 'json-clear').click();
  leaveTools(app);
  returnToTools(app);
  assert.equal(field(app, 'json-input').value, '');
  assert.equal(field(app, 'json-output').value, '');
  assert.equal(action(app, 'json-copy').disabled, true);
});

test('当复制等待时离页返回后旧请求完成时应该不覆盖恢复状态或抢焦点', async t => {
  const replies = [];
  const app = setup(t, () => new Promise(resolve => { replies.push(resolve); }));
  input(app, 'json-input', '{"test":1}');
  action(app, 'json-format').click();
  action(app, 'json-copy').focus();
  action(app, 'json-copy').click();
  leaveTools(app);
  returnToTools(app);
  const status = field(app, 'json-status').textContent;
  field(app, 'json-input').focus();
  assert.equal(replies.length, 1);
  replies[0]();
  await flush();
  assert.equal(field(app, 'json-input').value, '{"test":1}');
  assert.equal(field(app, 'json-status').textContent, status);
  assert.doesNotMatch(status, /正在复制|已复制/);
  assert.equal(app.document.activeElement, field(app, 'json-input'));
  assert.equal(action(app, 'json-copy').disabled, false);
});

test('当完整刷新或打开新标签页时应该从空白开始且不同页面上下文互不共享输入', t => {
  const first = setup(t);
  input(first, 'json-input', '{"临时":true}');
  leaveTools(first);
  const fresh = setup(t);
  assert.equal(field(fresh, 'json-input').value, '');
  assert.equal(field(fresh, 'json-output').value, '');
  returnToTools(first);
  assert.equal(field(first, 'json-input').value, '{"临时":true}');
});

test('当导航等待期间修改JSON后导航取消时应该保留新输入并停用旧结果', t => {
  const app = setup(t);
  input(app, 'json-input', '{"版本":1}'); action(app, 'json-format').click();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  input(app, 'json-input', '{"版本":2}');
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  assert.equal(field(app, 'json-input').value, '{"版本":2}');
  assert.equal(field(app, 'json-output').value, '');
  assert.equal(action(app, 'json-copy').disabled, true);
  action(app, 'json-format').click();
  assert.match(field(app, 'json-output').value, /"版本": 2/);
});

test('当导航等待期间修改时间输入或选项后导航取消时应该保留最新值并停用旧结果', t => {
  for (const [id, value] of [['timestamp-input', '1'], ['timestamp-unit', 'milliseconds'], ['time-zone', '0'], ['date-input', '2000-01-01T00:00']]) {
    const app = setup(t);
    input(app, 'timestamp-input', '0'); action(app, 'time-from-stamp').click();
    app.document.dispatchEvent(new app.window.Event('pjax:send'));
    input(app, id, value);
    app.document.dispatchEvent(new app.window.Event('pjax:complete'));
    assert.equal(field(app, id).value, value);
    assert.equal(field(app, 'timestamp-ms').value, '');
    assert.equal(action(app, 'time-copy-ms').disabled, true);
  }
});

test('当格式化 JSON 长编号与特殊字符串时应该保留原始数字和转义写法', t => {
  const app = setup(t);
  const source = '{"id":900719925474099312345,"x":1.2300e+04,"text":"a\\"{x}\\n你好","id":2}';
  const formatted = app.core.formatJSON(source, 4);
  assert.match(formatted, /900719925474099312345/);
  assert.match(formatted, /1\.2300e\+04/);
  assert.match(formatted, /\n {4}"id"/);
  assert.equal(app.core.formatJSON(formatted, 0), source);
  assert.equal((formatted.match(/"id"/g) || []).length, 2);
});

test('当 JSON 为数组或单一值时应该正确处理空容器、布尔和字符串', t => {
  const { core } = setup(t);
  for (const source of ['[]', '{}', 'true', 'null', '9007199254740993', '"你好"']) assert.equal(core.formatJSON(source, 2), source);
  assert.equal(core.formatJSON('[{},[],{"a":[1,2]}]', 0), '[{},[],{"a":[1,2]}]');
  assert.deepEqual(JSON.parse(core.formatJSON('[{},[],{"a":[1,2]}]', 2)), [{}, [], { a: [1, 2] }]);
});

test('当 JSON 无效或超过处理上限时应该给出中文错误并允许修正', t => {
  const app = setup(t);
  for (const source of ['', '{"a":1,}', 'undefined', '"未结束', '0'.repeat(200001), '['.repeat(101) + '0' + ']'.repeat(101)]) {
    assert.throws(() => app.core.formatJSON(source, 2), /输入|格式|字符|层/);
  }
  input(app, 'json-input', '{"a":1,}'); action(app, 'json-format').click();
  assert.match(field(app, 'json-status').textContent, /格式有误/);
  assert.equal(action(app, 'json-copy').disabled, true);
  input(app, 'json-input', '{"a":1}'); action(app, 'json-format').click();
  assert.match(field(app, 'json-output').value, /"a": 1/);
  assert.equal(action(app, 'json-copy').disabled, false);
});

test('当输入内容在生成后发生变化时应该停用旧输出的复制与下载', t => {
  const app = setup(t);
  action(app, 'json-example').click(); action(app, 'json-format').click();
  assert.ok(field(app, 'json-output').value);
  input(app, 'json-input', '{}');
  assert.equal(field(app, 'json-output').value, '');
  assert.equal(action(app, 'json-copy').disabled, true);
  assert.equal(action(app, 'json-download').disabled, true);
  action(app, 'json-minify').click();
  assert.equal(field(app, 'json-output').value, '{}');
  action(app, 'json-clear').click();
  assert.equal(field(app, 'json-input').value, '');
});

test('当下载处理后的 JSON 时应该下载相同内容并回收临时地址', async t => {
  const app = setup(t);
  input(app, 'json-input', '{"id":9007199254740993}'); action(app, 'json-format').click();
  action(app, 'json-download').click();
  await flush();
  assert.equal(app.downloads.length, 2);
  assert.equal(app.downloads[1].name, 'formatted.json');
  assert.equal(app.downloads[1].href, 'blob:test-output');
  assert.deepEqual(app.revoked, ['blob:test-output']);
  assert.equal(app.downloads[0].size, new TextEncoder().encode(field(app, 'json-output').value).length);
});

test('当时间戳包含负数或小数秒时应该精确换算毫秒而不受机器时区影响', t => {
  const { core } = setup(t);
  assert.equal(core.parseTimestamp('0', 'seconds'), 0);
  assert.equal(core.parseTimestamp('-0.001', 'seconds'), -1);
  assert.equal(core.parseTimestamp('1700000000.123', 'seconds'), 1700000000123);
  assert.equal(core.parseTimestamp('1700000000123', 'milliseconds'), 1700000000123);
  assert.equal(core.formatDate(1700000000123, 0), '2023-11-14T22:13:20.123');
  assert.equal(core.formatDate(1700000000123, 480), '2023-11-15T06:13:20.123');
  assert.equal(core.formatSeconds(-1001), '-1.001');
  assert.equal(core.formatSeconds(-1), '-0.001');
});

test('当日期转换为时间戳时应该尊重所选时区并拒绝无效日历日期', t => {
  const { core } = setup(t);
  assert.equal(core.dateToTimestamp('1970-01-01T08:00', 480), 0);
  assert.equal(core.dateToTimestamp('1970-01-01T00:00:00.001', 0), 1);
  assert.equal(core.dateToTimestamp('1969-12-31T23:59:59.999', 0), -1);
  for (const source of ['2026-02-30T12:00', '2026-13-01T12:00', '2026-10-24T25:00', '']) assert.throws(() => core.dateToTimestamp(source, 480), /日期|时间/);
  for (const source of ['abc', '1.0001', '900719925474099312345']) assert.throws(() => core.parseTimestamp(source, 'seconds'), /数|范围|位/);
});

test('当使用时间转换界面时应该双向转换、切换时区且使修改后的旧结果失效', t => {
  const app = setup(t);
  input(app, 'timestamp-input', '0'); action(app, 'time-from-stamp').click();
  assert.equal(field(app, 'date-input').value, '1970-01-01T08:00');
  assert.equal(field(app, 'timestamp-ms').value, '0');
  field(app, 'time-zone').value = '0'; field(app, 'time-zone').dispatchEvent(new app.window.Event('change'));
  assert.equal(field(app, 'date-input').value, '1970-01-01T00:00');
  input(app, 'date-input', '2023-11-14T22:13:20.123'); action(app, 'time-from-date').click();
  assert.equal(field(app, 'timestamp-seconds').value, '1700000000.123');
  assert.equal(field(app, 'timestamp-ms').value, '1700000000123');
  assert.equal(field(app, 'timestamp-input').value, '1700000000.123');
  input(app, 'timestamp-input', 'abc');
  assert.equal(action(app, 'time-copy-ms').disabled, true);
  action(app, 'time-from-stamp').click();
  assert.match(field(app, 'time-status').textContent, /数/);
});

test('当导航失败保留时间结果后继续切换时区时应该恢复同一时刻', t => {
  const app = setup(t);
  input(app, 'timestamp-input', '0'); action(app, 'time-from-stamp').click();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  field(app, 'time-zone').value = '0'; field(app, 'time-zone').dispatchEvent(new app.window.Event('change'));
  assert.equal(field(app, 'date-input').value, '1970-01-01T00:00');
  assert.equal(field(app, 'timestamp-ms').value, '0');
});

test('当切换时区使日期超过显示范围时应该提示并停用旧结果', t => {
  const app = setup(t);
  field(app, 'time-zone').value = '0';
  input(app, 'timestamp-input', '253402300799.999'); action(app, 'time-from-stamp').click();
  assert.equal(field(app, 'date-input').value, '9999-12-31T23:59:59.999');
  field(app, 'time-zone').value = '480'; field(app, 'time-zone').dispatchEvent(new app.window.Event('change'));
  assert.match(field(app, 'time-status').textContent, /范围|年份/);
  assert.equal(action(app, 'time-copy-ms').disabled, true);
});

test('当时间戳对应零年而日期控件不能显示时应该明确拒绝转换', t => {
  const app = setup(t);
  field(app, 'time-zone').value = '0';
  input(app, 'timestamp-input', '-62167219200'); action(app, 'time-from-stamp').click();
  assert.match(field(app, 'time-status').textContent, /年份/);
  assert.equal(action(app, 'time-copy-ms').disabled, true);
  assert.throws(() => app.core.dateToTimestamp('0000-01-01T00:00', 0), /年份/);
});

test('当连续处理不同结果并复制时应该只保留本次复制的取消状态', async t => {
  const replies = [];
  const app = setup(t, () => new Promise((resolve, reject) => replies.push({ resolve, reject })));
  input(app, 'json-input', '{}'); action(app, 'json-format').click(); action(app, 'json-copy').click();
  input(app, 'json-input', '[]'); action(app, 'json-format').click(); action(app, 'json-copy').click();
  replies[0].resolve(); await flush();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.doesNotMatch(field(app, 'json-status').textContent, /正在复制/);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  replies[1].reject(new Error('拒绝访问')); await flush();
  assert.equal(action(app, 'json-copy').disabled, false);
  assert.equal(field(app, 'json-output').value, '[]');
});

test('当用户取得当前时间时应该生成当前毫秒与对应日期而不启动定时器', t => {
  const app = setup(t);
  const before = Date.now(); action(app, 'time-now').click(); const after = Date.now();
  const result = Number(field(app, 'timestamp-ms').value);
  assert.ok(result >= before && result <= after);
  assert.equal(field(app, 'timestamp-unit').value, 'milliseconds');
  assert.ok(field(app, 'date-input').value);
});

test('当复制失败时应该保留可手动选择的结果并允许再次复制', async t => {
  let rejects = true;
  const copied = [];
  const app = setup(t, async value => { if (rejects) throw new Error('拒绝访问'); copied.push(value); });
  input(app, 'json-input', '{}'); action(app, 'json-format').click();
  action(app, 'json-copy').focus(); action(app, 'json-copy').click(); await flush();
  assert.equal(app.document.activeElement, field(app, 'json-output'));
  assert.equal(field(app, 'json-output').selectionEnd, 2);
  assert.match(field(app, 'json-status').textContent, /手动复制/);
  rejects = false; action(app, 'json-copy').click(); await flush();
  assert.deepEqual(copied, ['{}']);
});

test('当剪贴板持续没有响应时应该超时恢复按钮并允许手动复制', async t => {
  const app = setup(t, () => new Promise(() => {}));
  const timers = [];
  Object.defineProperty(app.window, 'setTimeout', { value: (callback, delay) => { timers.push({ callback, delay }); return 77; } });
  input(app, 'json-input', '{}'); action(app, 'json-format').click();
  action(app, 'json-copy').focus(); action(app, 'json-copy').click();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 3000);
  timers[0].callback(); await flush();
  assert.equal(action(app, 'json-copy').disabled, false);
  assert.match(field(app, 'json-status').textContent, /手动复制/);
  assert.equal(app.document.activeElement, field(app, 'json-output'));
});

test('当复制期间切页或更改结果时应该忽略旧回调且重复初始化不重复复制', async t => {
  const replies = [];
  const app = setup(t, () => new Promise((resolve, reject) => replies.push({ resolve, reject })));
  input(app, 'json-input', '{}'); action(app, 'json-format').click();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  action(app, 'json-copy').click();
  assert.equal(replies.length, 1);
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  const link = app.document.createElement('a'); link.href = '/music/'; app.document.body.append(link); link.focus();
  const before = field(app, 'json-status').textContent;
  replies[0].reject(new Error('拒绝访问')); await flush();
  assert.equal(app.document.activeElement, link);
  assert.equal(field(app, 'json-status').textContent, before);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  action(app, 'json-copy').click();
  input(app, 'json-input', '[]'); action(app, 'json-format').click();
  replies[1].resolve(); await flush();
  assert.equal(field(app, 'json-output').value, '[]');
  assert.doesNotMatch(field(app, 'json-status').textContent, /已复制/);
});
