// Meting API Cookie 健康检查脚本
// 在服务器上运行：node /opt/meting-api/health-check.js
// 检测方式：取第一首歌的 URL，访问看是否 302 到网易云域名（正常）或返回错误/试听链接

const https = require('https');
const http = require('http');

const API = 'https://arata66.top/meting/?type=playlist&id=2690018998';
const LOCAL_API = 'http://127.0.0.1:3000/?type=playlist&id=2690018998';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000 }, res => {
      let body = '';
      if (res.statusCode === 302 || res.statusCode === 301) {
        return resolve({ status: res.statusCode, location: res.headers.location || '', body: '' });
      }
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function check() {
  try {
    // 1. 获取歌单
    const listRes = await fetch(LOCAL_API);
    const songs = JSON.parse(listRes.body);
    if (!Array.isArray(songs) || songs.length === 0) {
      console.error('[FAIL] 歌单为空或解析失败');
      process.exit(1);
    }

    // 2. 检查第一首歌的 URL
    const testUrl = songs[0].url;
    if (!testUrl) {
      console.error('[FAIL] 第一首歌无 URL');
      process.exit(1);
    }

    const urlRes = await fetch(testUrl);
    const location = urlRes.location || '';

    // 3. 判断：正常 MP3 会 302 到 *.music.126.net
    if (location.includes('music.126.net') || location.includes('music.163.com')) {
      console.log('[OK] Cookie 有效，首歌:', songs[0].name);
      process.exit(0);
    } else if (urlRes.status === 403 || urlRes.status === 401) {
      console.error('[EXPIRED] Cookie 已过期，需要更新！HTTP', urlRes.status);
      process.exit(2);
    } else {
      console.error('[WARN] 未知状态，可能需要检查。Status:', urlRes.status, 'Location:', location.substring(0, 80));
      process.exit(1);
    }
  } catch (e) {
    console.error('[ERROR]', e.message);
    process.exit(1);
  }
}

check();
