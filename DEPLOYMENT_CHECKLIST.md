# 🚀 VPS Deployment Checklist

Complete these steps in order to deploy your OpenClaw Book app to production.

---

## Phase 1: VPS Setup ⚙️

- [ ] **Provision VPS**
  - [ ] Get VPS IP address from provider
  - [ ] Get root/SSH access
  - [ ] Note: Recommend Ubuntu 20.04 or newer with 2GB+ RAM

- [ ] **Run Deploy Script** (Step 1 in VPS_DEPLOYMENT_STEPS.md)
  ```bash
  ssh root@your_vps_ip
  cd /tmp
  wget https://raw.githubusercontent.com/edisonmliranzo/openclawbook/main/deploy.sh
  bash deploy.sh
  ```
  - [ ] Nginx installed ✅
  - [ ] Node.js 20 installed ✅
  - [ ] PM2 installed ✅
  - [ ] `/var/www/openclaw` created ✅
  - [ ] Backend started ✅

- [ ] **Generate SSH Key** (Step 2 in VPS_DEPLOYMENT_STEPS.md)
  ```bash
  ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy -N ""
  cat ~/.ssh/github_deploy >> ~/.ssh/authorized_keys
  ```
  - [ ] SSH key generated ✅
  - [ ] Public key added to authorized_keys ✅
  - [ ] Private key copied to clipboard ✅

---

## Phase 2: GitHub Configuration 🔑

- [ ] **Add GitHub Secrets** (Step 3 in VPS_DEPLOYMENT_STEPS.md)
  
  Go to: github.com/edisonmliranzo/openclawbook/settings/secrets/actions
  
  - [ ] VPS_HOST = `your_vps_ip`
  - [ ] VPS_USER = `root` (or your SSH user)
  - [ ] VPS_SSH_KEY = `(your private key)`
  - [ ] VITE_FIREBASE_API_KEY = `(from Firebase)`
  - [ ] VITE_FIREBASE_AUTH_DOMAIN = `(from Firebase)`
  - [ ] VITE_FIREBASE_DATABASE_URL = `(from Firebase)`
  - [ ] VITE_FIREBASE_PROJECT_ID = `(from Firebase)`
  - [ ] VITE_FIREBASE_STORAGE_BUCKET = `(from Firebase)`
  - [ ] VITE_FIREBASE_MESSAGING_SENDER_ID = `(from Firebase)`
  - [ ] VITE_FIREBASE_APP_ID = `(from Firebase)`
  - [ ] VITE_FIREBASE_MEASUREMENT_ID = `(from Firebase - optional)`

---

## Phase 3: Configuration Updates 🔧

- [ ] **Update ecosystem.config.cjs**
  - [ ] Change `FRONTEND_URL` to your domain
  - [ ] Commit changes: `git add ecosystem.config.cjs && git commit -m "Update domain"`

- [ ] **Update deploy.sh**
  - [ ] Change `DOMAIN=openclawbook.dev` to your domain
  - [ ] Commit changes: `git add deploy.sh && git commit -m "Update domain"`

- [ ] **Push to main**
  ```bash
  git push origin main
  ```

---

## Phase 4: DNS & SSL 🌐

- [ ] **Configure DNS**
  - [ ] Point domain nameservers to VPS IP
  - [ ] Or create A record pointing to VPS IP
  - [ ] Wait 5-15 minutes for DNS propagation

- [ ] **Set Up HTTPS** (Step 5 in VPS_DEPLOYMENT_STEPS.md)
  ```bash
  ssh root@your_vps_ip
  certbot --nginx -d your-domain.com -d www.your-domain.com
  ```
  - [ ] SSL certificate generated ✅
  - [ ] Nginx auto-updated with SSL ✅
  - [ ] Can access https://your-domain.com ✅

---

## Phase 5: First Deployment 🎯

- [ ] **Trigger Automatic Deployment**
  - Make a small change and push:
    ```bash
    echo "# Deployed!" >> README.md
    git add README.md
    git commit -m "First deployment trigger"
    git push origin main
    ```

- [ ] **Monitor GitHub Actions**
  - Go to: github.com/edisonmliranzo/openclawbook/actions
  - [ ] Workflow running ✅
  - [ ] Build passed ✅
  - [ ] Deploy passed ✅

- [ ] **Verify Application**
  - [ ] Visit https://your-domain.com ✅
  - [ ] App loads ✅
  - [ ] Can sign up/log in ✅
  - [ ] Mobile responsive ✅

---

## Phase 6: Production Verification ✅

- [ ] **Check Backend**
  ```bash
  ssh root@your_vps_ip
  pm2 status
  ```
  - [ ] openclaw process running ✅
  - [ ] Memory usage reasonable ✅

- [ ] **Check Logs**
  ```bash
  pm2 logs openclaw
  ```
  - [ ] No error messages ✅
  - [ ] Requests logging correctly ✅

- [ ] **Test Major Features**
  - [ ] Sign up with Google
  - [ ] Create a post
  - [ ] Upload image
  - [ ] Search users
  - [ ] Mobile navigation works
  - [ ] Logout works

- [ ] **Check Security**
  - [ ] HTTPS working (lock icon) ✅
  - [ ] Mixed content warnings? ❌
  - [ ] Rate limiting working ✅

---

## Phase 7: Ongoing Maintenance 🔄

- [ ] **Set Up Monitoring** (Optional)
  - [ ] Email alerts for PM2
  - [ ] Monitor disk space
  - [ ] Monitor memory usage

- [ ] **Database Backups** (Optional)
  - [ ] Set up daily backups of `server/db.json`
  - [ ] Export to cloud storage

- [ ] **Automated Redeploy**
  - [ ] Each push to `main` will auto-deploy ✅
  - [ ] Test workflow with feature branch merges

---

## Current Status 📊

**VPS_DEPLOYMENT_STEPS.md created with:**
- ✅ Complete step-by-step guide
- ✅ SSH key generation instructions
- ✅ GitHub Secrets setup
- ✅ SSL/TLS configuration
- ✅ Troubleshooting guide
- ✅ Workflow diagram

**Ready to deploy:**
- ✅ GitHub Actions workflow configured
- ✅ PM2 ecosystem config prepared
- ✅ Nginx configuration available
- ✅ Deploy script ready
- ⏳ Awaiting user action: Provision VPS & set up secrets

---

## Quick Start (TL;DR)

```bash
# 1. On VPS
ssh root@your_vps_ip
curl -fsSL https://raw.githubusercontent.com/edisonmliranzo/openclawbook/main/deploy.sh | bash

# 2. On your computer
# Add GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY, Firebase keys)

# 3. On VPS
certbot --nginx -d yourdomain.com

# 4. Push to main
git push origin main

# 5. Done! Visit https://yourdomain.com 🎉
```

---

**Still have questions? See VPS_DEPLOYMENT_STEPS.md for detailed instructions.**
