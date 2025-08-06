const puppeteer = require('puppeteer');

(async () => {
  console.log('🌐 Network Monitor Test for Model Download\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Monitor network requests
  const downloadRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('huggingface') || url.includes('onnx') || url.includes('model')) {
      console.log(`📡 REQUEST: ${url.substring(0, 100)}...`);
      downloadRequests.push(url);
    }
  });
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('huggingface') || url.includes('onnx') || url.includes('model')) {
      const status = response.status();
      const size = response.headers()['content-length'];
      console.log(`📥 RESPONSE: ${status} - ${size ? Math.round(size/1024/1024) + 'MB' : 'unknown size'} - ${url.substring(0, 80)}...`);
    }
  });
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('📥') || text.includes('%') || text.includes('Progress')) {
      console.log(`[CONSOLE]: ${text}`);
    }
  });
  
  console.log('1️⃣ Loading page...\n');
  await page.goto('http://localhost:3001');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Clear cache in page context
  await page.evaluate(() => {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    localStorage.clear();
    sessionStorage.clear();
  });
  
  console.log('2️⃣ Reloading with cleared cache...\n');
  await page.reload();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check for selector
  const hasSelector = await page.evaluate(() => {
    return !!document.querySelector('[style*="z-index: 9999"]');
  });
  
  if (hasSelector) {
    console.log('3️⃣ Selecting BASE model...\n');
    await page.keyboard.press('ArrowDown');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('4️⃣ Starting download...\n');
    console.log('=' .repeat(60));
    console.log('MONITORING NETWORK ACTIVITY:');
    console.log('=' .repeat(60) + '\n');
    
    await page.keyboard.press('Enter');
    
    // Monitor for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('\n' + '=' .repeat(60));
    console.log('SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`Total download requests: ${downloadRequests.length}`);
    
    if (downloadRequests.length > 0) {
      console.log('\nModel files requested:');
      downloadRequests.forEach(url => {
        const filename = url.split('/').pop();
        console.log(`  - ${filename}`);
      });
    } else {
      console.log('\n❌ No model download requests detected!');
      console.log('This means the model is likely cached in IndexedDB.');
    }
  } else {
    console.log('❌ Model selector not found');
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
})();