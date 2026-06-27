# 博客优化实施计划（版本二：详细实施方案）

> 参考：B站 Yuimi Lab 博客（使用 Codex 制作的二次元个人博客）
> 生成时间：2026-06-26

---

## 背景

用户的 Hexo+Butterfly 二次元博客（arata66.top）目前处于早期阶段：
- 仅 1 篇文章，无自定义页面（about/link/tags/categories 均未创建）
- 导航栏菜单为空，访客没有任何导航入口
- 已有 5 个自定义增强（开场动画、光标特效、悬浮角色、音乐播放器、滚动揭示），视觉基底扎实
- 大量 Butterfly 内置功能处于关闭状态（搜索、pjax、preloader、Live2D、懒加载等）

参考 Yuimi Lab 的功能亮点，结合 Hexo+Butterfly 的能力范围，制定以下分阶段实施方案。

---

## 阶段一：基础完善（纯配置，无需写代码）

> 目标：让博客从"有皮肤没骨架"变成一个完整的站点

### 1.1 开启导航栏菜单

**文件**：`_config.butterfly.yml` → `menu` 段

```yaml
menu:
  首页: / || fa-solid fa-house
  分类: /categories/ || fa-solid fa-folder-open
  标签: /tags/ || fa-solid fa-tags
  归档: /archives/ || fa-solid fa-box-archive
  关于: /about/ || fa-solid fa-circle-user
```

**前置条件**：需要先创建对应的页面文件（见阶段二）

### 1.2 开启搜索

**文件**：`_config.butterfly.yml` → `search` 段

```yaml
search:
  use: local_search
  local_search:
    enable: true
    preload: true
    top_n_per_article: 5
```

### 1.3 开启 Preloader 加载动画

**文件**：`_config.butterfly.yml` → `preloader` 段

```yaml
preloader: true
```

### 1.4 开启 Pjax 无刷新加载

**文件**：`_config.butterfly.yml` → `pjax` 段

```yaml
pjax:
  enable: true
```

注意：开启 pjax 后需要验证现有的 5 个自定义脚本是否兼容。目前 `scroll-reveal.js` 已经处理了 `pjax:complete` 事件，`float-decor.js` 和 `magic-effects.js` 需要检查是否在 pjax 切换后重新绑定事件。如果出问题，在 `scroll-reveal.js` 中添加通用的 pjax 重初始化逻辑即可。

### 1.5 开启图片懒加载

**文件**：`_config.butterfly.yml` → `lazyload` 段

```yaml
lazyload:
  enable: true
```

### 1.6 开启右下角滚动百分比

**文件**：`_config.butterfly.yml` → `rightside_scroll_percent`

```yaml
rightside_scroll_percent: true
```

### 1.7 固定导航栏（吸顶）

**文件**：`_config.butterfly.yml` → `nav.fixed`

```yaml
nav:
  fixed: true
```

### 1.8 开启文章过期提醒

**文件**：`_config.butterfly.yml` → `noticeOutdate`

```yaml
noticeOutdate:
  enable: true
  style: flat
  limit_day: 90
  position: top
  container_bg_color: "#f4a9c0"
```

---

## 阶段二：创建自定义页面

> 目标：补齐 about/link/tags/categories 页面，让导航栏有东西可点

### 2.1 关于页面（/about/）

**创建文件**：`source/about/index.md`

```markdown
---
title: 关于我
type: about
---

（在此编写个人介绍内容）
```

内容建议参考 Yuimi Lab 的 ME 页面结构：
- 个人简介（一段话）
- 技术栈展示（用 Butterfly 的 tag 插件）
- 兴趣爱好（番剧、游戏等）
- 博客搭建记录

### 2.2 友情链接页（/link/）

**创建文件**：`source/link/index.md`

```markdown
---
title: 友情链接
type: link
---
```

Butterfly 自带友链样式，使用 `link-group` 和 `link-item` 的 tag 插件格式。

### 2.3 标签页和分类页

**创建文件**：`source/tags/index.md` 和 `source/categories/index.md`

```markdown
---
title: 标签
type: tags
---
```

```markdown
---
title: 分类
type: categories
---
```

这两个是 Butterfly 内置支持的，只需创建文件即可。

---

## 阶段三：视觉增强（JS/CSS 注入）

