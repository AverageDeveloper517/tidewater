module.exports = {
  apps: [
    {
      name: 'tidewater',
      script: 'src/index.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
