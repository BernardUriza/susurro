module.exports = {
  launch: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  server: {
    command: 'cd ../.. && npm run dev',
    port: 3000,
    launchTimeout: 30000,
    debug: true
  }
};