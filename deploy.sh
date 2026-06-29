#!/bin/bash
# 博客一键部署脚本
# 用法: bash deploy.sh [commit信息]
# 示例: bash deploy.sh "新增文章xxx"
# 示例: bash deploy.sh              (仅部署，不提交git)

set -e

# ========== 配置区 ==========
SERVER="Arata66@65.52.173.202"
SSH_KEY="E:/微软云服务器ssh私钥/Arata66.pem"
REMOTE_DIR="/var/www/blog"
HEXO_DIR="$(cd "$(dirname "$0")" && pwd)"
# ============================

cd "$HEXO_DIR"

# 1. 构建
echo "▶ 清理旧文件..."
npx hexo clean
echo "▶ 构建静态文件..."
npx hexo g
echo "▶ 合并自定义静态资源..."
node scripts/merge-assets.js
echo "▶ 为资源添加版本号（防缓存）..."
node scripts/cache-bust.js

# 2. 上传到服务器
echo "▶ 上传到服务器..."
# 先清空远程目录再上传，避免残留旧文件
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER" \
    "echo 'Arata66' | sudo -S rm -rf ${REMOTE_DIR}/*"
scp -o StrictHostKeyChecking=no -i "$SSH_KEY" -r \
    public/* "${SERVER}:/tmp/blog_upload/"
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SERVER" \
    "echo 'Arata66' | sudo -S cp -r /tmp/blog_upload/* ${REMOTE_DIR}/ && \
     sudo chown -R www-data:www-data ${REMOTE_DIR} && \
     sudo rm -rf /tmp/blog_upload"

# 3. Git 提交（如果传了 commit 信息）
if [ -n "$1" ]; then
    echo "▶ 提交到 Git..."
    git add -A
    git commit -m "$1"
    git -c http.proxy=http://127.0.0.1:28839 -c http.sslVerify=false push
    echo "✓ 已推送到 GitHub"
fi

echo ""
echo "✓ 部署完成！访问 http://65.52.173.202 查看"
