# VPS Deployment Steps for OpenClaw Book

Your app is ready to deploy! Follow these steps to set up continuous deployment to your VPS.

## Prerequisites
- VPS with Ubuntu 20.04+ (or similar Linux)
- SSH access to your VPS
- GitHub account with admin access to the repo
- Domain name (optional but recommended)

---

## Step 1: Set Up Your VPS

### 1.1 SSH into your VPS
```bash
ssh root@your_vps_ip
```

### 1.2 Run the initial deploy script
```bash
cd /tmp
wget https://raw.githubusercontent.com/edisonmliranzo/openclawbook/main/deploy.sh
bash deploy.sh
```

This will:
- ✅ Install Node.js, Nginx, PM2, Git
- ✅ Create `/var/www/openclaw` directory
- ✅ Configure Nginx as reverse proxy
- ✅ Set up PM2 process management

---

## Step 2: Generate SSH Key for GitHub Actions

### 2.1 On your VPS, generate an SSH key (if you don't have one)
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy -N ""
```

### 2.2 Add the public key to VPS authorized keys
```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 2.3 Get your private key content
```bash
cat ~/.ssh/github_deploy
```

Copy the entire output (starts with `-----BEGIN OPENSSH PRIVATE KEY-----`)

---

## Step 3: Set Up GitHub Secrets

Go to: https://github.com/edisonmliranzo/openclawbook/settings/secrets/actions

Add these secrets:

### 3.1 VPS Authentication Secrets
- **VPS_HOST**: Your VPS IP address or domain
  - Example: `123.456.789.012` or `openclawbook.dev`
  
- **VPS_USER**: The SSH user (usually `root` or your deployment user)
  - Example: `root`
  
- **VPS_SSH_KEY**: Your private SSH key
  - Paste the entire key from Step 2.3

### 3.2 Firebase Secrets (for frontend build)
Add these from your Firebase console: https://console.firebase.google.com

- **VITE_FIREBASE_API_KEY**: Your Firebase API key
- **VITE_FIREBASE_AUTH_DOMAIN**: Your Firebase auth domain
- **VITE_FIREBASE_DATABASE_URL**: Your Firebase database URL
- **VITE_FIREBASE_PROJECT_ID**: Your Firebase project ID
- **VITE_FIREBASE_STORAGE_BUCKET**: Your Firebase storage bucket
- **VITE_FIREBASE_MESSAGING_SENDER_ID**: Your Firebase messaging sender ID
- **VITE_FIREBASE_APP_ID**: Your Firebase app ID
- **VITE_FIREBASE_MEASUREMENT_ID**: Your Firebase measurement ID (optional)

**Note**: If you don't have Firebase set up yet, leave these blank or use dummy values. The app will still work with local auth.

---

## Step 4: Update Deployment Configuration

### 4.1 Update ecosystem.config.cjs with your domain
```bash
# Edit the file:
nano ecosystem.config.cjs
```

Change:
```javascript
FRONTEND_URL: 'https://your-actual-domain.com', // Update this
```

### 4.2 Update deploy.sh with your domain
```bash
nano deploy.sh
```

Change:
```bash
DOMAIN=your-actual-domain.com  # Change from openclawbook.dev
```

### 4.3 Commit changes
```bash
cd /path/to/openclawbook
git add ecosystem.config.cjs deploy.sh
git commit -m "Update deployment config with domain"
git push origin main
```

---

## Step 5: Set Up SSL Certificate (HTTPS)

### 5.1 On your VPS, run certbot
```bash
ssh root@your_vps_ip
certbot --nginx -d your-domain.com -d www.your-domain.com
```

This will automatically update your Nginx config with SSL.

---

## Step 6: Deploy!

### 6.1 Trigger automatic deployment
Every time you push to `main` branch, GitHub Actions will:
1. ✅ Build your React frontend
2. ✅ Install server dependencies
3. ✅ Deploy to your VPS
4. ✅ Restart the app with PM2

Just push:
```bash
git push origin main
```

### 6.2 Manual deployment (if needed)
```bash
ssh root@your_vps_ip
cd /var/www/openclaw
git pull origin main
cd server && npm ci --production
cd .. && npm run build
pm2 reload ecosystem.config.cjs --update-env
```

---

## Step 7: Verify Deployment

### 7.1 Check deployment status
Go to: https://github.com/edisonmliranzo/openclawbook/actions

You should see the deploy workflow running or completed.

### 7.2 Check application on VPS
```bash
ssh root@your_vps_ip
pm2 status       # Check if app is running
pm2 logs openclaw  # View app logs
```

### 7.3 Visit your site
```
https://your-domain.com
```

---

## Troubleshooting

### GitHub Actions fails with "Permission denied"
- **Fix**: Check VPS_SSH_KEY is the complete private key (including BEGIN/END lines)
- Check VPS_USER matches the user on your VPS
- Verify the public key is in `~/.ssh/authorized_keys` on VPS

### App won't start after deploy
```bash
ssh root@your_vps_ip
cd /var/www/openclaw
pm2 logs openclaw  # Check error logs
pm2 restart openclaw
```

### Nginx 502 Bad Gateway
- Check if backend is running: `pm2 status`
- Verify port 4001 is listening: `netstat -an | grep 4001`
- Check Nginx config: `nginx -t`

### Can't connect to domain
- Check DNS is pointing to your VPS IP
- Verify firewall allows ports 80 and 443
- Check Nginx is running: `systemctl status nginx`

---

## Workflow Summary

```
Local Development
       ↓
git push origin main
       ↓
GitHub Actions triggered
       ↓
Build frontend (React)
Install dependencies
       ↓
Deploy to VPS via SSH
       ↓
Run deploy scripts on VPS
       ↓
PM2 restarts app
       ↓
✅ Live at your-domain.com
```

---

## Contact for Help

Deployment issues? Check:
1. GitHub Actions logs: https://github.com/edisonmliranzo/openclawbook/actions
2. VPS logs: `pm2 logs openclaw`
3. Nginx logs: `/var/log/nginx/error.log`

**Happy deploying! 🚀**
