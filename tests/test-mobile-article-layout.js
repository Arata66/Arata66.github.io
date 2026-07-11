const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'source/css/custom.css'), 'utf8');
const visitor = fs.readFileSync(path.join(root, 'source/js/visitor-egg.js'), 'utf8');

// 这些断言锁定真实手机截图暴露的三个用户行为，而不是固定某个主题实现细节。
assert.match(css, /#body-wrap\.post\s+#card-toc[\s\S]*?right:\s*68px\s*!important/);
assert.match(css, /#body-wrap\.post\s+#card-toc\.open[\s\S]*?transform:\s*scale\(1\)\s*!important/);
assert.match(css, /#rightside\.rightside-show[\s\S]*?transform:\s*none\s*!important/);
assert.match(visitor, /#body-wrap\.post/);
assert.match(visitor, /if\s*\(document\.querySelector\('#body-wrap\.post'\)\)\s*return/);

console.log('移动端文章页布局回归检查通过');
