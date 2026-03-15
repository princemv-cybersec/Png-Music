module.exports = {
  apps: [
    {
      name: 'png-music-bot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'lavalink',
      script: 'java',
      args: '-jar Lavalink.jar',
      autorestart: true,
      watch: false,
    },
  ],
};
