#!/usr/bin/env node

/**
 * E2E Test Runner Script
 * Ensures development server is running and executes E2E tests
 */

const { spawn, exec } = require('child_process');
const http = require('http');

const DEV_SERVER_URL = 'http://localhost:5173';
const MAX_WAIT_TIME = 30000; // 30 seconds to wait for dev server

/**
 * Check if development server is running
 */
function checkDevServer() {
  return new Promise((resolve) => {
    const req = http.get(DEV_SERVER_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for development server to be ready
 */
async function waitForDevServer(maxWaitTime = MAX_WAIT_TIME) {
  const startTime = Date.now();
  
  console.log('🔍 Checking if development server is running...');
  
  while (Date.now() - startTime < maxWaitTime) {
    const isRunning = await checkDevServer();
    
    if (isRunning) {
      console.log('✅ Development server is ready');
      return true;
    }
    
    console.log('⏳ Waiting for development server...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return false;
}

/**
 * Run E2E tests
 */
function runE2ETests() {
  return new Promise((resolve, reject) => {
    console.log('🧪 Starting E2E tests...');
    
    const testProcess = spawn('npx', [
      'vitest', 
      'run', 
      'test/e2e/whisper-pipeline.test.ts',
      '--reporter=verbose'
    ], {
      stdio: 'inherit',
      shell: true
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ E2E tests completed successfully!');
        resolve();
      } else {
        console.error(`❌ E2E tests failed with code ${code}`);
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });
    
    testProcess.on('error', (error) => {
      console.error('❌ Failed to start E2E tests:', error);
      reject(error);
    });
  });
}

/**
 * Start development server
 */
function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting development server...');
    
    const devProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true,
      detached: true
    });
    
    let output = '';
    
    devProcess.stdout.on('data', (data) => {
      output += data.toString();
      
      // Check if server is ready
      if (output.includes('Local:') || output.includes('localhost:5173')) {
        console.log('✅ Development server started');
        resolve(devProcess);
      }
    });
    
    devProcess.stderr.on('data', (data) => {
      console.error('Dev server error:', data.toString());
    });
    
    devProcess.on('error', (error) => {
      console.error('❌ Failed to start development server:', error);
      reject(error);
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Development server startup timeout'));
    }, 30000);
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🎬 Starting E2E Test Runner');
    
    // Check if dev server is already running
    const isDevServerRunning = await checkDevServer();
    
    let devServerProcess = null;
    
    if (!isDevServerRunning) {
      console.log('📡 Development server not detected, starting one...');
      
      try {
        devServerProcess = await startDevServer();
        
        // Wait for server to be fully ready
        await waitForDevServer();
      } catch (error) {
        console.error('❌ Failed to start development server:', error.message);
        console.log('💡 Please manually start the dev server with: npm run dev');
        process.exit(1);
      }
    }
    
    // Run the E2E tests
    try {
      await runE2ETests();
    } catch (error) {
      console.error('❌ E2E tests failed:', error.message);
      process.exit(1);
    }
    
    // Clean up dev server if we started it
    if (devServerProcess) {
      console.log('🧹 Cleaning up development server...');
      devServerProcess.kill('SIGTERM');
    }
    
    console.log('🎉 E2E test run completed successfully!');
    
  } catch (error) {
    console.error('❌ E2E test runner failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 E2E test runner interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 E2E test runner terminated');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}