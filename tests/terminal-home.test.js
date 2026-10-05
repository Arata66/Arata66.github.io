const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/terminal-home.js'), 'utf8');

function setup(t, data = '[]') {
  const dom = new JSDOM('<button id="other">其他入口</button><div class="recent-posts"></div>' +
    '<script id="terminal-home-data" type="application/json">' + data + '</script>', {
    url: 'https://example.test/', runScripts: 'outside-only'
  });
  const { window } = dom;
  const timers = [];
  window.setTimeout = (callback) => { timers.push(callback); return timers.length; };
  window.WORKS_DATA = [{ name: '博客', desc: 'AI 协作', statusText: '持续更新' }];
  window.document.getElementById('other').focus();
  window.eval(script);
  t.after(() => window.close());
  return { window, document: window.document, flush() { while (timers.length) timers.shift()(); } };
}

function command(app, value) {
  const input = app.document.querySelector('.th-input');
  assert.ok(input instanceof app.window.HTMLInputElement);
  input.value = value;
  input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

test('当首页终端初始化时应该保持现有焦点并提供明确输入名称', (t) => {
  const app = setup(t);
  app.flush();
  const input = app.document.querySelector('.th-input');
  assert.equal(input.hasAttribute('autofocus'), false);
  assert.equal(app.document.activeElement.id, 'other');
  assert.equal(input.getAttribute('aria-label'), '终端命令');
});

test('当用户点击终端并输入帮助时应该正常执行命令', (t) => {
  const app = setup(t);
  app.flush();
  const terminal = app.document.querySelector('.terminal-home');
  assert.ok(terminal instanceof app.window.HTMLElement);
  terminal.click();
  const input = app.document.querySelector('.th-input');
  assert.ok(input instanceof app.window.HTMLInputElement);
  assert.equal(app.document.activeElement, input);
  input.value = 'help';
  input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  app.flush();
  assert.ok(app.document.querySelector('.th-output').textContent.includes('可用命令：'));
  assert.equal(input.value, '');
});

test('当首页重复初始化时应该只有一个终端并保留已有输入', (t) => {
  const app = setup(t);
  app.flush();
  const input = app.document.querySelector('.th-input');
  assert.ok(input instanceof app.window.HTMLInputElement);
  input.value = 'help';
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.flush();
  assert.equal(app.document.querySelectorAll('.terminal-home').length, 1);
  assert.equal(app.document.querySelector('.th-input'), input);
  assert.equal(input.value, 'help');
});

test('当输入文章命令时应该显示构建数据中的标题日期与可点击入口', (t) => {
  const app = setup(t, JSON.stringify([{ title: '新记录 <测试>', date: '2026-10-05', url: '/new/' }]));
  app.flush();
  command(app, 'blog');
  app.flush();
  const link = app.document.querySelector('.th-output a[href="/new/"]');
  assert.equal(link.textContent, '  1. 新记录 <测试> (2026-10-05)');
  assert.ok(app.document.querySelector('.th-output a[href="/archives/"]'));
});

test('当文章数据损坏时应该仍然提供归档入口', (t) => {
  const app = setup(t, '不是 JSON');
  app.flush();
  command(app, 'blog');
  app.flush();
  assert.ok(app.document.querySelector('.th-output a[href="/archives/"]'));
});

test('当文章链接含脚本或外站路径时应该显示文字并拒绝跳转', (t) => {
  const app = setup(t, JSON.stringify([
    { title: '脚本入口', url: 'javascript:alert(1)', date: '2026-10-05' },
    { title: '外站入口', url: '/\\example.org/', date: '2026-10-05' }
  ]));
  app.flush();
  command(app, 'blog');
  app.flush();
  assert.equal(app.document.querySelectorAll('.th-output a').length, 1);
  assert.equal(app.document.querySelector('.th-output a').getAttribute('href'), '/archives/');
  assert.ok(app.document.querySelector('.th-output').textContent.includes('外站入口'));
});

test('当连续输入帮助和清屏时应该停止旧输出', (t) => {
  const app = setup(t);
  app.flush();
  command(app, 'help');
  command(app, 'clear');
  app.flush();
  assert.equal(app.document.querySelector('.th-output').textContent, '');
});

test('当输入对象原型名称时应该作为未知命令提示', (t) => {
  const app = setup(t);
  app.flush();
  command(app, 'constructor');
  app.flush();
  assert.ok(app.document.querySelector('.th-error').textContent.includes('命令未找到: constructor'));
});

test('当查看作品并点击链接时应该使用共用数据且不抢走链接焦点', (t) => {
  const app = setup(t);
  app.flush();
  command(app, 'works');
  app.flush();
  assert.ok(app.document.querySelector('.th-output').textContent.includes('博客'));
  assert.equal(app.document.querySelector('.th-output').textContent.includes('苍穹外卖'), false);
  const link = app.document.querySelector('.th-output a[href="/works/"]');
  assert.ok(link instanceof app.window.HTMLAnchorElement);
  link.addEventListener('click', event => event.preventDefault());
  link.focus();
  link.click();
  assert.equal(app.document.activeElement, link);
});

test('当首页重复初始化时应该保留命令历史', (t) => {
  const app = setup(t);
  app.flush();
  command(app, 'about');
  app.flush();
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.flush();
  const input = app.document.querySelector('.th-input');
  assert.ok(input instanceof app.window.HTMLInputElement);
  input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.equal(input.value, 'about');
});

test('当 Pjax 返回新首页时应该重新读取文章数据并停止旧页面打印', (t) => {
  const app = setup(t);
  app.flush();
  command(app, 'help');
  const oldTerminal = app.document.querySelector('.terminal-home');
  oldTerminal.remove();
  app.document.getElementById('terminal-home-data').textContent = JSON.stringify([
    { title: '返回后的记录', date: '2026-10-05', url: '/returned/' }
  ]);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.flush();
  assert.equal(oldTerminal.querySelector('.th-output').textContent.includes('  about'), false);
  command(app, 'blog');
  app.flush();
  assert.ok(app.document.querySelector('.th-output a[href="/returned/"]'));
});
