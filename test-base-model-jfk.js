const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('🎯 Testing BASE Model Download & JFK Quote\n');
  console.log('This test will:');
  console.log('1. Select BASE model');
  console.log('2. Monitor download progress from 0% to 100%');
  console.log('3. Find JFK quote in the interface\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // Create screenshots directory if not exists
  if (!fs.existsSync('test/screenshots')) {
    fs.mkdirSync('test/screenshots', { recursive: true });
  }
  
  // Clear all browser data to force fresh download
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCache');
  await client.send('Network.clearBrowserCookies');
  
  // Clear IndexedDB
  await page.evaluateOnNewDocument(() => {
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          indexedDB.deleteDatabase(db.name);
        });
      });
    }
  });
  
  console.log('✅ Cache and IndexedDB cleared - forcing fresh download\n');
  
  const progressPercentages = [];
  let lastPercentage = -1;
  let modelLoaded = false;
  let jfkFound = false;
  
  // Capture console logs for progress
  page.on('console', msg => {
    const text = msg.text();
    
    // Look for progress percentages
    if (text.includes('📥')) {
      const match = text.match(/(\d+)%/);
      if (match) {
        const percent = parseInt(match[1]);
        if (percent !== lastPercentage) {
          lastPercentage = percent;
          progressPercentages.push(percent);
          console.log(`📥 Download Progress: ${percent}%`);
        }
      }
    }
    
    // Check if model loaded
    if (text.includes('✅') && text.includes('cargado')) {
      modelLoaded = true;
      console.log('✅ Model loaded successfully!');
    }
  });
  
  try {
    console.log('1️⃣ Navigating to http://localhost:3001...\n');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for model selector
    const hasSelector = await page.evaluate(() => {
      const selector = document.querySelector('[style*="z-index: 9999"]');
      return !!selector;
    });
    
    if (!hasSelector) {
      console.log('❌ Model selector not visible - clearing storage and reloading...');
      
      // Clear all storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
      });
      
      // Reload page
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('2️⃣ Selecting BASE model...\n');
    
    // Take screenshot of selector
    await page.screenshot({ 
      path: 'test/screenshots/base-1-selector.png',
      fullPage: true 
    });
    
    // Navigate to BASE model (one arrow down)
    await page.keyboard.press('ArrowDown');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await page.screenshot({ 
      path: 'test/screenshots/base-2-base-selected.png',
      fullPage: true 
    });
    
    console.log('3️⃣ Starting download by pressing ENTER...\n');
    console.log('=' .repeat(60));
    console.log('MONITORING DOWNLOAD PROGRESS:');
    console.log('=' .repeat(60) + '\n');
    
    await page.keyboard.press('Enter');
    
    let screenshotCount = 0;
    let lastScreenshotPercent = -1;
    
    // Monitor download for up to 120 seconds
    for (let i = 0; i < 120; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check WhisperEchoLogs for progress
      const currentProgress = await page.evaluate(() => {
        const logs = Array.from(document.querySelectorAll('[class*="logEntry"]'));
        const progressLogs = [];
        
        logs.forEach(log => {
          const text = log.textContent || '';
          if (text.includes('📥') && text.includes('%')) {
            const match = text.match(/(\d+)%/);
            if (match) {
              progressLogs.push({
                percent: parseInt(match[1]),
                text: text.trim()
              });
            }
          }
        });
        
        return progressLogs;
      });
      
      // Take screenshot at key percentages
      if (currentProgress.length > 0) {
        const latestPercent = currentProgress[currentProgress.length - 1].percent;
        
        // Take screenshots at 0%, 25%, 50%, 75%, 100%
        if (latestPercent >= 0 && lastScreenshotPercent < 0) {
          await page.screenshot({ 
            path: `test/screenshots/base-progress-0-percent.png`,
            fullPage: true 
          });
          lastScreenshotPercent = 0;
          console.log('📸 Screenshot: 0% progress');
        }
        if (latestPercent >= 25 && lastScreenshotPercent < 25) {
          await page.screenshot({ 
            path: `test/screenshots/base-progress-25-percent.png`,
            fullPage: true 
          });
          lastScreenshotPercent = 25;
          console.log('📸 Screenshot: 25% progress');
        }
        if (latestPercent >= 50 && lastScreenshotPercent < 50) {
          await page.screenshot({ 
            path: `test/screenshots/base-progress-50-percent.png`,
            fullPage: true 
          });
          lastScreenshotPercent = 50;
          console.log('📸 Screenshot: 50% progress');
        }
        if (latestPercent >= 75 && lastScreenshotPercent < 75) {
          await page.screenshot({ 
            path: `test/screenshots/base-progress-75-percent.png`,
            fullPage: true 
          });
          lastScreenshotPercent = 75;
          console.log('📸 Screenshot: 75% progress');
        }
        if (latestPercent >= 100 && lastScreenshotPercent < 100) {
          await page.screenshot({ 
            path: `test/screenshots/base-progress-100-percent.png`,
            fullPage: true 
          });
          lastScreenshotPercent = 100;
          console.log('📸 Screenshot: 100% progress');
          modelLoaded = true;
          break;
        }
      }
      
      // Also check for completion message
      const isComplete = await page.evaluate(() => {
        const logs = Array.from(document.querySelectorAll('[class*="logEntry"]'));
        return logs.some(log => {
          const text = log.textContent || '';
          return text.includes('✅') && text.includes('cargado');
        });
      });
      
      if (isComplete) {
        modelLoaded = true;
        console.log('\n✅ Model BASE loaded completely!\n');
        break;
      }
      
      // Show status every 5 seconds
      if (i % 5 === 0 && i > 0) {
        console.log(`⏳ Waiting for download... (${i}s elapsed)`);
      }
    }
    
    if (!modelLoaded) {
      console.log('⚠️ Model did not finish loading in time limit');
    }
    
    // Wait a bit for interface to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('4️⃣ Looking for JFK quote in Whisper Matrix Terminal...\n');
    
    // Scroll down in the main content area to find JFK quote
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!jfkFound && attempts < maxAttempts) {
      // Check for JFK quote
      jfkFound = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.some(el => {
          const text = el.textContent || '';
          return text.includes('And so my fellow Americans') || 
                 text.includes('ask not what your country can do for you');
        });
      });
      
      if (jfkFound) {
        console.log('🎯 JFK quote found!');
        
        // Scroll to the element containing the quote
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const jfkElement = elements.find(el => {
            const text = el.textContent || '';
            return text.includes('And so my fellow Americans') || 
                   text.includes('ask not what your country can do for you');
          });
          
          if (jfkElement) {
            jfkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
        
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Take the final screenshot
        await page.screenshot({ 
          path: 'test/screenshots/jfk-test-passed.png',
          fullPage: false  // Just the viewport with JFK quote visible
        });
        
        console.log('✅ Screenshot saved as: test/screenshots/jfk-test-passed.png');
        break;
      }
      
      // Scroll down a bit
      await page.evaluate(() => {
        const scrollable = document.querySelector('[class*="content"]') || 
                          document.querySelector('[class*="scroll"]') || 
                          document.body;
        scrollable.scrollBy(0, 200);
      });
      
      // Also try pressing Page Down
      await page.keyboard.press('PageDown');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`🔍 Still searching for JFK quote... (attempt ${attempts}/${maxAttempts})`);
      }
    }
    
    if (!jfkFound) {
      console.log('❌ JFK quote not found in the interface');
      console.log('   The quote should be: "And so my fellow Americans, ask not what your country can do for you..."');
      
      // Take a screenshot of current state
      await page.screenshot({ 
        path: 'test/screenshots/jfk-not-found.png',
        fullPage: true
      });
    }
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('TEST SUMMARY:');
    console.log('=' .repeat(60));
    
    if (progressPercentages.length > 0) {
      console.log(`✅ Download progress tracked: ${progressPercentages.join('%, ')}%`);
    } else {
      console.log('❌ No progress percentages captured');
    }
    
    if (modelLoaded) {
      console.log('✅ BASE model loaded successfully');
    } else {
      console.log('❌ BASE model did not load');
    }
    
    if (jfkFound) {
      console.log('✅ JFK quote found and screenshot saved');
      console.log('📸 Final screenshot: test/screenshots/jfk-test-passed.png');
    } else {
      console.log('❌ JFK quote not found');
    }
    
    // List all screenshots created
    console.log('\n📁 Screenshots created in test/screenshots/:');
    const screenshots = fs.readdirSync('test/screenshots').filter(f => f.startsWith('base-') || f.startsWith('jfk-'));
    screenshots.forEach(file => console.log(`   - ${file}`));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ 
      path: 'test/screenshots/error.png',
      fullPage: true 
    });
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
})();