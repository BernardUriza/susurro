const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('🔍 Testing Cache Messages and JFK Transcription\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const logs = [];
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Log cache and model messages
    if (text.includes('caché') || 
        text.includes('Modelo') || 
        text.includes('⚡') ||
        text.includes('Verificando') ||
        text.includes('MURMURABA')) {
      console.log(`[LOG]: ${text}`);
    }
  });
  
  try {
    console.log('1️⃣ Loading page...\n');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if model selector is visible
    const hasSelector = await page.evaluate(() => {
      return !!document.querySelector('[style*="z-index: 9999"]');
    });
    
    if (hasSelector) {
      console.log('2️⃣ Model selector found, selecting BASE...\n');
      
      // Take screenshot of selector
      await page.screenshot({ 
        path: 'test/screenshots/cache-1-selector.png',
        fullPage: false 
      });
      
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('3️⃣ Loading model (should show cache message)...\n');
      await page.keyboard.press('Enter');
      
      // Wait for model to load
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('2️⃣ No model selector (model already loaded)\n');
    }
    
    // Take screenshot of loaded interface
    await page.screenshot({ 
      path: 'test/screenshots/cache-2-loaded.png',
      fullPage: true 
    });
    
    // Check WhisperEchoLogs for cache messages
    console.log('4️⃣ Checking WhisperEchoLogs for messages...\n');
    
    const echoLogs = await page.evaluate(() => {
      const logs = Array.from(document.querySelectorAll('[class*="logEntry"]'));
      return logs.map(el => el.textContent);
    });
    
    console.log(`Found ${echoLogs.length} log entries:\n`);
    
    // Look for cache-related messages
    const cacheMessages = echoLogs.filter(log => 
      log.includes('caché') || 
      log.includes('⚡') || 
      log.includes('Verificando') ||
      log.includes('instantáneo')
    );
    
    if (cacheMessages.length > 0) {
      console.log('✅ Cache messages found:');
      cacheMessages.forEach(msg => console.log(`  - ${msg}`));
    } else {
      console.log('⚠️ No cache messages found in logs');
    }
    
    // Check engine status
    console.log('\n5️⃣ Checking AUDIO_ENGINE status...\n');
    
    const engineStatus = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('span'));
      const engineSpan = elements.find(el => 
        el.textContent && el.textContent.includes('AUDIO_ENGINE')
      );
      return engineSpan ? engineSpan.textContent : null;
    });
    
    if (engineStatus) {
      console.log(`Engine status: ${engineStatus}`);
    } else {
      console.log('⚠️ Engine status not found');
    }
    
    // Try to load JFK audio
    console.log('\n6️⃣ Looking for JFK sample button...\n');
    
    const jfkButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const jfkBtn = buttons.find(btn => 
        btn.textContent && (btn.textContent.includes('JFK') || 
                           btn.textContent.includes('CARGAR') ||
                           btn.textContent.includes('SAMPLE'))
      );
      return jfkBtn ? btn.textContent : null;
    });
    
    if (jfkButton) {
      console.log(`Found button: ${jfkButton}`);
      
      // Click the button to load JFK sample
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const jfkBtn = buttons.find(btn => 
          btn.textContent && (btn.textContent.includes('JFK') || 
                             btn.textContent.includes('CARGAR') ||
                             btn.textContent.includes('SAMPLE'))
        );
        if (jfkBtn) jfkBtn.click();
      });
      
      console.log('Clicked JFK button, waiting for transcription...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot after clicking
      await page.screenshot({ 
        path: 'test/screenshots/cache-3-jfk-clicked.png',
        fullPage: true 
      });
      
      // Look for transcription result
      const transcriptionFound = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('fellow Americans') || 
               text.includes('ask not what your country');
      });
      
      if (transcriptionFound) {
        console.log('✅ JFK transcription found!');
        
        // Take final screenshot
        await page.screenshot({ 
          path: 'test/screenshots/jfk-test-passed.png',
          fullPage: false 
        });
        
        console.log('📸 Screenshot saved as jfk-test-passed.png');
      } else {
        console.log('❌ JFK transcription not found');
      }
    } else {
      console.log('❌ JFK button not found');
    }
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('SUMMARY:');
    console.log('=' .repeat(60));
    
    console.log(`Total logs captured: ${logs.length}`);
    console.log(`Cache messages found: ${cacheMessages.length}`);
    console.log(`Engine status: ${engineStatus || 'Not found'}`);
    console.log(`JFK button: ${jfkButton || 'Not found'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ 
      path: 'test/screenshots/cache-error.png',
      fullPage: true 
    });
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
})();