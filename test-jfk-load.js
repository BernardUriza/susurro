const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testJFKLoad() {
  console.log('🚀 Starting JFK load test...');
  
  // Create screenshots directory
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: 'new', // Use headless mode
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
    console.log('📍 Navigating to http://localhost:3002...');
    await page.goto('http://localhost:3002', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, '01-initial-load.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot saved: 01-initial-load.png');

    // Check if we need to press ENTER to continue (Whisper model selector)
    const needsEnter = await page.evaluate(() => {
      const element = document.body.textContent || '';
      return element.includes('Press ENTER to continue') || element.includes('WHISPER MODEL SELECTOR');
    });

    if (needsEnter) {
      console.log('🔑 Found model selector, pressing ENTER to continue...');
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 2000)); // Wait for model loading to start
    }

    // Wait for Whisper to load (check for ready status)
    console.log('⏳ Waiting for Whisper model to load...');
    let modelReady = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes

    while (!modelReady && attempts < maxAttempts) {
      modelReady = await page.evaluate(() => {
        const statusElement = document.querySelector('[data-testid="whisper-status"]');
        const logContent = document.querySelector('.whitespace-pre-wrap');
        const bodyText = document.body.textContent || '';
        
        // Check status element
        if (statusElement) {
          return statusElement.textContent?.includes('ready') || 
                 statusElement.textContent?.includes('Listo');
        }
        
        // Check log content
        if (logContent) {
          const text = logContent.textContent || '';
          return text.includes('Modelo listo') || 
                 text.includes('Model ready') ||
                 text.includes('✅') ||
                 text.includes('Modelo cargado') ||
                 text.includes('Model loaded');
        }
        
        // Check for interface elements that appear after model loads
        const fileInput = document.querySelector('input[type="file"]');
        const buttons = document.querySelectorAll('button');
        const hasJFKButton = Array.from(buttons).some(btn => 
          btn.textContent?.includes('JFK') || 
          btn.textContent?.includes('Cargar') ||
          btn.textContent?.includes('Load')
        );
        
        // If we no longer see the model selector, assume it's ready
        const noModelSelector = !bodyText.includes('WHISPER MODEL SELECTOR') && 
                               !bodyText.includes('Press ENTER to continue');
        
        return (fileInput && hasJFKButton) || noModelSelector;
      });

      if (!modelReady) {
        attempts++;
        console.log(`  Attempt ${attempts}/${maxAttempts}: Model still loading...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (modelReady) {
      console.log('✅ Whisper model is ready!');
    } else {
      console.log('⚠️ Model loading timeout - continuing anyway');
    }

    // Wait for Audio Engine (Murmuraba) to initialize
    console.log('⏳ Waiting for Audio Engine to initialize...');
    let audioEngineReady = false;
    let audioAttempts = 0;
    const maxAudioAttempts = 60; // 1 minute

    while (!audioEngineReady && audioAttempts < maxAudioAttempts) {
      audioEngineReady = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const initializingButton = buttons.find(btn => 
          btn.textContent?.includes('INICIALIZANDO_ENGINE_MURMURABA')
        );
        
        // If no initializing button found, the engine should be ready
        return !initializingButton;
      });

      if (!audioEngineReady) {
        audioAttempts++;
        console.log(`  Attempt ${audioAttempts}/${maxAudioAttempts}: Audio engine still initializing...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (audioEngineReady) {
      console.log('✅ Audio engine is ready!');
    } else {
      console.log('⚠️ Audio engine initialization timeout - continuing anyway');
    }

    // Take screenshot after model loads
    await page.screenshot({ 
      path: path.join(screenshotDir, '02-model-loaded.png'),
      fullPage: true 
    });
    console.log('📸 Screenshot saved: 02-model-loaded.png');

    // Scroll to see the terminal and buttons
    console.log('📜 Scrolling to view terminal and buttons...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });

    await new Promise(r => setTimeout(r, 1000));

    // Take screenshot of scrolled view
    await page.screenshot({ 
      path: path.join(screenshotDir, '03-scrolled-view.png'),
      fullPage: false 
    });
    console.log('📸 Screenshot saved: 03-scrolled-view.png');

    // Look for the JFK button
    console.log('🔍 Looking for JFK sample button...');
    
    // Try multiple selectors for the JFK button
    const jfkSelectors = [
      'button:has-text("JFK")',
      'button:has-text("Cargar JFK")',
      'button:has-text("Load JFK")',
      '[data-testid="load-jfk"]',
      'button[title*="JFK"]',
      'button[aria-label*="JFK"]',
      // Generic button that might contain JFK
      'button'
    ];

    let jfkButton = null;
    for (const selector of jfkSelectors) {
      try {
        // Use XPath for text search as it's more reliable
        if (selector === 'button') {
          const buttons = await page.$$('button');
          for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent);
            if (text && text.includes('JFK')) {
              jfkButton = btn;
              console.log(`✅ Found JFK button with text: "${text}"`);
              break;
            }
          }
        } else if (selector.includes(':has-text')) {
          const searchText = selector.match(/:has-text\("(.+)"\)/)?.[1];
          if (searchText) {
            jfkButton = await page.$(`xpath=//button[contains(text(), "${searchText}")]`);
          }
        } else {
          jfkButton = await page.$(selector);
        }
        
        if (jfkButton) {
          console.log(`✅ Found JFK button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (jfkButton) {
      console.log('🖱️ Clicking JFK button...');
      
      // Scroll button into view
      await jfkButton.scrollIntoView();
      await new Promise(r => setTimeout(r, 500));
      
      // Click the button
      await jfkButton.click();
      console.log('✅ JFK button clicked!');
      
      // Wait for processing
      await new Promise(r => setTimeout(r, 3000));
      
      // Take screenshot after clicking
      await page.screenshot({ 
        path: path.join(screenshotDir, '04-jfk-clicked.png'),
        fullPage: true 
      });
      console.log('📸 Screenshot saved: 04-jfk-clicked.png');
      
      // Check for error messages
      const errorText = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('[role="alert"], .error, .text-red-500');
        for (const el of errorElements) {
          if (el.textContent) return el.textContent;
        }
        return null;
      });
      
      if (errorText) {
        console.error('❌ Error found:', errorText);
        
        // Take error screenshot
        await page.screenshot({ 
          path: path.join(screenshotDir, '05-error-state.png'),
          fullPage: true 
        });
        console.log('📸 Screenshot saved: 05-error-state.png');
      } else {
        console.log('✅ No errors detected after loading JFK sample');
        
        // Wait for transcription
        console.log('⏳ Waiting for transcription...');
        await new Promise(r => setTimeout(r, 5000));
        
        // Take final screenshot
        await page.screenshot({ 
          path: path.join(screenshotDir, '05-final-state.png'),
          fullPage: true 
        });
        console.log('📸 Screenshot saved: 05-final-state.png');
      }
    } else {
      console.log('❌ JFK button not found!');
      
      // Take screenshot of current state
      await page.screenshot({ 
        path: path.join(screenshotDir, '04-no-jfk-button.png'),
        fullPage: true 
      });
      console.log('📸 Screenshot saved: 04-no-jfk-button.png');
      
      // List all buttons found
      const buttons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.map(b => ({
          text: b.textContent?.trim(),
          className: b.className,
          id: b.id,
          ariaLabel: b.getAttribute('aria-label')
        }));
      });
      
      console.log('📋 Buttons found on page:');
      buttons.forEach((btn, i) => {
        console.log(`  ${i + 1}. Text: "${btn.text}", Class: "${btn.className}", ID: "${btn.id}", Aria: "${btn.ariaLabel}"`);
      });
    }

    // Get final console logs
    const logs = await page.evaluate(() => {
      const logElement = document.querySelector('.whitespace-pre-wrap');
      return logElement ? logElement.textContent : 'No logs found';
    });
    
    console.log('\n📝 Final WhisperEchoLog content:');
    console.log(logs);

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error-screenshot.png'),
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
  }

  console.log('\n✅ Test completed. Check test-screenshots folder for results.');
  
  // Close browser
  await browser.close();
}

// Run the test
testJFKLoad().catch(console.error);