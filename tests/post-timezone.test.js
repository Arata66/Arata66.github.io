const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('当构建机器时区不同于博客时区时应该保留凌晨文章日期', () => {
  const script = path.join(__dirname, '../scripts/post-timezone.js');
  const code = `global.hexo = { config: { timezone: 'Asia/Shanghai' } }; require(${JSON.stringify(script)}); const date = new Date('2026-10-03T16:01:00Z'); console.log(JSON.stringify({ day: date.getDate(), hour: date.getHours(), iso: date.toISOString() }));`;
  for (const timezone of ['UTC', 'America/Los_Angeles']) {
    const result = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: timezone }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { day: 4, hour: 0, iso: '2026-10-03T16:01:00.000Z' });
  }
});
