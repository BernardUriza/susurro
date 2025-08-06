const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Simple Progress Test\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[WORKER]') || text.includes('[HOOK]')) {
      console.log(text);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:3001');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Select BASE model
  await page.keyboard.press('ArrowDown');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\nPressing ENTER to start download...\n');
  await page.keyboard.press('Enter');
  
  // Wait and monitor
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  await browser.close();
})();
