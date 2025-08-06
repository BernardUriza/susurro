const puppeteer = require('puppeteer');

(async () => {
  console.log('🎬 Capturing Screenshots of Susurro Application\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    // 1. Capture model selector
    console.log('1️⃣ Loading application...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot of model selector
    const hasSelector = await page.evaluate(() => {
      const selector = document.querySelector('[style*="z-index: 9999"]');
      return !!selector;
    });
    
    if (hasSelector) {
      console.log('📸 Taking screenshot of model selector...');
      await page.screenshot({ 
        path: 'test/screenshots/screenshot-1-model-selector.png',
        fullPage: true 
      });
      console.log('   ✅ test/screenshots/screenshot-1-model-selector.png');
      
      // Press arrow down to highlight Base model
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await page.screenshot({ 
        path: 'test/screenshots/screenshot-2-model-selector-base.png',
        fullPage: true 
      });
      console.log('   ✅ test/screenshots/screenshot-2-model-selector-base.png');
      
      // Press arrow down again for Medium model
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await page.screenshot({ 
        path: 'test/screenshots/screenshot-3-model-selector-medium.png',
        fullPage: true 
      });
      console.log('   ✅ test/screenshots/screenshot-3-model-selector-medium.png');
      
      // Go back to Tiny and select it
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Select Tiny model
      console.log('2️⃣ Selecting Tiny model...');
      await page.keyboard.press('Enter');
      
      // Wait for main interface to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('📸 Taking screenshot of main interface...');
      await page.screenshot({ 
        path: 'test/screenshots/screenshot-4-main-interface.png',
        fullPage: true 
      });
      console.log('   ✅ test/screenshots/screenshot-4-main-interface.png');
      
      // Navigate through different views
      console.log('3️⃣ Navigating through views...');
      
      // Press F2 for Audio Fragment Processor
      await page.keyboard.press('F2');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await page.screenshot({ 
        path: 'test/screenshots/screenshot-5-audio-processor.png',
        fullPage: true 
      });
      console.log('   ✅ test/screenshots/screenshot-5-audio-processor.png');
      
      // Press F1 to go back to terminal
      await page.keyboard.press('F1');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if progress logs are visible
      const progressLogs = await page.evaluate(() => {
        const logs = Array.from(document.querySelectorAll('[class*="logEntry"]'));
        return logs.map(el => el.textContent).filter(text => text && text.includes('📥'));
      });
      
      if (progressLogs.length > 0) {
        console.log('\n✅ Download progress logs found:');
        progressLogs.slice(0, 5).forEach(log => console.log(`   - ${log}`));
      }
      
    } else {
      console.log('⚠️ Model selector not visible, taking screenshot of current state...');
      await page.screenshot({ 
        path: 'test/screenshots/screenshot-current-state.png',
        fullPage: true 
      });
      console.log('   ✅ test/screenshots/screenshot-current-state.png');
    }
    
    console.log('\n📊 Screenshot Summary:');
    console.log('   - Model selector states captured');
    console.log('   - Main interface captured');
    console.log('   - Different views captured');
    console.log('   - All screenshots saved in test/screenshots/ folder');
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'test/screenshots/screenshot-error.png',
      fullPage: true 
    });
    console.log('   📸 Error screenshot saved as test/screenshots/screenshot-error.png');
  }
  
  await browser.close();
  console.log('\n✅ Screenshot capture complete!');
})();