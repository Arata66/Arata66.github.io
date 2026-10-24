const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const readline = require('node:readline/promises');
const { createDraft, preparePost, createPreviewWorkspace, removePreview } = require('./blog-writing');
const { startPreview } = require('./blog-preview');
const { prepareRelease, validateStateDirectory } = require('./blog-release');

const root = path.resolve(__dirname, '..');

function stateDirectory() {
  const configFile = path.join(root, '.blog-local.json');
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, '')) : {};
  if (config.stateDir !== undefined && (typeof config.stateDir !== 'string' || !path.isAbsolute(config.stateDir))) throw new Error('本地stateDir配置必须为绝对路径');
  return validateStateDirectory(root, config.stateDir || path.join(root, '.private/writing'));
}

function runNpm(directory, task) {
  const npm = process.env.npm_execpath;
  if (!npm || !fs.existsSync(npm)) throw new Error('请通过npm run blog启动工具');
  execFileSync(process.execPath, [npm, 'run', task], { cwd: directory, stdio: 'inherit' });
}

async function preview(slug, port) {
  const directory = createPreviewWorkspace(root, stateDirectory(), slug);
  let removed = false;
  function cleanup() { if (!removed) { removePreview(directory); removed = true; } }
  process.once('exit', cleanup);
  try {
    console.log(slug ? `正在构建草稿 ${slug} 的独立预览，其他草稿不会加入。` : '正在构建已发表内容的独立预览。');
    runNpm(directory, 'build');
    const server = await startPreview(path.join(directory, 'public'), port);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('无法获取预览地址');
    console.log(`\n完整预览：http://127.0.0.1:${address.port}/\n修改稿件后重新预览即可更新。按Ctrl+C停止并清理本次预览。`);
    await new Promise(resolve => {
      function stop() { server.closeAllConnections(); server.close(); }
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      server.once('close', () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); resolve(undefined); });
    });
  } finally { process.removeListener('exit', cleanup); cleanup(); }
}

async function menu() {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\n博客本地工具\n1. 新建草稿\n2. 完整预览已发表内容\n3. 完整预览一篇草稿\n4. 将已确认的完成稿整理为待提交文章\n5. 发布前检查与打包\n0. 退出\n');
    const choice = (await input.question('选择编号：')).trim();
    if (choice === '0') return ['help'];
    if (choice === '1') return ['new', (await input.question('英文短名（例如my-note）：')).trim(), await input.question('文章标题：')];
    if (choice === '2') return ['preview'];
    if (choice === '3' || choice === '4') {
      const drafts = path.join(root, 'source/_drafts');
      const files = fs.existsSync(drafts) ? fs.readdirSync(drafts).filter(file => file.endsWith('.md')).map(file => file.slice(0, -3)) : [];
      if (!files.length) throw new Error('还没有草稿，请先新建草稿');
      console.log('已有草稿：' + files.join('、'));
      return [choice === '3' ? 'preview' : 'ready', (await input.question('输入要操作的草稿短名：')).trim()];
    }
    if (choice === '5') return ['release'];
    throw new Error('请输入菜单中的编号');
  } finally { input.close(); }
}

async function main() {
  const parsed = parseArgs({ allowPositionals: true, options: { port: { type: 'string' } } });
  const args = parsed.positionals.length ? parsed.positionals : await menu();
  const [command, slug, ...title] = args;
  if (command === 'new') {
    console.log('已创建本地草稿：' + createDraft(root, slug, title.join(' ')));
  } else if (command === 'ready') {
    console.log('已整理为待提交文章：' + preparePost(root, slug));
    console.log('原草稿保留。请核对差异后按现有流程提交；没有自动上传或发表。');
  } else if (command === 'preview') {
    const port = Number(parsed.values.port ?? 4000);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('端口须为0到65535之间的整数');
    await preview(slug || '', port);
  } else if (command === 'release') {
    console.log('已生成完整发布准备包：' + prepareRelease(root, stateDirectory(), task => runNpm(root, task)));
  } else if (command === 'help') {
    console.log('命令：npm run blog -- new <短名> "标题" | preview [短名] [--port 4000] | ready <短名> | release');
  } else throw new Error('未知命令，请运行npm run blog -- help');
}

if (require.main === module) main().catch(error => { console.error('操作未完成：' + error.message); process.exitCode = 1; });
