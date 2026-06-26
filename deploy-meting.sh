#!/bin/bash
# 在 Azure VM 上部署 meting-api（网易云音乐 VIP 代理）
# 用法：先手动获取网易云 Cookie，然后运行：
#   bash deploy-meting.sh "你的MUSIC_U值"

set -e

COOKIE="${1:?请传入网易云 Cookie（MUSIC_U 值），用法：bash deploy-meting.sh \"MUSIC_U=xxx\"}"

SERVER="Arata66@65.52.173.202"
SSH_KEY="E:/微软云服务器ssh私钥/Arata66.pem"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER"
REMOTE_DIR="/opt/meting-api"

echo ">>> 1/4  安装 Node.js 18 LTS ..."
$SSH_CMD "
  if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  echo 'Node:' \$(node -v)
"

echo ">>> 2/4  克隆/更新 meting-api ..."
$SSH_CMD "
  sudo mkdir -p $REMOTE_DIR
  sudo chown Arata66:Arata66 $REMOTE_DIR
  if [ -d $REMOTE_DIR/.git ]; then
    cd $REMOTE_DIR && git pull
  else
    cd /opt && git clone https://github.com/injahow/meting-api.git
  fi
  cd $REMOTE_DIR && npm install --production
"

echo ">>> 3/4  写入环境变量并启动（PM2）..."
$SSH_CMD "
  # 写 Cookie 到 .env（不含 MUSIC_U= 前缀时自动补上）
  COOKIE_VAL='$COOKIE'
  if [[ \$COOKIE_VAL != MUSIC_U=* ]]; then
    COOKIE_VAL=\"MUSIC_U=\$COOKIE_VAL\"
  fi
  echo \"NETEASE_COOKIE=\$COOKIE_VAL\" > $REMOTE_DIR/.env

  # 全局安装 PM2（如未装）
  sudo npm install -g pm2 2>/dev/null || true
  sudo pm2 startup systemd -u Arata66 --hp /home/Arata66 2>/dev/null || true

  cd $REMOTE_DIR
  pm2 delete meting-api 2>/dev/null || true
  PORT=3000 pm2 start server.js --name meting-api
  pm2 save
  echo 'PM2 状态：'
  pm2 list
"

echo ">>> 4/4  配置 Nginx 反向代理 /meting ..."
$SSH_CMD "
  sudo tee /etc/nginx/sites-available/meting-api >/dev/null << 'NGINX'
server {
    listen 3001;
    server_name _;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_read_timeout 30s;
    }
}
NGINX
  sudo ln -sf /etc/nginx/sites-available/meting-api /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
"

echo ""
echo "========================================="
echo " 部署完成！"
echo " 测试：http://65.52.173.202:3001/?type=playlist&id=2690018998"
echo "========================================="
