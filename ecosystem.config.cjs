module.exports = {
  apps: [
    {
      name: 'openclaw',
      script: 'server/index.js',
      cwd: '/var/www/openclaw',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        FRONTEND_URL: 'https://openclawbook.dev',
      },
    },
  ],
};
