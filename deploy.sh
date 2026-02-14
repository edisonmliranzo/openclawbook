#!/bin/bash
# OpenClaw VPS deploy script
# Run this on your VPS as root or sudo user
# Usage: bash deploy.sh

set -e

DOMAIN=openclawbook.dev
APP_DIR=/var/www/openclaw

echo "=== OpenClaw Deploy to $DOMAIN ==="

# 1. Install dependencies
echo "[1/7] Installing system packages..."
apt-get update -q
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -q nginx nodejs git certbot python3-certbot-nginx
npm install -g pm2

# 2. Create app directory
echo "[2/7] Setting up app directory..."
mkdir -p $APP_DIR

# 3. Configure Nginx
echo "[3/7] Configuring Nginx..."
cp $APP_DIR/nginx.conf /etc/nginx/sites-available/openclaw
ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/openclaw
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 4. Install server dependencies
echo "[4/7] Installing server dependencies..."
cd $APP_DIR/server && npm ci --production

# 5. Start backend with PM2
echo "[5/7] Starting backend..."
cd $APP_DIR
pm2 start ecosystem.config.cjs || pm2 reload ecosystem.config.cjs --update-env
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true

# 6. SSL
echo "[6/7] SSL setup..."
echo "To enable HTTPS run:"
echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo ""
echo "=== Done! ==="
echo "Site: http://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Set up GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)"
echo "2. Run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "3. Push to main branch to auto-deploy"
