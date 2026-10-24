const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function readyRevision(root) {
  if (git(root, ['branch', '--show-current']) !== 'main') throw new Error('发布准备只允许在main分支进行，请先完成合并');
  if (git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('工作区还有未提交修改，请先核对并提交或合并');
  return git(root, ['rev-parse', 'HEAD']);
}

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function validateStateDirectory(root, stateDir) {
  const directory = path.resolve(stateDir);
  for (let current = directory; ; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('工具缓存及祖先目录不能是链接或普通文件');
    if (path.dirname(current) === current) break;
  }
  for (const entry of ['public', 'source', 'node_modules']) {
    const relative = path.relative(path.join(root, entry), directory);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('工具缓存不能放进源码、正式产物目录或依赖目录');
  }
  return directory;
}

function prepareRelease(root, stateDir, run) {
  const revision = readyRevision(root);
  stateDir = validateStateDirectory(root, stateDir);
  const source = path.resolve(root, 'public');
  const stat = fs.lstatSync(source, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink()) throw new Error('正式产物目录不能是链接');
  for (const task of ['check', 'clean', 'build']) run(task);
  if (readyRevision(root) !== revision) throw new Error('检查期间提交已改变，请重新准备');
  if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error('完整构建没有生成首页');
  const parent = path.join(stateDir, 'releases');
  fs.mkdirSync(parent, { recursive: true });
  const output = fs.mkdtempSync(path.join(parent, revision.slice(0, 7) + '-'));
  const rows = [];
  function copy(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { copy(file); continue; }
      if (!entry.isFile()) throw new Error('发布产物不能包含链接或特殊文件');
      const relative = path.relative(source, file).split(path.sep).join('/');
      if (/[\r\n\\]/.test(relative) || relative.split('/').some(part => part.startsWith('.'))) throw new Error('发布产物含不支持的路径');
      const bytes = fs.readFileSync(file);
      const destination = path.join(output, 'payload', relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes, { flag: 'wx' });
      rows.push(digest(bytes) + '  ' + relative);
    }
  }
  copy(source);
  fs.writeFileSync(path.join(output, 'manifest.txt'), rows.sort().join('\n') + '\n');
  fs.writeFileSync(path.join(output, 'version.json'), JSON.stringify({ revision, files: rows.length }, null, 2) + '\n');
  execFileSync('tar', ['-czf', path.join(output, 'site.tar.gz'), '-C', output, 'payload', 'manifest.txt', 'version.json'], { stdio: 'pipe' });
  if (readyRevision(root) !== revision) throw new Error('打包期间提交已改变，请丢弃本次包并重新准备');
  const archive = fs.readFileSync(path.join(output, 'site.tar.gz'));
  fs.writeFileSync(path.join(output, '发布摘要.json'), JSON.stringify({ revision, files: rows.length, archiveBytes: archive.length, archiveSha256: digest(archive) }, null, 2) + '\n');
  fs.writeFileSync(path.join(output, '发布说明.md'), `# 发布准备记录\n\n版本：${revision}\n\n本地检查、完整构建和打包已完成，共${rows.length}项文件。site.tar.gz为完整包，manifest.txt为SHA256清单。\n\n本命令没有提交代码、上传文件或改变服务器。实际发布继续执行现有的现网核对、独立备份、先资源后页面、逐文件替换及线上校验流程，不能清空站点，也不能把预览目录作为发布来源。\n`);
  return output;
}

module.exports = { readyRevision, prepareRelease, validateStateDirectory };
