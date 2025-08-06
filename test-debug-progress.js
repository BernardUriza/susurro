const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Debug: Testing Progress Event Flow\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: false
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // Inject console logging to track all events
  await page.evaluateOnNewDocument(() => {
    // Override postMessage to log worker messages
    const originalPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(...args) {
      console.log('[WORKER->MAIN]', JSON.stringify(args[0]));
      return originalPostMessage.apply(this, args);
    };
    
    // Track onmessage events
    const originalAddEventListener = Worker.prototype.addEventListener;
    Worker.prototype.addEventListener = function(event, handler) {
      if (event === 'message') {
        const wrappedHandler = function(e) {
          console.log('[MAIN<-WORKER]', JSON.stringify(e.data));
          return handler.call(this, e);
        };
        return originalAddEventListener.call(this, event, wrappedHandler);
      }
      return originalAddEventListener.apply(this, arguments);
    };
  });
  
  const logs = [];
  
  // Capture all console logs
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Log worker messages
    if (text.includes('WORKER')) {
      console.log(text);
    }
    
    // Log progress events
    if (text.includes('progress') || text.includes('%') || text.includes('📥')) {
      console.log('[PROGRESS]:', text);
    }
  });
  
  try {
    console.log('1️⃣ Loading page...\n');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear all storage to force model selector
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            indexedDB.deleteDatabase(db.name);
            console.log(`Deleted IndexedDB: ${db.name}`);
          });
        });
      }
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
            console.log(`Deleted cache: ${name}`);
          });
        });
      }
    });
    
    // Reload to get selector
    console.log('2️⃣ Reloading page with cleared storage...\n');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for selector
    const hasSelector = await page.evaluate(() => {
      const selector = document.querySelector('[style*="z-index: 9999"]');
      return !!selector;
    });
    
    if (hasSelector) {
      console.log('✅ Model selector found\n');
      
      // Select BASE model
      console.log('3️⃣ Selecting BASE model...\n');
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start download
      console.log('4️⃣ Starting download...\n');
      console.log('=' .repeat(60));
      await page.keyboard.press('Enter');
      
      // Monitor for 30 seconds
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check DOM for WhisperEchoLogs content
        const logContent = await page.evaluate(() => {
          const logElements = document.querySelectorAll('[class*="logEntry"]');
          return Array.from(logElements).map(el => el.textContent);
        });
        
        if (logContent.length > 0) {
          console.log(`\n[${i}s] WhisperEchoLogs contains ${logContent.length} entries`);
          const progressLogs = logContent.filter(log => log.includes('%') || log.includes('📥'));
          if (progressLogs.length > 0) {
            console.log('Progress logs found:');
            progressLogs.forEach(log => console.log(`  - ${log}`));
          }
        }
      }
      
    } else {
      console.log('❌ Model selector not found');
    }
    
    // Analyze collected logs
    console.log('\n' + '=' .repeat(60));
    console.log('LOG ANALYSIS:');
    console.log('=' .repeat(60));
    
    const workerMessages = logs.filter(log => log.includes('WORKER'));
    const progressMessages = logs.filter(log => log.includes('progress') && log.includes('%'));
    
    console.log(`Total logs collected: ${logs.length}`);
    console.log(`Worker messages: ${workerMessages.length}`);
    console.log(`Progress messages: ${progressMessages.length}`);
    
    if (workerMessages.length > 0) {
      console.log('\nSample worker messages:');
      workerMessages.slice(0, 5).forEach(msg => console.log(`  - ${msg.substring(0, 100)}...`));
    }
    
    if (progressMessages.length === 0) {
      console.log('\n❌ NO PROGRESS MESSAGES FOUND');
      console.log('This indicates the progress events are not flowing from worker to UI');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await browser.close();
  console.log('\n✅ Debug test complete');
})();