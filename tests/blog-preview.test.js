const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { startPreview } = require('../scripts/blog-preview');

function request(port, route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('当预览生成页面与资源时应该正确提供内容并禁止缓存和索引', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-preview-'));
  fs.mkdirSync(path.join(root, 'works'));
  fs.writeFileSync(path.join(root, 'index.html'), '首页');
  fs.writeFileSync(path.join(root, 'works/index.html'), '作品页');
  fs.writeFileSync(path.join(root, 'style.css'), 'body{}');
  const server = await startPreview(root, 0);
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  assert.equal(address.address, '127.0.0.1');
  const page = await request(address.port, '/works/');
  assert.equal(page.status, 200);
  assert.equal(page.body, '作品页');
  assert.match(page.headers['content-type'], /text\/html/);
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.match(page.headers['x-robots-tag'], /noindex/);
  assert.equal((await request(address.port, '/style.css?v=test')).headers['content-type'], 'text/css; charset=utf-8');
  assert.equal((await request(address.port, '/', 'HEAD')).body, '');
  assert.equal((await request(address.port, '/missing/')).status, 404);
  assert.equal((await request(address.port, '/', 'POST')).status, 405);
  for (const route of ['/%2e%2e/private.txt', '/..%5cprivate.txt', '/%ZZ', '/C:/private.txt']) assert.equal((await request(address.port, route)).status, 400);
});
