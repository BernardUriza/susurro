const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Testing Model Download Progress...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const logs = [];
  
  // Capturar TODOS los logs de consola
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Mostrar logs relevantes
    if (text.includes('MATRIX_NAVIGATION_LOG') || 
        text.includes('Descargando') || 
        text.includes('📥') ||
        text.includes('progress') ||
        text.includes('Progress') ||
        text.includes('%')) {
      console.log(`[BROWSER]: ${text}`);
    }
  });
  
  // Capturar errores
  page.on('pageerror', error => {
    console.error(`[ERROR]: ${error.message}`);
  });
  
  try {
    console.log('1️⃣ Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('2️⃣ Waiting for selector to appear...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar si el selector está visible
    const hasSelector = await page.evaluate(() => {
      const selector = document.querySelector('[style*="z-index: 9999"]');
      return !!selector;
    });
    
    if (hasSelector) {
      console.log('✅ Model selector found!\n');
      
      // Seleccionar modelo Tiny (presionar Enter)
      console.log('3️⃣ Selecting Tiny model...');
      await page.keyboard.press('Enter');
      
      console.log('4️⃣ Waiting for model to start downloading...\n');
      console.log('=' .repeat(50));
      console.log('MONITORING DOWNLOAD PROGRESS:');
      console.log('=' .repeat(50));
      
      // Monitorear por 30 segundos
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Buscar elementos con progreso en el DOM
        const progressInfo = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const progressTexts = elements
            .map(el => el.textContent)
            .filter(text => text && (text.includes('%') || text.includes('Descargando')))
            .slice(0, 5);
          return progressTexts;
        });
        
        if (progressInfo.length > 0) {
          console.log(`\n[${i}s] Progress found in DOM:`);
          progressInfo.forEach(text => console.log(`  - ${text}`));
        }
      }
      
    } else {
      console.log('❌ Model selector NOT found');
      
      // Buscar si el modelo ya está cargándose
      const modelLoading = logs.some(log => 
        log.includes('Cargando modelo') || 
        log.includes('Iniciando carga')
      );
      
      if (modelLoading) {
        console.log('ℹ️ Model is already loading (no selector shown)');
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('FINAL LOG ANALYSIS:');
    console.log('=' .repeat(50));
    
    // Analizar logs
    const progressLogs = logs.filter(log => 
      log.includes('%') || 
      log.includes('progress') || 
      log.includes('Descargando')
    );
    
    console.log(`Total logs captured: ${logs.length}`);
    console.log(`Progress-related logs: ${progressLogs.length}`);
    
    if (progressLogs.length > 0) {
      console.log('\nProgress logs found:');
      progressLogs.slice(0, 10).forEach(log => console.log(`  - ${log}`));
    } else {
      console.log('\n⚠️ NO PROGRESS LOGS FOUND!');
      console.log('This means the download progress is not being displayed.');
    }
    
    // Tomar screenshot final
    await page.screenshot({ 
      path: 'test-progress-result.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as test-progress-result.png');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
  
  await browser.close();
  console.log('\n✅ Test complete');
})();