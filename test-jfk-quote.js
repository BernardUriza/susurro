const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('🎯 JFK Quote Test\n');
  console.log('Looking for: "And so my fellow Americans, ask not what your country can do for you..."\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    console.log('1️⃣ Loading page...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if model selector is visible
    const hasSelector = await page.evaluate(() => {
      return !!document.querySelector('[style*="z-index: 9999"]');
    });
    
    if (hasSelector) {
      console.log('2️⃣ Model selector found, selecting BASE...');
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('3️⃣ Starting model load...');
      await page.keyboard.press('Enter');
      
      // Wait for model to load (it's cached so should be fast)
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('2️⃣ No model selector (model already loaded)');
    }
    
    console.log('4️⃣ Looking for JFK quote in the interface...\n');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test/screenshots/jfk-initial.png',
      fullPage: true 
    });
    
    // Search for JFK quote in different possible locations
    let jfkFound = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!jfkFound && attempts < maxAttempts) {
      // Check entire page for JFK quote
      const pageContent = await page.evaluate(() => document.body.innerText);
      
      if (pageContent.includes('fellow Americans') || 
          pageContent.includes('ask not what your country')) {
        jfkFound = true;
        console.log('✅ JFK quote FOUND!');
        
        // Try to scroll to the element
        await page.evaluate(() => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            if (node.nodeValue && 
                (node.nodeValue.includes('fellow Americans') || 
                 node.nodeValue.includes('ask not what your country'))) {
              const element = node.parentElement;
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.border = '3px solid #00ff41';
                element.style.boxShadow = '0 0 20px #00ff41';
              }
              break;
            }
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Take screenshot with JFK quote
        await page.screenshot({ 
          path: 'test/screenshots/jfk-test-passed.png',
          fullPage: false 
        });
        
        console.log('📸 Screenshot saved as: test/screenshots/jfk-test-passed.png');
        break;
      }
      
      // Try different things to find the quote
      if (attempts < 5) {
        // Try scrolling the main content area
        await page.evaluate(() => {
          const content = document.querySelector('[class*="content"]') || 
                         document.querySelector('[class*="terminal"]') ||
                         document.querySelector('main') ||
                         document.body;
          content.scrollBy(0, 300);
        });
      } else if (attempts < 10) {
        // Try pressing keys to navigate
        await page.keyboard.press('PageDown');
      } else {
        // Try clicking on different navigation items
        const navButtons = await page.$$('[class*="navButton"]');
        if (navButtons.length > attempts - 10) {
          await navButtons[attempts - 10].click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`🔍 Still searching... (attempt ${attempts}/${maxAttempts})`);
        
        // Check what's currently visible
        const visibleText = await page.evaluate(() => {
          const viewport = {
            top: window.scrollY,
            bottom: window.scrollY + window.innerHeight
          };
          
          const elements = Array.from(document.querySelectorAll('*'));
          const visibleElements = elements.filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
          });
          
          return visibleElements
            .map(el => el.textContent)
            .filter(text => text && text.length > 20)
            .slice(0, 3);
        });
        
        console.log('Currently visible text samples:');
        visibleText.forEach(text => {
          console.log(`  - ${text.substring(0, 60)}...`);
        });
      }
    }
    
    if (!jfkFound) {
      console.log('\n❌ JFK quote NOT FOUND');
      console.log('The quote might not be loaded yet or might be in a different view.');
      
      // Take diagnostic screenshot
      await page.screenshot({ 
        path: 'test/screenshots/jfk-not-found-diagnostic.png',
        fullPage: true 
      });
      
      // Try to get all text content for debugging
      const allText = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*'))
          .map(el => el.textContent)
          .filter(text => text && text.length > 50)
          .slice(0, 10);
      });
      
      console.log('\nSample of text found on page:');
      allText.forEach(text => {
        console.log(`  - ${text.substring(0, 80)}...`);
      });
    }
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('TEST RESULT:');
    console.log('=' .repeat(60));
    
    if (jfkFound) {
      console.log('✅ SUCCESS: JFK quote found and screenshot captured');
      console.log('📸 Screenshot: test/screenshots/jfk-test-passed.png');
    } else {
      console.log('❌ FAILED: JFK quote not found');
      console.log('📸 Diagnostic: test/screenshots/jfk-not-found-diagnostic.png');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ 
      path: 'test/screenshots/jfk-error.png',
      fullPage: true 
    });
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
})();