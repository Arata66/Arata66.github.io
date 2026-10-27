const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '../source/js/subscription.js'), 'utf8');
const markup = '<section class="subscription-page"><input class="subscription-url" aria-label="订阅地址" readonly value="https://arata66.top/atom.xml"><button class="subscription-copy" hidden>复制订阅地址</button><p class="subscription-feedback" role="status">也可以选中地址手动复制。</p></section>';

function setup(t, writeText, html = markup, fakeClock = false) {
  const dom = new JSDOM(html, { url: 'https://arata66.top/subscribe/', runScripts: 'outside-only' });
  const { window } = dom;
  const timers = new Map();
  let timerId = 0;
  if (fakeClock) {
    Object.defineProperty(window, 'setTimeout', { value: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; } });
    Object.defineProperty(window, 'clearTimeout', { value: id => timers.delete(id) });
  }
  Object.defineProperty(window.navigator, 'clipboard', { value: writeText ? { writeText } : undefined });
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  t.after(() => window.close());
  const button = window.document.querySelector('button');
  assert.ok(button instanceof window.HTMLButtonElement);
  return { window, document: window.document, button, flush: () => new Promise(resolve => setImmediate(resolve)), timerCount: () => timers.size,
    advance(milliseconds) { for (const [id, timer] of [...timers]) if (timer.delay <= milliseconds) { timers.delete(id); timer.callback(); } }
  };
}

test('当订阅复制一直不返回时应该在三秒后允许手动复制并恢复按钮', async t => {
  const app = setup(t, () => new Promise(() => {}), markup, true);
  app.button.focus(); app.button.click();
  app.advance(3000); await app.flush();
  const input = app.document.querySelector('input');
  assert.equal(input.value, 'https://arata66.top/atom.xml');
  assert.equal(app.document.activeElement, input);
  assert.equal(input.selectionEnd - input.selectionStart, input.value.length);
  assert.match(app.document.querySelector('[role="status"]').textContent, /手动复制/);
  assert.equal(app.button.disabled, false);
  assert.equal(app.timerCount(), 0);
});

test('当订阅复制超时后重试时应该忽略旧结果并保留新操作的等待和反馈', async t => {
  const replies = [];
  const app = setup(t, () => new Promise(resolve => replies.push(resolve)), markup, true);
  app.button.click(); app.advance(3000); await app.flush();
  app.button.click();
  replies[0](); await app.flush();
  assert.equal(app.button.disabled, true);
  assert.match(app.document.querySelector('[role="status"]').textContent, /正在复制/);
  assert.equal(app.timerCount(), 1);
  replies[1](); await app.flush();
  assert.equal(app.button.disabled, false);
  assert.match(app.document.querySelector('[role="status"]').textContent, /已复制/);
  assert.equal(app.timerCount(), 0);
});

test('当订阅复制等待中导航失败留在原页时应该取消等待并立即支持新的复制', async t => {
  const replies = [];
  const app = setup(t, () => new Promise(resolve => replies.push(resolve)), markup, true);
  app.button.click();
  app.document.dispatchEvent(new app.window.Event('pjax:send'));
  assert.equal(app.button.disabled, false);
  assert.match(app.document.querySelector('[role="status"]').textContent, /取消/);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.button.click(); await app.flush();
  assert.equal(app.button.disabled, true);
  replies[0](); await app.flush();
  assert.match(app.document.querySelector('[role="status"]').textContent, /正在复制/);
  replies[1](); await app.flush();
  assert.equal(app.button.disabled, false);
  assert.match(app.document.querySelector('[role="status"]').textContent, /已复制/);
  assert.equal(app.timerCount(), 0);
});

test('当订阅复制等待期间转去输入或离开窗口时应该保留新焦点和内容', async t => {
  for (const mode of ['page', 'frame', 'window']) {
    const app = setup(t, () => new Promise(() => {}), markup, true);
    app.button.focus(); app.button.click();
    const frame = app.document.createElement('iframe');
    if (mode === 'frame') app.document.body.append(frame);
    const owner = mode === 'frame' ? frame.contentDocument : app.document;
    const input = owner.createElement('textarea'); owner.body.append(input);
    if (mode !== 'window') input.focus();
    input.value = '正在输入';
    if (mode === 'window') app.window.dispatchEvent(new app.window.Event('blur'));
    const focus = app.document.activeElement;
    const ownerFocus = owner.activeElement;
    app.advance(3000); await app.flush();
    assert.equal(app.document.activeElement, focus);
    assert.equal(owner.activeElement, ownerFocus);
    assert.equal(input.value, '正在输入');
    assert.equal(app.button.disabled, false);
    assert.match(app.document.querySelector('[role="status"]').textContent, /手动复制/);
  }
});

