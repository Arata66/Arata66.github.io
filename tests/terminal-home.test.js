const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/terminal-home.js'), 'utf8');

function setup(t) {
  const dom = new JSDOM('<button id="other">其他入口</button><div class="recent-posts"></div>', {
    url: 'https://example.test/', runScripts: 'outside-only'
  });
  const { window } = dom;
  const timers = [];
  window.setTimeout = (callback) => { timers.push(callback); return timers.length; };
  window.document.getElementById('other').focus();
  window.eval(script);
  t.after(() => window.close());
  return { window, document: window.document, flush() { while (timers.length) timers.shift()(); } };
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
