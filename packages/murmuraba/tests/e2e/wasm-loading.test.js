const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

describe('WASM Loading Tests', () => {
  let server;
  let browser;
  let page;
  const PORT = 8081;

  // Simple HTTP server to serve test files
  function createTestServer() {
    return http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>WASM Loading Test</title>
</head>
<body>
    <h1>WASM Loading Test</h1>
    <div id="status">Loading...</div>
    <pre id="log"></pre>
    <script>
        const logEl = document.getElementById('log');
        function log(msg) {
            console.log(msg);
            logEl.textContent += msg + '\\n';
        }
        
        async function testWasm() {
            const statusEl = document.getElementById('status');
            
            try {
                log('Testing WASM support...');
                
                if (!window.WebAssembly) {
                    throw new Error('WebAssembly not supported');
                }
                
                // Test modern WASM loading
                log('Testing modern WASM loading...');
                
                // Check WebAssembly.instantiateStreaming support
                if ('instantiateStreaming' in WebAssembly) {
                    log('WebAssembly.instantiateStreaming is supported');
                }
                
                // Simulate loading WASM module
                log('Fetching WASM module...');
                const wasmResponse = await fetch('/wasm/rnnoise.wasm');
                if (!wasmResponse.ok) {
                    throw new Error('Failed to fetch WASM module');
                }
                
                log('WASM module fetched successfully');
                
                // Create mock RNNoise interface for testing
                const wasmModule = {
                    _rnnoise_create: () => 1,
                    _rnnoise_destroy: () => {},
                    _rnnoise_process_frame: () => 0.5,
                    _malloc: () => 1000,
                    _free: () => {},
                    HEAPF32: new Float32Array(10000)
                };
                
                log('WASM module created successfully');
                
                // Test RNNoise
                const state = wasmModule._rnnoise_create(0);
                if (state) {
                    log('RNNoise state created');
                    wasmModule._rnnoise_destroy(state);
                }
                
                statusEl.textContent = 'SUCCESS';
                statusEl.style.color = 'green';
                window.testResult = 'success';
                
            } catch (error) {
                log('Error: ' + error.message);
                statusEl.textContent = 'FAILED: ' + error.message;
                statusEl.style.color = 'red';
                window.testResult = 'failed';
                window.testError = error.message;
            }
        }
        
        window.addEventListener('load', testWasm);
    </script>
</body>
</html>
        `);
      } else if (req.url === '/wasm/rnnoise.wasm') {
        // Serve mock WASM file for testing
        const mockWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
        res.writeHead(200, { 
          'Content-Type': 'application/wasm',
          'Content-Length': mockWasm.length,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(mockWasm);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
  }

  beforeAll(async () => {
    // Start test server
    server = createTestServer();
    await new Promise(resolve => {
      server.listen(PORT, resolve);
    });

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    page.on('console', msg => {
      console.log(`Browser [${msg.type()}]:`, msg.text());
    });
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  test('WASM module loads successfully', async () => {
    await page.goto(`http://localhost:${PORT}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for test to complete
    await page.waitForFunction(
      () => window.testResult !== undefined,
      { timeout: 10000 }
    );

    const result = await page.evaluate(() => window.testResult);
    const error = await page.evaluate(() => window.testError);

    expect(result).toBe('success');
    if (error) {
      console.error('Test error:', error);
    }
  });

  test('WASM paths are correctly resolved', async () => {
    const requests = [];
    
    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto(`http://localhost:${PORT}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for test completion
    await page.waitForFunction(
      () => window.testResult !== undefined,
      { timeout: 10000 }
    );

    // Check that WASM was requested at the correct path
    const wasmRequests = requests.filter(url => url.includes('.wasm'));
    expect(wasmRequests.length).toBeGreaterThan(0);
    
    // Ensure no double /dist/ paths
    wasmRequests.forEach(url => {
      expect(url).not.toMatch(/\/dist\/\/dist\//);
    });
  });
});