> 目标：借鉴 Yuimi Lab 的二次元交互感，提升视觉体验

### 3.1 自定义右键菜单

**新增文件**：`scripts/custom-menu.js`（Hexo injector）

功能：
- 右键弹出毛玻璃风格菜单（复用现有 `custom.css` 的 glassmorphism 风格）
- 菜单项：返回顶部 / 暗色切换 / 复制链接 / 分享到微博
- 菜单动画：fadeInUp 进入，点击外部消失
- 移动端不启用（右键在移动端没有意义）

CSS 样式追加到 `custom.css`。

### 3.2 公告弹窗系统

**新增文件**：`scripts/announcement.js`（Hexo injector）

功能：
- 首次访问时弹出全屏半透明遮罩 + 毛玻璃弹窗
- 弹窗内容：公告标题 + 正文 + "我知道了" 按钮
- 点击确认后存 `localStorage`，当天不再弹出（用日期作为 key）
- 支持在 `_config.butterfly.yml` 的 inject 中配置公告内容，或者硬编码在脚本中定期手动更新
- 动效：弹窗缩放进入 + 背景模糊

### 3.3 打字机多句轮播

**修改文件**：`_config.butterfly.yml` 的 `subtitle` 配置

方案 A（Butterfly 内置）：
```yaml
subtitle:
  enable: true
  effect: true
  sub:
    - "不要停下来啊"
    - "今天也要加油哦~"
    - "技术是严谨的，呈现是玩具的"
    - "arata66@lab:~$ npm run dream"
```

方案 B（如果 Butterfly 不支持数组格式的 sub）：在 inject 中注入一个自定义脚本，覆盖 Butterfly 的打字机逻辑，实现多句循环。

### 3.4 鼠标点击二次元特效

**修改文件**：`_config.butterfly.yml` 的特效段

```yaml
click_heart:
  enable: true
```

或者注入自定义脚本实现更二次元的效果（点击位置弹出星星/音符/猫爪等 emoji 图案并向上飘散消退）。

### 3.5 导航栏 Logo

**文件**：`_config.butterfly.yml` → `nav.logo`

可以做一个小型的 Azusa 头像或站点 logo 放在导航栏左侧，参考 Yuimi Lab 左上角的 Yuimi Lab 标识。

**需要**：准备一张小尺寸 logo 图片（建议 64x64 或更小），放到 `source/img/` 下。

### 3.6 侧栏头像特效

**文件**：`_config.butterfly.yml` → `avatar.effect`

```yaml
avatar:
  effect: true
```

Butterfly 内置头像 hover 旋转特效。

---

## 阶段四：进阶功能开发

> 目标：做出 Yuimi Lab 风格的差异化功能

### 4.1 天气/时钟组件

**新增文件**：`scripts/weather-clock.js`（Hexo injector）+ `source/css/weather-clock.css`

功能：
- 实时时钟显示（纯 JS，`setInterval` + `Date`）
- 天气信息：使用和风天气免费 API（需注册获取 key）
- 展示位置：侧栏卡片或首页顶部
- 样式：毛玻璃卡片，粉紫色主题
- 移动端：仅显示时钟，隐藏天气

### 4.2 作品展示页

**创建文件**：`source/works/index.md`（Markdown 内容）
**新增文件**：`scripts/works-page.js`（Hexo injector）+ `source/css/works-page.css`

功能：
- 分类标签过滤（参考 Yuimi Lab 的 ALL / Unity3D / Blender / Java / Hexo 等标签）
- 卡片式布局，每张卡片包含：项目名、简介、标签、状态（进行中/已完成）
- 点击展开详情（复用 Yuimi Lab 的"查看状态"交互）
- 卡片样式：毛玻璃 + hover 上浮 + 主题色渐变边框

### 4.3 终端风格首页（高级）

**新增文件**：`scripts/terminal-home.js`（Hexo injector）+ `source/css/terminal-home.css`

功能：
- 首页内容区域做成伪终端样式
- 预设命令：`help` / `about` / `blog` / `music` / `social`
- 用户在输入框敲命令，输出对应内容（文字或跳转链接）
- 绿色等宽字体 + 黑色背景 + 打字机输出效果
- 仅在首页显示，文章页正常

### 4.4 标签云美化

**修改文件**：`source/css/custom.css`（追加标签云样式）

