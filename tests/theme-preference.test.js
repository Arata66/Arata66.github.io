const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const { enhanceThemePreference } = require('../scripts/merge-assets');

const original = '<head><script>(() => { const saveToLocal = { get: key => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw).value : undefined; } }; document.documentElement.dataset.theme = saveToLocal.get("theme") || "light"; })();</script></head>';

test('当曾经用旧菜单保存裸主题时应该在主题读取前迁移并正确显示', () => {
  for (const mode of ['dark', 'light']) {
    const dom = new JSDOM(enhanceThemePreference(original), { url: 'https://example.test/', runScripts: 'dangerously', beforeParse(window) { window.localStorage.setItem('theme', mode); } });
    try {
      assert.equal(dom.window.document.documentElement.dataset.theme, mode);
      const saved = JSON.parse(dom.window.localStorage.getItem('theme'));
      assert.equal(saved.value, mode); assert.ok(saved.expiry > Date.now());
    } finally { dom.window.close(); }
  }
});

test('当主题已经使用正确JSON保存时应该保持值和过期时间', () => {
  const saved = JSON.stringify({ value: 'dark', expiry: 123456789 });
  const dom = new JSDOM(enhanceThemePreference(original), { url: 'https://example.test/', runScripts: 'dangerously', beforeParse(window) { window.localStorage.setItem('theme', saved); } });
  try { assert.equal(dom.window.localStorage.getItem('theme'), saved); } finally { dom.window.close(); }
});

test('当迁移脚本遇到存储拒绝时应该不产生额外异常', () => {
  const html = enhanceThemePreference(original);
  const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only' });
  try {
    Object.defineProperty(dom.window, 'localStorage', { get() { throw new Error('存储拒绝'); } });
    const script = dom.window.document.querySelector('script[data-theme-preference]');
    assert.ok(script); assert.doesNotThrow(() => dom.window.eval(script.textContent));
  } finally { dom.window.close(); }
});

test('当重复构建同一页面时应该只迁移一次并先于原主题读取', () => {
  const html = enhanceThemePreference(original); const twice = enhanceThemePreference(html);
  assert.equal(twice, html);
  const dom = new JSDOM(twice);
  try { assert.equal(dom.window.document.querySelectorAll('script[data-theme-preference]').length, 1); assert.ok(html.indexOf('data-theme-preference') < html.indexOf('const saveToLocal')); } finally { dom.window.close(); }
});

test('当主题初始化结构变化时应该明确报错避免静默遗漏迁移', () => {
  assert.throws(() => enhanceThemePreference('<head><script>other()</script></head>'), /主题初始化/);
});
