#!/bin/bash
# OpenClaw VPS deploy script
# Run this on your Contabo VPS as root or sudo user
# Usage: bash deploy.sh yourdomain.com

set -e

DOMAIN=${1:-yourdomain.com}
APP_DIR=/var/www/openclaw
REPO=https://github.com/edisonmliranzo/openclawbook.git

echo "=== OpenClaw Deploy to $DOMAIN ==="

# 1. Install dependencies
echo "[1/7] Installing system packages..."
apt-get update -q
apt-get install -y -q nginx nodejs npm git certbot python3-certbot-nginx
npm install -g pm2

# 2. Clone or pull repo
echo "[2/7] Pulling latest code..."
if [ -d "$APP_DIR" ]; then
  cd $APP_DIR && git pull
else
  git clone $REPO $APP_DIR
  cd $APP_DIR
fi

# 3. Install node modules
echo "[3/7] Installing dependencies..."
npm install
cd server && npm install && cd ..

# 4. Build frontend
echo "[4/7] Building frontend..."
VITE_API_URL="" npm run build

# 5. Configure Nginx
echo "[5/7] Configuring Nginx..."
sed "s/yourdomain.com/$DOMAIN/g" nginx.conf > /etc/nginx/sites-available/openclaw
ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/openclaw
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. Start backend with PM2
echo "[6/7] Starting backend..."
sed -i "s/yourdomain.com/$DOMAIN/g" ecosystem.config.cjs
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

# 7. SSL (optional — requires domain DNS to point to this server first)
echo "[7/7] SSL setup..."
echo "To enable HTTPS run:"
echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo ""
echo "=== Done! ==="
echo "Site: http://$DOMAIN"
echo ""
echo "IMPORTANT: Edit ecosystem.config.cjs and set:"
echo "  TOKEN_SECRET  — use a strong random string"
echo "  FRONTEND_URL  — https://$DOMAIN"
echo "Then restart: pm2 restart openclaw-server"
