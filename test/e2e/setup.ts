/**
 * E2E Test Setup Configuration
 * Sets up global configuration for Puppeteer-based E2E tests
 */

import { beforeAll, afterAll } from 'vitest';

// Global test configuration
const E2E_CONFIG = {
  timeout: 60000, // 60 seconds for Whisper model loading
  slowTestThreshold: 30000, // 30 seconds for slow test warning
  retries: 2, // Retry failed tests up to 2 times
  headless: process.env.CI === 'true' || process.env.E2E_HEADLESS === 'true',
  devServerUrl: process.env.E2E_BASE_URL || 'http://localhost:5173'
};

// Extend global configuration
declare global {
  var E2E_CONFIG: typeof E2E_CONFIG;
}

globalThis.E2E_CONFIG = E2E_CONFIG;

// Global setup for all E2E tests
beforeAll(async () => {
  console.log('🚀 E2E Test Suite Starting');
  console.log('Configuration:', E2E_CONFIG);
  
  // Verify dev server is running (optional check)
  if (!process.env.CI) {
    console.log('💡 Tip: Make sure the development server is running at', E2E_CONFIG.devServerUrl);
  }
});

afterAll(async () => {
  console.log('✅ E2E Test Suite Completed');
});