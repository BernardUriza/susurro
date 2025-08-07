#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testInitializationFix() {
  console.log('🚀 Testing Murmuraba initialization fix...');
  
  // Create screenshots directory
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      '--allow-file-access-from-files'
    ],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[${type.toUpperCase()}]`, text);
  });

  page.on('pageerror', err => {
    console.error('Page error:', err.message);
  });

  try {
    console.log('📍 Navigating to http://localhost:3004...');
    await page.goto('http://localhost:3004', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Check if we need to press ENTER to continue (Whisper model selector)
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));

    // Wait for Whisper to load
    console.log('⏳ Waiting for Whisper model to load...');
    await page.waitForSelector('button', { timeout: 60000 });
    
    // Take screenshot after model loads
    await page.screenshot({ 
      path: path.join(screenshotDir, 'initialization-test.png'),
      fullPage: true 
    });
    
    // Check if the button is stuck in INICIALIZANDO_ENGINE_MURMURABA state
    let isStuck = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    while (attempts < maxAttempts) {
      isStuck = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => 
          btn.textContent?.includes('INICIALIZANDO_ENGINE_MURMURABA')
        );
      });

      if (!isStuck) {
        console.log('✅ No stuck initialization button found!');
        break;
      }
      
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts}: Still initializing...`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (isStuck) {
      console.log('❌ Button is still stuck in INICIALIZANDO_ENGINE_MURMURABA state');
      return false;
    }

    // Check for any initialization errors
    const hasErrors = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      return bodyText.includes('ENGINE_ERROR') || 
             bodyText.includes('initialization failed') ||
             bodyText.includes('OFFLINE - CLICK TO INITIALIZE');
    });

    if (hasErrors) {
      console.log('⚠️ Found initialization errors on page');
      const errorText = await page.evaluate(() => document.body.textContent);
      console.log('Page content:', errorText.substring(0, 500) + '...');
    }

    // Check if the engine is successfully initialized
    const isInitialized = await page.evaluate(() => {
      const statusElements = Array.from(document.querySelectorAll('*'));
      return statusElements.some(el => 
        el.textContent?.includes('AUDIO_ENGINE: ONLINE') ||
        el.textContent?.includes('Audio neural processor ready')
      );
    });

    if (isInitialized) {
      console.log('✅ Audio engine appears to be successfully initialized!');
      return true;
    } else {
      console.log('⚠️ Could not confirm audio engine initialization');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

testInitializationFix()
  .then(success => {
    if (success) {
      console.log('🎉 Initialization fix test PASSED!');
      process.exit(0);
    } else {
      console.log('💥 Initialization fix test FAILED!');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Test error:', err);
    process.exit(1);
  });