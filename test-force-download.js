const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🎯 FORCE DOWNLOAD TEST - BASE Model with Progress\n');
  
  // First, delete any local browser data
  const userDataDir = path.join(__dirname, '.puppeteer-data');
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    console.log('✅ Deleted local browser data\n');
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
      '--incognito',
      '--disable-application-cache',
      '--disable-offline-load-stale-cache',
      '--disk-cache-size=0',
      '--media-cache-size=0',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection'
    ],
    userDataDir: userDataDir
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // Clear everything before navigation
  await page.evaluateOnNewDocument(() => {
    // Clear all storage types
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    
    // Override IndexedDB to prevent caching
    const deleteDB = indexedDB.deleteDatabase;
    indexedDB.deleteDatabase = function(...args) {
      console.log('Deleting IndexedDB:', args[0]);
      return deleteDB.apply(this, args);
    };
    
    // Clear all IndexedDB databases
    if ('indexedDB' in window) {
      indexedDB.databases = indexedDB.databases || (() => Promise.resolve([]));
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => indexedDB.deleteDatabase(db.name));
      });
    }
    
    // Clear caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  });
  
  // Track progress
  const progressLog = [];
  let highestProgress = 0;
  
  page.on('console', msg => {
    const text = msg.text();
    
    // Capture progress messages
    if (text.includes('📥')) {
      progressLog.push(text);
      const match = text.match(/(\d+)%/);
      if (match) {
        const percent = parseInt(match[1]);
        if (percent > highestProgress) {
          highestProgress = percent;
          console.log(`📥 NEW PROGRESS: ${percent}%`);
        }
      }
    }
    
    // Log model loading messages
    if (text.includes('Iniciando descarga') || 
        text.includes('modelo') || 
        text.includes('Modelo') ||
        text.includes('cargado')) {
      console.log(`[MODEL]: ${text}`);
    }
  });
  
  try {
    console.log('1️⃣ Navigating to localhost:3001 in incognito mode...\n');
    
    await page.goto('http://localhost:3001', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Force clear everything again after page load
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        return new Promise((resolve) => {
          const dbs = ['transformers-cache', 'model-cache', 'whisper-cache'];
          let deleted = 0;
          dbs.forEach(db => {
            const req = indexedDB.deleteDatabase(db);
            req.onsuccess = () => {
              console.log(`Deleted database: ${db}`);
              deleted++;
              if (deleted === dbs.length) resolve();
            };
            req.onerror = () => {
              deleted++;
              if (deleted === dbs.length) resolve();
            };
          });
          setTimeout(resolve, 1000); // Fallback timeout
        });
      }
    });
    
    console.log('2️⃣ Storage cleared, reloading page...\n');
    
    // Hard reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for model selector
    const hasSelector = await page.evaluate(() => {
      const selector = document.querySelector('[style*="z-index: 9999"]');
      return !!selector;
    });
    
    if (!hasSelector) {
      console.log('❌ Model selector not found - taking diagnostic screenshot');
      await page.screenshot({ 
        path: 'test/screenshots/no-selector.png',
        fullPage: true 
      });
    } else {
      console.log('✅ Model selector is visible!\n');
      
      // Select BASE model
      console.log('3️⃣ Selecting BASE model...');
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await page.screenshot({ 
        path: 'test/screenshots/force-base-selected.png',
        fullPage: true 
      });
      
      console.log('4️⃣ Starting download (pressing ENTER)...\n');
      console.log('=' .repeat(60));
      console.log('MONITORING DOWNLOAD PROGRESS:');
      console.log('=' .repeat(60) + '\n');
      
      await page.keyboard.press('Enter');
      
      // Monitor for 90 seconds
      for (let i = 0; i < 90; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check WhisperEchoLogs DOM
        const logsInDOM = await page.evaluate(() => {
          const logs = Array.from(document.querySelectorAll('[class*="logEntry"]'));
          return logs.map(el => el.textContent).filter(text => 
            text && (text.includes('%') || text.includes('📥') || text.includes('Descargando'))
          );
        });
        
        if (logsInDOM.length > 0) {
          console.log(`\n[${i}s] Found ${logsInDOM.length} progress logs in DOM:`);
          logsInDOM.slice(-3).forEach(log => console.log(`  ${log}`));
        }
        
        // Take screenshot at milestones
        if (highestProgress >= 25 && highestProgress < 30) {
          await page.screenshot({ 
            path: 'test/screenshots/force-progress-25.png',
            fullPage: false 
          });
        }
        if (highestProgress >= 50 && highestProgress < 55) {
          await page.screenshot({ 
            path: 'test/screenshots/force-progress-50.png',
            fullPage: false 
          });
        }
        if (highestProgress >= 75 && highestProgress < 80) {
          await page.screenshot({ 
            path: 'test/screenshots/force-progress-75.png',
            fullPage: false 
          });
        }
        if (highestProgress >= 100) {
          console.log('\n✅ MODEL LOADED (100%)!');
          await page.screenshot({ 
            path: 'test/screenshots/force-progress-100.png',
            fullPage: false 
          });
          break;
        }
        
        // Check for completion
        const isComplete = await page.evaluate(() => {
          const logs = Array.from(document.querySelectorAll('*'));
          return logs.some(el => 
            el.textContent && el.textContent.includes('✅') && 
            el.textContent.includes('cargado')
          );
        });
        
        if (isComplete) {
          console.log('\n✅ Model loaded successfully!');
          break;
        }
      }
    }
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('SUMMARY:');
    console.log('=' .repeat(60));
    console.log(`Highest progress achieved: ${highestProgress}%`);
    console.log(`Total progress logs captured: ${progressLog.length}`);
    
    if (progressLog.length > 0) {
      console.log('\nFirst 5 progress logs:');
      progressLog.slice(0, 5).forEach(log => console.log(`  - ${log}`));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ 
      path: 'test/screenshots/force-error.png',
      fullPage: true 
    });
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
})();