// E2E Test Setup
jest.setTimeout(30000);

// Configuración de Puppeteer
module.exports = {
  launch: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  server: {
    command: 'npm run dev',
    port: 3000,
    launchTimeout: 30000,
    debug: true
  }
};