参考 Yuimi Lab 的兴趣标签下落动画效果，可以做：
- 标签页用瀑布流/散落布局替代默认标签云
- 不同标签不同颜色（已有 colorful 配置）
- hover 时弹跳或发光

### 4.5 404 页面升级

**修改文件**：`_config.butterfly.yml` → `error_404`

```yaml
error_404:
  enable: true
  subtitle: "页面走丢了"
  background: /img/error-page.png
```

可以进一步注入一个简单的小游戏（如打字游戏或弹球），让用户在"迷路"时也能玩一下。

---

## 阶段五：内容建设

> 目标：博客最终还是要靠内容

### 5.1 补充文章

当前只有 1 篇文章。建议创建文章系列：

| 系列 | 文章 |
|------|------|
| Java 学习 | JavaSE 基础笔记、JavaWeb 入门、苍穹外卖项目记录 |
| 博客搭建 | Hexo+Butterfly 搭建记录、自定义音乐播放器开发、主题美化过程 |
| 生活随笔 | 学习心得、动漫/游戏推荐 |

### 5.2 补充侧栏公告

当前公告是 "怪奇物语真好看"，可以改成更有信息量的内容（如博客最近更新状态、个人近期目标等）。

---

## 实施优先级和依赖关系

```
阶段一（配置）──┐
                 ├──→ 阶段二（页面）──→ 阶段四（进阶）
阶段三（视觉）──┘         │
                          └──→ 阶段五（内容）
```

| 阶段 | 预估工作量 | 前置依赖 |
|------|-----------|---------|
| 阶段一 | 30 分钟 | 无 |
| 阶段二 | 1 小时 | 无（可与阶段一并行） |
| 阶段三 | 2-3 小时 | 阶段一的 pjax 需要先验证兼容性 |
| 阶段四 | 各功能 2-4 小时 | 阶段二（需要页面文件） |
| 阶段五 | 持续进行 | 无 |

---

## 关键文件清单

### 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `_config.butterfly.yml` | 开启导航栏、搜索、pjax、preloader、懒加载、滚动百分比、吸顶、过期提醒、头像特效 |
| `source/css/custom.css` | 追加右键菜单、天气组件、作品页、标签云等样式 |
| `scripts/scroll-reveal.js` | 可能需要增强 pjax 兼容性（统一重初始化入口） |

### 需要新建的文件

| 文件 | 用途 |
|------|------|
| `source/about/index.md` | 关于页面 |
| `source/link/index.md` | 友情链接页 |
| `source/tags/index.md` | 标签页 |
| `source/categories/index.md` | 分类页 |
| `scripts/custom-menu.js` | 自定义右键菜单 |
| `scripts/announcement.js` | 公告弹窗系统 |
| `scripts/weather-clock.js` | 天气时钟组件 |
| `source/css/weather-clock.css` | 天气时钟样式 |
| `scripts/works-page.js` | 作品展示页脚本 |
| `source/css/works-page.css` | 作品展示页样式 |

---

## 验证方式

1. **阶段一**：本地 `hexo s` 启动开发服务器，检查导航栏、搜索、pjax 切换是否正常，现有自定义脚本是否兼容
2. **阶段二**：检查各页面（/about/、/link/、/tags/、/categories/）是否正常渲染，导航栏链接是否可达
3. **阶段三**：右键菜单、弹窗、点击特效在桌面端和移动端分别测试
4. **阶段四**：天气 API 是否正常获取数据、作品页过滤功能、终端命令交互
5. **全部完成后**：运行 `bash deploy.sh "feat(blog): 博客功能升级"` 部署到线上验证

---

## 风险点

1. **Pjax 兼容性**：开启 pjax 后，所有 inject 脚本都需要在 `pjax:complete` 事件后重新初始化。`scroll-reveal.js` 已处理，其他脚本需要检查。如果兼容性问题太多，pjax 可以延后或关闭。
2. **天气 API Key**：和风天气免费 API 每天有调用次数限制（1000 次），需要评估是否足够。
3. **Live2D 未纳入**：由于 Live2D 模型资源较大且对性能有影响，本计划未包含。如果后续需要，可以作为独立任务添加。
4. **音乐播放器 30s 问题**：上次遗留的 VIP 歌曲试听问题仍未解决，暂不在本计划范围内。
