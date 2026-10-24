const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const previews = new Map();

function slugPath(root, section, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug)) throw new Error('短名须为小写英文、数字或短横线，不能包含路径或系统保留名');
  let directory = fs.realpathSync(root);
  for (const segment of ['source', section]) {
    directory = path.join(directory, segment);
    const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error('写作目录不能是链接或普通文件：' + directory);
  }
  return path.join(directory, slug);
}

function shanghaiDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function serialize(data, body) {
  return `---\n${yaml.dump(data, { lineWidth: -1, noRefs: true })}---\n${body}`;
}

function createDraft(root, slug, title) {
  const base = slugPath(root, '_drafts', slug);
  const post = slugPath(root, '_posts', slug);
  if (typeof title !== 'string' || !title.trim()) throw new Error('请填写文章标题');
  if ([base, base + '.md', post, post + '.md'].some(file => fs.existsSync(file))) throw new Error('同名草稿、附件或文章已存在，请换一个短名');
  fs.mkdirSync(path.dirname(base), { recursive: true });
  fs.mkdirSync(base);
  try {
    fs.writeFileSync(base + '.md', serialize({ title: title.trim(), date: shanghaiDate(), updated: shanghaiDate(), tags: [], categories: [], cover: '', description: '', excerpt: '', published: false }, '\n<!-- 在这里写自己的正文。摘要、封面和日期可在上方填写；附件放在同名目录。 -->\n'), { flag: 'wx' });
  } catch (error) { fs.rmdirSync(base); throw error; }
  return base + '.md';
}

function readDraft(root, slug) {
  const base = slugPath(root, '_drafts', slug);
  const stat = fs.lstatSync(base + '.md');
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('草稿必须是普通文件，不能是链接');
  const raw = fs.readFileSync(base + '.md', 'utf8').replace(/^\uFEFF/, '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('草稿必须包含有效的YAML头信息');
  // 无时区日期保持作者填写的北京时间，避免YAML先转UTC再偏移。
  const rawData = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData) || !('title' in rawData) || typeof rawData.title !== 'string' || !rawData.title.trim()) throw new Error('草稿缺少文章标题');
  const rawDate = 'date' in rawData ? rawData.date : null;
  const date = rawDate instanceof Date ? shanghaiDate(rawDate) : rawDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date) || !Number.isFinite(Date.parse(date.replace(' ', 'T') + '+08:00')) || shanghaiDate(new Date(date.replace(' ', 'T') + '+08:00')) !== date) throw new Error('草稿日期须使用有效的 YYYY-MM-DD HH:mm:ss 格式');
  const data = { ...rawData, title: rawData.title, date,
    description: 'description' in rawData && typeof rawData.description === 'string' ? rawData.description : '',
    cover: 'cover' in rawData && typeof rawData.cover === 'string' ? rawData.cover : '',
    excerpt: 'excerpt' in rawData && typeof rawData.excerpt === 'string' ? rawData.excerpt : '' };
  return { base, data, body: match[2] };
}

function copyPlain(source, target, excluded = '') {
  fs.cpSync(source, target, { recursive: true, filter(file) {
    if (file === excluded) return false;
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('写作源码和附件不能含符号链接：' + file);
    return true;
  } });
}

function preparePost(root, slug) {
  const draft = readDraft(root, slug);
  const target = slugPath(root, '_posts', slug);
  if (fs.existsSync(target) || fs.existsSync(target + '.md')) throw new Error('同名文章或附件已存在，不能覆盖');
  if (typeof draft.data.description !== 'string' || !draft.data.description.trim()) throw new Error('请先填写摘要 description');
  const cover = draft.data.cover;
  if (typeof cover !== 'string' || !/^\/img\/[a-zA-Z0-9/_.-]+$/.test(cover) || cover.includes('..') || !fs.existsSync(path.join(root, 'source', cover))) throw new Error('请填写存在于source/img中的站内封面');
  if (!draft.body.replace(/<!--[\s\S]*?-->/g, '').trim()) throw new Error('请先填写文章正文');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const hasAssets = fs.existsSync(draft.base);
  if (hasAssets) {
    fs.mkdirSync(target);
    try { copyPlain(draft.base, target); }
    catch (error) { fs.rmSync(target, { recursive: true, force: true }); throw error; }
  }
  try {
    fs.writeFileSync(target + '.md', serialize({ ...draft.data, excerpt: draft.data.excerpt || draft.data.description, published: true }, draft.body), { flag: 'wx' });
  } catch (error) {
    if (hasAssets) fs.rmSync(target, { recursive: true, force: true });
    throw error;
  }
  return target + '.md';
}

function createPreviewWorkspace(root, stateDir, slug = '') {
  const parent = path.join(stateDir, 'previews');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'preview-'));
  previews.set(directory, fs.realpathSync(parent));
  try {
    for (const file of ['package.json', '_config.yml', '_config.butterfly.yml']) fs.copyFileSync(path.join(root, file), path.join(directory, file));
    const themeFile = path.join(directory, '_config.butterfly.yml');
    const theme = Object(yaml.load(fs.readFileSync(themeFile, 'utf8')));
    theme.comments = { ...Object(theme.comments), use: '' };
    fs.writeFileSync(themeFile, yaml.dump(theme, { lineWidth: -1 }));
    for (const dir of ['scripts', 'scaffolds', 'source']) copyPlain(path.join(root, dir), path.join(directory, dir), path.join(root, 'source/_drafts'));
    if (slug) {
      const draft = readDraft(root, slug);
      const target = slugPath(directory, '_posts', slug);
      if (fs.existsSync(target) || fs.existsSync(target + '.md')) throw new Error('同名文章已存在，无法插入草稿预览');
      const description = draft.data.description || '本地草稿预览';
      fs.writeFileSync(target + '.md', serialize({ ...draft.data, published: true, comments: false, description, excerpt: draft.data.excerpt || description, cover: draft.data.cover || '/img/placeholder.svg' }, draft.body), { flag: 'wx' });
      if (fs.existsSync(draft.base)) copyPlain(draft.base, target);
    }
    // 复用已安装依赖，副本不安装包，也不触碰正式构建数据库。
    fs.symlinkSync(path.resolve(root, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    return directory;
  } catch (error) { removePreview(directory); throw error; }
}

function removePreview(directory) {
  if (!previews.has(directory) || !path.basename(directory).startsWith('preview-') || path.dirname(fs.realpathSync(directory)) !== previews.get(directory)) throw new Error('只能清理本次创建的预览目录');
  const dependencies = path.join(directory, 'node_modules');
  if (fs.existsSync(dependencies) && fs.lstatSync(dependencies).isSymbolicLink()) fs.unlinkSync(dependencies);
  fs.rmSync(directory, { recursive: true, force: true });
  previews.delete(directory);
}

module.exports = { createDraft, preparePost, createPreviewWorkspace, removePreview };
