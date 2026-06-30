# Arata66 の Blog

Hexo 7.3.0 + Butterfly 5.5.2 二次元主题博客，部署在 Azure VM（arata66.top）。

## 部署流程

```bash
bash deploy.sh "feat(scope): 提交信息"   # 构建 + 部署 Azure VM + git push
bash deploy.sh                           # 仅构建 + 部署，不提交 git
```

- **部署前必须关梯子**（机场不支持 SSH 端口转发，否则 `kex_exchange_identification` 报错）
- deploy.sh 流程：`hexo clean` → `hexo g` → `merge-assets.js`（合并自定义 CSS/JS）→ `cache-bust.js`（资源加版本号）→ SCP 上传到 `/var/www/blog/`
- Git push 已内置代理 `127.0.0.1:28839`，无需手动设置
- `deploy.sh` 推送时会自动 `git add -A`，所以不需要额外手动提交

## 本地预览

```bash
npm run build        # 必须先 build，否则 custom-bundle.css/js 缺失
npx hexo server      # 启动后预览
```

- **必须先 `npm run build`**，否则 `public/css/custom-bundle.css` 和 `public/js/custom-bundle.js` 不会生成，页面与线上不一致
- Hexo server 不运行 `merge-assets.js`，这是 build 和 server 的核心区别
- 改了 `_config.butterfly.yml` 后需要重启 hexo server 才生效（配置被缓存了）

## 开发规范

### 自定义文件注入方式

所有自定义 CSS/JS 通过 `source/css/` 和 `source/js/` 放置静态文件，在 `_config.butterfly.yml` 的 `inject` 区引用：

```yaml
inject:
  head:
    - <link rel="stylesheet" href="/css/xxx.css">
  bottom:
    - <script src="/js/xxx.js"></script>
```

**不要用 injector 脚本注入复杂 JS**（超过 20 行），字符串拼接会断裂导致函数体粘连。

### 构建管线

`scripts/merge-assets.js` 负责把独立 CSS/JS 文件合并为 `custom-bundle.css` 和 `custom-bundle.js`。新增自定义文件后必须在此注册：

```js
// CSS_FILES 数组末尾加
'/css/xxx.css',
// JS_FILES 数组末尾加
'/js/xxx.js',
```

### 图片路径

新增图片引用前先 `ls source/img/theme/` 确认实际文件名和扩展名（jpg 不是 png）。

**文章封面不能重复**。`source/img/covers/` 里有大量备用封面（hash 命名），新增文章时必须用未被其他文章占用的图。可用以下命令检查已用封面：

```bash
grep "cover:" source/_posts/*.md | sed 's/.*cover: //'
```

### 评论区

所有非文章页面的 front matter 加 `comments: false`（about/works/tags/categories/link 等）。

### 写作风格指南（代写文章时必须遵循）

- **开头**：直接切入，不写废话，常带 `）` 结尾（如"终于做了个正经项目）"）
- **删除线自嘲**：大量使用 `~~...~~` 表达自嘲或补充说明，这是标志性风格
- **加粗强调**：`**...**` 用于关键结论或重点，不过度使用
- **语气**：口语化、日记感，像在跟朋友聊天，不用书面语
- **日语元素**：自然穿插日语词汇/歌名/艺术家名，不用刻意解释
- **谐音梗**：偶尔使用谐音梗（如"硕士化"= 说实话的谐音），这是个人风格
- **省略号**：用 `......`（六个点），偶尔用 `...`
- **括号**：用中文括号 `（）`，半角 `）` 做语气收尾很常见
- **列表**：用 `-` 不用 `*`
- **歌曲引用**：用书名号 《》
- **情绪表达**：坦诚面对迷茫、拖延、焦虑，不鸡汤、不说教
- **结尾**：简短收束，不写长篇总结，留有余韵

### 禁止事项

- **不要添加公告弹窗功能**（用户明确拒绝）
- **不要修改 node_modules 里的主题源码**（npm install 会覆盖）
- 触屏检测用 `@media (pointer: fine)` 或 `window.matchMedia('(pointer: fine)')`，不要用 `ontouchstart`（Chrome 桌面端也会定义）

## 服务器信息

| 项目 | 值 |
|------|-----|
| 域名 | `arata66.top` / `www.arata66.top` |
| SSH | `Arata66@65.52.173.202`，密钥 `E:/微软云服务器ssh私钥/Arata66.pem` |
| 系统 | Ubuntu 22.04，1GB RAM，2 vCPU |
| Web | Nginx，静态文件 `/var/www/blog/`，gzip 已启用 |
| SSL | Let's Encrypt，到期 2026-09-23 |
| DNS | NameSilo，A 记录 → `65.52.173.202` |

### SSH 连接故障排查

1. 本地测试：`ssh -o StrictHostKeyChecking=no -i "密钥路径" Arata66@65.52.173.202 "echo ok"`
2. 失败 → 关掉梯子再试
3. 还不行 → Azure 门户「运行命令」执行 `sudo systemctl status sshd`

**重要：`hexo deploy`（git deploy）已禁用**，_config.yml 中 deploy 段已删除，避免生成文件覆盖 GitHub 上的源码。

## 设计系统

### 配色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--primary` | `#b48ead` | 柔紫主色 |
| `--accent` | `#f4a9c0` | 粉色强调 |
| `--bg-deep` | `#1a1025` | 深紫夜空背景 |
| `--text-bright` | `#f0e6f6` | 浅紫白文字 |
| `--text-muted` | `#c8b8d4` | 次要文字 |

### 动画

- 弹性缓动：`cubic-bezier(0.34, 1.56, 0.64, 1)`
- 基线 transition：`0.3s ease`
- 卡片 hover：`0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`

## 第三方服务

- **Meting 歌单 API**：`https://api.injahow.cn/meting/?type=playlist&id=2690018998`（`meting-api.imsyy.top` 已失效）
- **和风天气 API**：Host `m278m3h4kt.re.qweatherapi.com`，Key `b91075fe9ba547a99a3709751b028d07`，城市杭州 `101210101`
- **Google Analytics**：`G-TNQ7HLB386`，数据在 analytics.google.com 查看
- **评论**：Giscus
- **统计**：busuanzi
- **SEO**：hexo-generator-sitemap + hexo-generator-feed + robots.txt
