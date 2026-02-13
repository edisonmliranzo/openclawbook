module.exports = {
  apps: [
    {
      name: 'openclaw-server',
      script: 'server/index.js',
      cwd: '/var/www/openclaw',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        TOKEN_SECRET: 'CHANGE_ME_STRONG_SECRET',
        FRONTEND_URL: 'https://yourdomain.com',
        SMTP_HOST: '',
        SMTP_PORT: 587,
        SMTP_USER: '',
        SMTP_PASS: '',
      },
    },
  ],
};
