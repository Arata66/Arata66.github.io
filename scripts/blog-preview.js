const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };

async function startPreview(publicDir, port = 4000) {
  const root = fs.realpathSync(publicDir);
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    function reject(status) { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(status === 404 ? '页面不存在' : '请求不受支持'); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); reject(405); return; }
    if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(req.headers.host || '')) { reject(400); return; }
    let route;
    try { route = decodeURIComponent((req.url || '/').split('?')[0]); } catch { reject(400); return; }
    if (!route.startsWith('/') || /[\\:]/.test(route) || Array.from(route).some(char => char.charCodeAt(0) < 32) || route.split('/').some(part => part === '..' || part === '.')) { reject(400); return; }
    let target = path.resolve(root, '.' + route);
    try {
      if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      const actual = fs.realpathSync(target);
      const relative = path.relative(root, actual);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(actual).isFile()) { reject(404); return; }
      const stat = fs.statSync(actual);
      res.writeHead(200, { 'Content-Type': contentTypes[path.extname(actual).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(actual).on('error', () => res.destroy()).pipe(res);
    } catch { reject(404); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(undefined)); });
  return server;
}

module.exports = { startPreview };
