# Arata66 博客项目协作说明

## 项目定位

- 当前主项目是 Hexo 7.3.0 + Butterfly 5.5.2，源码目录为 `E:/github/Blog/HexoBlog`。
- `Arata66.github.io` 是历史静态产物，新的页面和样式只改 `HexoBlog`。
- 自定义样式和脚本放在 `source/css/`、`source/js/`，不修改 `node_modules/` 或主题源码。

## 必须遵守

- 修改后先运行 `npm run build`，确认 `custom-bundle.css/js` 已重新生成。
- 修改 `_config.butterfly.yml` 后必须重启 Hexo server，配置不会热更新。
- 新增 CSS/JS 必须登记到 `scripts/merge-assets.js`，否则线上合并包不会包含它。
- 复杂浏览器代码放静态 JS 文件，不写入 Hexo injector 模板字符串。
- 桌面特效用 `@media (pointer: fine)` 或 `matchMedia('(pointer: fine)')` 判断，不使用 `ontouchstart` 误判设备。
- 部署前关闭代理梯子；部署使用 `bash deploy.sh`，不要用 `hexo deploy` 覆盖源码。
- 所有沟通、文档和新增代码注释使用中文；提交信息使用约定式提交格式。

## 现有设计与功能

- 主色为柔紫/粉色系：`--primary: #b48ead`、`--accent: #f4a9c0`，背景为深紫夜空和毛玻璃卡片。
- 已有导航、搜索、Pjax、懒加载、作品页、终端首页、音乐球、天气时钟、花瓣粒子、置顶文章、页脚统计和 404 增强。
- 自定义脚本大多需要兼容 `pjax:complete`，初始化必须防重复、定时器必须可控。
- 手账胶带保持 `top: -6px` 的半遮半掩效果，不要移入卡片内部。

## 明确偏好和边界

- 用户偏好二次元 Azusa 主题、视觉有创意但操作尽量简单。
- 不添加公告弹窗、强制弹窗或类似打扰式功能。
- 友链目前以独立页面为准，不要擅自恢复已经回退的左侧友链侧栏提交。
- 图片引用前确认真实扩展名；文章封面不能重复。

## 手机端优化基线

- 需要重点验证 360、390、430、768px 视口，以及横屏和安全区。
- 当前移动规则主要集中在 768px/480px 两档；优先检查导航、首屏、文章卡片、代码块、侧栏、搜索、作品页和横向溢出。
- 移动端要关注固定背景、`100vh`、大图体积、非必要动画和触摸反馈，不能只做视觉缩放。
- 本地最终效果必须先 `npm run build`，再用静态服务器或浏览器查看生成的 `public/`。

## 参考入口

- 详细项目记忆快照：`.me`
- 旧版经验和部署细节：`CLAUDE.md`
- 历史优化方案：`docs/optimization-plan-v2.md`
