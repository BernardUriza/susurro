const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const LOGS_OUTPUT_FILE = path.join(__dirname, 'browser-logs-capture.json');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
async function ensureScreenshotDir() {
  try {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating screenshot directory:', error);
  }
}

// Wait for server to be ready
async function waitForServer(url, maxAttempts = 30) {
  console.log(`⏳ Waiting for server at ${url}...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Server failed to start within timeout');
}

// Start Next.js server
function startServer() {
  console.log('🚀 Starting Next.js server...');
  
  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.resolve(__dirname, '../../../..'), // Go to project root
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data.toString()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR] ${data.toString()}`);
  });

  return serverProcess;
}

// Main capture function
async function captureBrowserLogs() {
  const logs = {
    console: [],
    errors: [],
    warnings: [],
    network: [],
    performance: [],
    engineStatus: [],
    audioProcessing: []
  };

  let serverProcess = null;
  let browser = null;

  try {
    // Ensure directories exist
    await ensureScreenshotDir();

    // Start server
    serverProcess = startServer();
    await waitForServer(SERVER_URL);

    // Launch Puppeteer
    console.log('🎭 Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Enable coverage collection
    await page.coverage.startJSCoverage();
    await page.coverage.startCSSCoverage();

    // Enable all console types
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location()
      };

      logs.console.push(logEntry);

      // Categorize logs
      if (msg.type() === 'error') {
        logs.errors.push(logEntry);
      } else if (msg.type() === 'warning' || msg.type() === 'warn') {
        logs.warnings.push(logEntry);
      }

      // Extract engine status logs
      if (msg.text().includes('Engine') || msg.text().includes('engine')) {
        logs.engineStatus.push(logEntry);
      }

      // Extract audio processing logs
      if (msg.text().includes('Audio') || msg.text().includes('processing') || 
          msg.text().includes('VAD') || msg.text().includes('RNNoise')) {
        logs.audioProcessing.push(logEntry);
      }

      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
      const errorEntry = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      logs.errors.push(errorEntry);
      console.error('[PAGE ERROR]', error.message);
    });

    // Capture failed requests
    page.on('requestfailed', request => {
      const failureEntry = {
        url: request.url(),
        method: request.method(),
        failure: request.failure(),
        timestamp: new Date().toISOString()
      };
      logs.network.push(failureEntry);
      console.error('[REQUEST FAILED]', request.url(), request.failure());
    });

    // Navigate to the page
    console.log(`📱 Navigating to ${SERVER_URL}...`);
    await page.goto(SERVER_URL, { waitUntil: 'networkidle2' });

    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'initial-load.png'),
      fullPage: true 
    });

    // Wait for AudioDemo to be visible
    console.log('⏳ Waiting for AudioDemo component...');
    await page.waitForSelector('[data-testid="audio-demo"]', { timeout: 30000 });

    // Take screenshot after AudioDemo loads
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'audio-demo-loaded.png'),
      fullPage: true 
    });

    // Wait for engine status
    console.log('⏳ Waiting for engine status...');
    const engineStatusSelector = '[data-testid="engine-status"]';
    await page.waitForSelector(engineStatusSelector, { timeout: 30000 });

    // Get engine status
    const engineStatus = await page.$eval(engineStatusSelector, el => el.textContent);
    console.log(`🔧 Engine Status: ${engineStatus}`);
    logs.engineStatus.push({
      status: engineStatus,
      timestamp: new Date().toISOString()
    });

    // Wait for engine to be ready (with shorter timeout)
    if (engineStatus !== 'ready') {
      console.log('⏳ Waiting for engine to be ready...');
      try {
        await page.waitForFunction(
          () => {
            const statusEl = document.querySelector('[data-testid="engine-status"]');
            return statusEl?.textContent === 'ready';
          },
          { timeout: 30000 }
        );
      } catch (timeoutError) {
        console.log('⚠️ Engine did not reach ready state within timeout');
        console.log('📸 Taking screenshot of current state...');
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, 'engine-timeout-state.png'),
          fullPage: true 
        });
        
        // Try to initialize engine manually
        console.log('🔧 Attempting to initialize engine manually...');
        const initButton = await page.$('button:has-text("Initialize Engine")');
        if (initButton) {
          await initButton.click();
          await page.waitForTimeout(5000); // Wait a bit for initialization
        }
      }
    }

    // Take screenshot when engine is ready
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'engine-ready.png'),
      fullPage: true 
    });

    // Check if auto-processing happens
    console.log('⏳ Waiting for auto-processing...');
    try {
      await page.waitForFunction(
        () => {
          const logs = document.querySelector('[data-testid="audio-logs"]');
          return logs?.textContent?.includes('Procesamiento completado');
        },
        { timeout: 30000 }
      );
      
      console.log('✅ Auto-processing completed!');
      
      // Take screenshot after processing
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'processing-complete.png'),
        fullPage: true 
      });
    } catch (error) {
      console.log('⚠️ Auto-processing did not complete within timeout');
      
      // Try manual processing
      const processButton = await page.$('button:has-text("Probar Audio Demo")');
      if (processButton) {
        console.log('🖱️ Clicking process button...');
        await processButton.click();
        
        // Wait for processing
        await page.waitForFunction(
          () => {
            const logs = document.querySelector('[data-testid="audio-logs"]');
            return logs?.textContent?.includes('Procesamiento completado');
          },
          { timeout: 30000 }
        );
      }
    }

    // Extract logs from the UI
    const uiLogs = await page.$$eval('[data-testid="audio-logs"] > div', elements => 
      elements.map(el => el.textContent)
    );
    
    logs.audioProcessing.push({
      source: 'UI',
      logs: uiLogs,
      timestamp: new Date().toISOString()
    });

    // Measure performance
    const performanceMetrics = await page.metrics();
    logs.performance.push({
      metrics: performanceMetrics,
      timestamp: new Date().toISOString()
    });

    // Get page coverage (if possible)
    const jsCoverage = await page.coverage.stopJSCoverage();
    const cssCoverage = await page.coverage.stopCSSCoverage();
    
    logs.coverage = {
      js: jsCoverage.map(entry => ({
        url: entry.url,
        usedBytes: entry.ranges.reduce((sum, range) => sum + range.end - range.start, 0),
        totalBytes: entry.text.length
      })),
      css: cssCoverage.map(entry => ({
        url: entry.url,
        usedBytes: entry.ranges.reduce((sum, range) => sum + range.end - range.start, 0),
        totalBytes: entry.text.length
      }))
    };

    // Save logs
    console.log('💾 Saving logs...');
    await fs.writeFile(LOGS_OUTPUT_FILE, JSON.stringify(logs, null, 2));
    console.log(`✅ Logs saved to ${LOGS_OUTPUT_FILE}`);

    // Print summary
    console.log('\n📊 CAPTURE SUMMARY:');
    console.log(`- Console logs: ${logs.console.length}`);
    console.log(`- Errors: ${logs.errors.length}`);
    console.log(`- Warnings: ${logs.warnings.length}`);
    console.log(`- Network failures: ${logs.network.length}`);
    console.log(`- Engine status logs: ${logs.engineStatus.length}`);
    console.log(`- Audio processing logs: ${logs.audioProcessing.length}`);
    console.log(`- Screenshots saved to: ${SCREENSHOT_DIR}`);

    if (logs.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      logs.errors.forEach((error, index) => {
        console.log(`\n[Error ${index + 1}]`);
        console.log(error.message || error.text);
      });
    }

  } catch (error) {
    console.error('❌ Capture failed:', error);
    
    // Save partial logs even on error
    try {
      console.log('💾 Saving partial logs...');
      await fs.writeFile(LOGS_OUTPUT_FILE, JSON.stringify(logs, null, 2));
      console.log(`✅ Partial logs saved to ${LOGS_OUTPUT_FILE}`);
    } catch (saveError) {
      console.error('❌ Failed to save partial logs:', saveError);
    }
    
    throw error;
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    
    if (serverProcess) {
      console.log('🛑 Stopping server...');
      serverProcess.kill('SIGTERM');
      
      // Give it time to shutdown gracefully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      try {
        serverProcess.kill('SIGKILL');
      } catch (e) {
        // Process already dead
      }
    }
  }
}

// Run capture
if (require.main === module) {
  captureBrowserLogs()
    .then(() => {
      console.log('✅ Capture completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Capture failed:', error);
      process.exit(1);
    });
}

module.exports = { captureBrowserLogs };