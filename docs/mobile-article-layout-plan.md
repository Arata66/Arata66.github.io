# 移动端文章页布局优化实施计划

> **执行说明：** 本计划针对真实手机截图暴露的文章页浮层重叠问题，按“根因修复 → 构建 → 多视口验证”执行。

**目标：** 在不修改 Butterfly 主题源码、不引入新依赖的前提下，让 360/390/430px 手机文章页的导航、目录、右侧工具和访客提示互不遮挡正文。

**方案：** 保留 Butterfly 原有移动目录入口，但将目录限制为可滚动的底部抽屉；文章页关闭会覆盖阅读区域的访客 Toast；移动端收紧右侧工具组和安全区间距；通过自定义 CSS/JS 注入实现，避免修改 `node_modules`。

**技术栈：** Hexo 7.3.0、Butterfly 5.5.2、原生 CSS、原生 JavaScript、构建产物 `public/`。

---

## 任务一：建立可验证的失败基线

**目标：** 在修改前记录 390px 文章页的重叠相关状态，确保验证针对用户截图中的真实症状。

- [ ] 使用本地 `public/` 静态预览加载文章页 `/2026/06/29/Coming/`。
- [ ] 设置视口为 `390x844`，读取 `#card-toc`、`#mobile-toc-button`、`#rightside`、`.visitor-toast`、`#article-container` 的位置和层级。
- [ ] 记录当前预期失败：`#card-toc` 为固定定位且可能覆盖正文；右侧工具组不能完全收进视口；访客提示不应在文章阅读区域出现。

## 任务二：修复移动端文章页浮层层级

**文件：**

- 修改：`source/css/custom.css`
- 修改：`source/css/visitor-egg.css`
- 修改：`source/js/visitor-egg.js`

- [ ] 在 `custom.css` 的移动端规则中，为文章页 `#card-toc` 增加安全的底部抽屉边界：使用 `left: 12px`、`right: 12px`、`bottom: calc(58px + env(safe-area-inset-bottom))`、`width: auto`、`max-height: min(52dvh, 420px)` 和 `overflow: hidden`，避免目录越出屏幕。
- [ ] 为 `#card-toc.open` 增加内部 `.toc-content` 的滚动边界，使用 `max-height: min(38dvh, 300px)`、`overflow-y: auto` 和 `overscroll-behavior: contain`，让目录项滚动而不是推动/覆盖正文。
- [ ] 在移动端把 `#rightside` 的水平位置固定在视口内，使用 `right: 8px`、`bottom: calc(12px + env(safe-area-inset-bottom))`，并确保按钮不产生横向滚动。
- [ ] 为文章页目录打开状态增加 `body`/`#body-wrap.post` 的目录可视区域约束，保证目录与底部工具区至少保留 12px 间距。
- [ ] 在 `visitor-egg.js` 中让 `init()` 检查 `#body-wrap.post`；文章页直接跳过访客 Toast，首页继续保持不显示，其他非文章页面继续保留现有彩蛋。
- [ ] 在 `visitor-egg.css` 中只保留非文章页 Toast 的通用样式，并将移动端 Toast 的底部间距设为安全区友好值，避免未来重新启用时挡住工具按钮。

## 任务三：构建和响应式回归验证

**验证入口：** `npm run build`、本地静态服务器、浏览器手机视口。

- [ ] 运行 `npm run build`，确认 Hexo 页面和合并资源生成成功。
- [ ] 在 360x800、390x844、430x932 三个视口分别打开文章页，确认 `document.documentElement.scrollWidth <= window.innerWidth`。
- [ ] 确认文章页初始状态没有 `.visitor-toast`，正文、文章头部和固定导航无覆盖。
- [ ] 点击移动目录按钮，确认 `#card-toc.open` 在视口内、目录内容可滚动，点击目录项后目录自动关闭且页面滚到目标标题。
- [ ] 滚动文章页，确认右侧工具按钮保持在视口内，不遮挡正文主要阅读区域，不制造横向溢出。
- [ ] 打开首页和作品页做回归检查，确认访客彩蛋、首页首屏和作品筛选未被文章页专用规则破坏。

## 任务四：差异复核和提交

- [ ] 运行 `git diff --check`。
- [ ] 检查 `git diff`，确认只包含移动端文章页防重叠相关改动和本计划文件。
- [ ] 使用约定式提交信息：`fix(blog): 修复移动端文章页浮层重叠`。

## 完成标准

- 360/390/430px 文章页无横向溢出。
- 文章正文不被目录、访客提示、右侧工具或固定导航意外覆盖。
- 目录仍可打开、滚动和跳转，跳转后自动关闭。
- 首页和作品页现有行为保持不变。
- `npm run build` 退出码为 0。