test('当用户复制订阅地址成功时应该反馈成功并保持可以再次操作', async (t) => {
  const copied = [];
  const app = setup(t, async value => { copied.push(value); });
  assert.equal(app.button.hidden, false);
  app.button.click();
  await app.flush();
  assert.deepEqual(copied, ['https://arata66.top/atom.xml']);
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('已复制'));
  assert.equal(app.button.disabled, false);
});

test('当用户选择不同订阅渠道时应该分别复制对应地址并只更新本渠道反馈', async t => {
  const copied = [];
  const channel = name => markup.replace('subscription-page', 'subscription-channel').replace('atom.xml', name);
  const html = `<section class="subscription-page">${['updates.xml', 'atom.xml', 'journal.xml'].map(channel).join('')}</section>`;
  const app = setup(t, async value => { copied.push(value); }, html);
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  const buttons = [...app.document.querySelectorAll('button')];
  for (const [index, button] of buttons.entries()) {
    assert.equal(button.hidden, false);
    button.click();
    await app.flush();
    assert.equal(copied.length, index + 1);
    assert.match(button.closest('.subscription-channel').querySelector('[role="status"]').textContent, /已复制/);
    if (index < 2) assert.doesNotMatch(buttons[index + 1].closest('.subscription-channel').querySelector('[role="status"]').textContent, /已复制/);
  }
  assert.deepEqual(copied, ['https://arata66.top/updates.xml', 'https://arata66.top/atom.xml', 'https://arata66.top/journal.xml']);
});

test('当剪贴板拒绝访问时应该提供手动复制且允许再试', async (t) => {
  let reject = true;
  const app = setup(t, async () => { if (reject) throw new Error('拒绝访问'); });
  app.button.click();
  await app.flush();
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('手动复制'));
  const input = app.document.querySelector('input');
  assert.equal(app.document.activeElement, input);
  assert.equal(input.selectionStart, 0);
  assert.equal(input.selectionEnd, input.value.length);
  reject = false;
  app.button.click();
  await app.flush();
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('已复制'));
});

test('当浏览器不支持剪贴板时应该仍然允许手动复制地址', async (t) => {
  const app = setup(t);
  app.button.click();
  await app.flush();
  assert.equal(app.document.activeElement.getAttribute('aria-label'), '订阅地址');
  assert.ok(app.document.querySelector('[role="status"]').textContent.includes('手动复制'));
});

test('当 Pjax 重复初始化或返回新订阅页时应该每次点击只复制一次', async (t) => {
  let count = 0;
  const app = setup(t, async () => { count++; });
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  app.button.click();
  await app.flush();
  assert.equal(count, 1);
  app.document.body.innerHTML = markup;
  app.document.dispatchEvent(new app.window.Event('pjax:complete'));
  const returned = app.document.querySelector('button');
  assert.ok(returned instanceof app.window.HTMLButtonElement);
  returned.click();
  await app.flush();
  assert.equal(count, 2);
});

test('当复制等待期间离开页面时应该不更新旧页面或抢夺新页面焦点', async (t) => {
  const rejections = [];
  const app = setup(t, () => new Promise((resolve, reject) => { rejections.push(reject); }));
  app.button.click();
  const oldStatus = app.document.querySelector('[role="status"]');
  const before = oldStatus.textContent;
  app.document.body.innerHTML = '<button id="new">新页面入口</button>';
  const newButton = app.document.getElementById('new');
  newButton.focus();
  assert.equal(rejections.length, 1);
  rejections[0](new Error('失败'));
  await app.flush();
  assert.equal(oldStatus.textContent, before);
  assert.equal(app.document.activeElement, newButton);
});

test('当导航已经开始但新页面尚未返回时应该忽略迟到的复制反馈且允许重试', async t => {
  for (const fails of [false, true]) {
    const finishers = [];
    const app = setup(t, () => new Promise((resolve, reject) => { finishers.push(() => fails ? reject(new Error('失败')) : resolve()); }));
    app.button.click();
    const status = app.document.querySelector('[role="status"]');
    app.document.dispatchEvent(new app.window.Event('pjax:send'));
    const before = status.textContent;
    const link = app.document.createElement('a');
    link.href = '/journal/';
    app.document.body.append(link);
    link.focus();
    assert.equal(finishers.length, 1);
    finishers[0]();
    await app.flush();
    assert.equal(status.textContent, before);
    assert.equal(app.document.activeElement, link);
    assert.equal(app.button.disabled, false);
  }
});
