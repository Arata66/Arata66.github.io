const assert = require('node:assert/strict');
const test = require('node:test');
const { deferIconStyles } = require('../scripts/cache-bust');

const iconLink = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.1.0/css/all.min.css">';

test('当图标样式来自外部服务时应该避免阻塞正文并保留无脚本回退', () => {
  const html = deferIconStyles(iconLink);
  assert.match(html, /media="print" onload="this.media='all'"/);
  assert.ok(html.includes('<noscript>' + iconLink + '</noscript>'));
});

test('当构建重复处理页面时应该不嵌套或重复图标回退', () => {
  const html = deferIconStyles(iconLink);
  assert.equal(deferIconStyles(html), html);
});

test('当页面加载本站必要样式时应该保持阻塞样式顺序', () => {
  const html = '<link rel="stylesheet" href="/css/index.css"><link rel="stylesheet" href="/css/custom-bundle.css">';
  assert.equal(deferIconStyles(html), html);
});
