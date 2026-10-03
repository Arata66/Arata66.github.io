# Arata66 の Blog

基于 Hexo 7.3.0 和 Butterfly 5.5.2 的个人博客，使用柔紫粉色与 Azusa 二次元主题。内容包括学习记录、项目介绍、音乐和生活随笔。

本仓库保存博客源码。原工作区中的 `Arata66.github.io/` 是历史静态产物，日常开发在 `HexoBlog/` 或其维护工作树中进行；独立克隆本仓库时，直接在克隆根目录运行命令。

## 开始使用

使用 Node.js 22；`.node-version` 记录该版本，`package-lock.json` 固定依赖。安装后先检查并构建：

```bash
npm ci
npm run check
npm run build
npm run server
```

启动后访问 `http://localhost:4000`。只有 `server` 不会生成自定义合并包，首次启动以及修改自定义 CSS/JS 后都需要重新构建。修改 `_config.butterfly.yml` 后需要重启服务。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm ci` | 按锁文件恢复依赖 |
| `npm run lint` | 检查自定义脚本、构建脚本和测试 |
| `npm run typecheck` | 对 JavaScript 做类型检查，不输出新代码 |
| `npm test` | 执行 DOM 行为测试、资源合并测试与移动端规则检查 |
| `npm run check` | 顺序执行 lint、类型检查和测试 |
| `npm run build` | 生成页面、合并资源并添加缓存版本号 |
| `npm run clean` | 清理 Hexo 构建产物和缓存 |
| `npm run server` | 启动本地预览 |

## 目录

| 路径 | 内容 |
| --- | --- |
| `source/_posts/` | 文章及封面、摘要、分类、标签等元数据 |
| `source/about/`、`source/works/`、`source/link/` | 关于、作品、友链页面 |
| `source/_data/` | 作品与友链数据 |
| `source/css/`、`source/js/` | 自定义样式和浏览器脚本 |
| `scripts/` | Hexo 扩展及构建后处理 |
| `tests/` | 自动检查与行为测试 |
| `types/` | Hexo、作品与统计等全局声明 |
| `docs/` | 历史方案、维护计划及文章选题 |
| `public/` | 构建结果，不提交到 Git |

## 修改与验证

新增 CSS/JS 后，必须在 `scripts/merge-assets.js` 的对应数组登记。已登记资源缺失会让构建失败，并在错误信息中指出路径，避免发布不完整页面。

自定义浏览器脚本需要兼容 `pjax:complete`，避免重复创建组件和绑定事件。不得修改 `node_modules/` 中的主题源码。桌面特效使用 `pointer: fine` 判断设备，手机适配需兼顾安全区和触摸区域。

类型检查覆盖 `scripts/`、`source/js/`、`tests/` 和 ESLint 配置；现阶段采用非严格 JavaScript 检查。Hexo injector 模板字符串里的浏览器代码不会被当作独立 JavaScript 检查，第三方主题和依赖也不属于本项目的检查范围。

DOM 测试覆盖手机工具展开、收起、桌面恢复与 Pjax 切换；文件测试覆盖资源合并成功及资源缺失时保留已有输出。`tests/test-mobile-article-layout.js` 是 CSS/JS 规则检查，不能替代视觉回归。发布前仍需在 360、390、430、768px 视口、横屏及真实手机上复查页面。

GitHub Actions 在推送和 PR 时运行 `npm ci`、`npm run check`、`npm run build`，仅执行检查与构建。

## Git 与服务器发布

日常修改使用 `<用户名>/<功能描述>` 分支，提交说明使用中文约定式格式，例如 `fix(blog): 修复移动端工具状态`。检查完成后推送分支并建立 PR。

Azure 服务器发布与 GitHub 源码同步是两件事。现有发布入口为 `bash deploy.sh`，具体服务器环境记录在 `CLAUDE.md`。脚本带提交信息时还会执行全部文件暂存、提交和推送；其远端清理与权限配置仍是历史流程，运行前应检查脚本和待提交文件。不要使用 `hexo deploy`。

## 项目文档

- [协作规则](AGENTS.md)
- [历史部署与写作约定](CLAUDE.md)
- [移动端文章页优化记录](docs/mobile-article-layout-plan.md)
- [工程维护方案](docs/2026-10-03-工程维护方案.md)
- [工程维护实施计划](docs/2026-10-03-工程维护实施计划.md)
- [文章选题草稿](docs/文章选题.md)

`docs/optimization-plan-v2.md` 是 2026-06-26 的历史方案，其中早期功能状态和公告弹窗提议已被后续实现或决策替代。
