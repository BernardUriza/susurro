/**
 * E2E Test for Whisper Pipeline with Worker
 * Tests the live application at http://localhost:3002
 * Captures WhisperEchoLog messages and takes screenshot
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

describe('Whisper Pipeline E2E Test', () => {
  let browser: Browser;
  let page: Page;
  const whisperLogs: string[] = [];
  const consoleLogs: string[] = [];

  beforeAll(async () => {
    console.log('🚀 Starting E2E test for Whisper Pipeline...');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode for better compatibility
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      defaultViewport: { width: 1280, height: 800 }
    });
    
    page = await browser.newPage();
    
    // Capture console logs
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER CONSOLE]: ${text}`);
      
      // Capture worker progress
      if (text.includes('[WORKER_PROGRESS]')) {
        console.log(`📊 Progress: ${text}`);
      }
    });
    
    // Capture page errors
    page.on('pageerror', (error) => {
      console.error(`[PAGE ERROR]: ${error.message}`);
    });
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('should load the application and initialize Whisper worker', async () => {
    console.log('📍 Navigating to http://localhost:3002...');
    
    // Navigate to the app
    await page.goto('http://localhost:3002', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded');
    
    // Wait for initial render
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test/e2e/screenshots/01-initial-load.png',
      fullPage: true 
    });
    console.log('📸 Screenshot: Initial load');
  }, 60000);

  it('should capture WhisperEchoLog messages during model loading', async () => {
    console.log('🔍 Looking for WhisperEchoLog messages...');
    
    // Function to extract logs from WhisperEchoLog component
    const extractWhisperLogs = await page.evaluate(() => {
      const logElements = document.querySelectorAll('[class*="whisper-echo-logs"] [class*="log-entry"], [class*="echo-log"] [class*="message"]');
      const logs: string[] = [];
      
      logElements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text) {
          logs.push(text);
        }
      });
      
      // Also try to get logs from the status bar area
      const statusBarLogs = document.querySelector('[class*="statusBar"] [class*="whisperLogs"], [class*="whisperEchoLogs"]');
      if (statusBarLogs) {
        const messages = statusBarLogs.querySelectorAll('[class*="message"], [class*="log"]');
        messages.forEach((msg) => {
          const text = msg.textContent?.trim();
          if (text) logs.push(text);
        });
      }
      
      return logs;
    });
    
    whisperLogs.push(...extractWhisperLogs);
    console.log('📝 WhisperEchoLog messages captured:', whisperLogs);
    
    // Print each log for visibility
    whisperLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
  }, 30000);

  it('should wait for Whisper model to load completely', async () => {
    console.log('⏳ Waiting for Whisper model to load...');
    
    let modelLoaded = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max
    
    while (!modelLoaded && attempts < maxAttempts) {
      attempts++;
      
      // Check console logs for model ready message
      const hasModelReady = consoleLogs.some(log => 
        log.includes('Modelo listo') || 
        log.includes('Model loaded') ||
        log.includes('ready for transcription') ||
        log.includes('100%')
      );
      
      // Check page for ready indicators
      const pageReady = await page.evaluate(() => {
        // Check for any ready indicators in the DOM
        const readyTexts = ['✅', 'Listo', 'Ready', '100%', 'Modelo cargado'];
        const pageText = document.body.innerText;
        return readyTexts.some(text => pageText.includes(text));
      });
      
      modelLoaded = hasModelReady || pageReady;
      
      if (!modelLoaded) {
        console.log(`  Attempt ${attempts}/${maxAttempts}: Model still loading...`);
        
        // Capture current logs
        const currentLogs = await page.evaluate(() => {
          const logs = Array.from(document.querySelectorAll('[class*="log"], [class*="message"]'))
            .map(el => el.textContent?.trim())
            .filter(Boolean)
            .slice(-5); // Last 5 logs
          return logs;
        });
        
        if (currentLogs.length > 0) {
          console.log('  Recent logs:', currentLogs);
        }
        
        await page.waitForTimeout(1000);
      }
    }
    
    if (modelLoaded) {
      console.log('✅ Whisper model loaded successfully!');
      
      // Take screenshot of loaded state
      await page.screenshot({ 
        path: 'test/e2e/screenshots/02-model-loaded.png',
        fullPage: true 
      });
      console.log('📸 Screenshot: Model loaded');
    } else {
      console.log('⚠️ Model loading timeout - capturing current state');
      
      // Take screenshot of timeout state
      await page.screenshot({ 
        path: 'test/e2e/screenshots/02-model-timeout.png',
        fullPage: true 
      });
    }
    
    expect(modelLoaded).toBe(true);
  }, 90000);

  it('should display progress percentages during loading', async () => {
    console.log('📊 Checking for progress percentages...');
    
    // Check console logs for progress
    const progressLogs = consoleLogs.filter(log => 
      log.includes('%') || 
      log.includes('progress') || 
      log.includes('Progress')
    );
    
    console.log('Progress logs found:', progressLogs.length);
    progressLogs.forEach(log => {
      console.log(`  - ${log}`);
    });
    
    // Extract percentages
    const percentages = progressLogs
      .map(log => {
        const match = log.match(/(\d+)%/);
        return match ? parseInt(match[1]) : null;
      })
      .filter(Boolean) as number[];
    
    console.log('Percentages detected:', percentages);
    
    // Verify we have some progress indication
    expect(progressLogs.length).toBeGreaterThan(0);
  }, 30000);

  it('should test transcription with sample audio', async () => {
    console.log('🎤 Testing transcription...');
    
    // Check if there's a file input or button to trigger transcription
    const hasFileInput = await page.evaluate(() => {
      return !!document.querySelector('input[type="file"]');
    });
    
    if (hasFileInput) {
      console.log('📁 File input found, uploading sample.wav...');
      
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        const samplePath = path.join(process.cwd(), 'public', 'sample.wav');
        if (fs.existsSync(samplePath)) {
          await fileInput.uploadFile(samplePath);
          console.log('✅ Sample file uploaded');
          
          // Wait for transcription
          await page.waitForTimeout(5000);
          
          // Take screenshot of transcription
          await page.screenshot({ 
            path: 'test/e2e/screenshots/03-transcription.png',
            fullPage: true 
          });
          console.log('📸 Screenshot: Transcription result');
        } else {
          console.log('⚠️ sample.wav not found at:', samplePath);
        }
      }
    } else {
      console.log('ℹ️ No file input found - checking for record button');
      
      // Look for record button
      const recordButton = await page.$('button[class*="record"], button[aria-label*="record"], button:has-text("Record")');
      if (recordButton) {
        console.log('🎙️ Record button found');
        await page.screenshot({ 
          path: 'test/e2e/screenshots/03-record-button.png',
          fullPage: true 
        });
      }
    }
  }, 30000);

  it('should capture final state and all logs', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL TEST SUMMARY');
    console.log('='.repeat(60));
    
    // Get final WhisperEchoLog state
    const finalLogs = await page.evaluate(() => {
      const container = document.querySelector('[class*="whisperLogs"], [class*="whisperEcho"], [class*="statusBar"]');
      if (container) {
        const logs = Array.from(container.querySelectorAll('[class*="log"], [class*="message"]'))
          .map(el => el.textContent?.trim())
          .filter(Boolean);
        return logs;
      }
      return [];
    });
    
    console.log('\n📝 WhisperEchoLog Final Messages:');
    finalLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log}`);
    });
    
    console.log('\n🖥️ Console Log Summary:');
    console.log(`  Total logs: ${consoleLogs.length}`);
    console.log(`  Errors: ${consoleLogs.filter(l => l.includes('error') || l.includes('Error')).length}`);
    console.log(`  Warnings: ${consoleLogs.filter(l => l.includes('warn') || l.includes('Warning')).length}`);
    console.log(`  Worker messages: ${consoleLogs.filter(l => l.includes('[Worker]')).length}`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test/e2e/screenshots/04-final-state.png',
      fullPage: true 
    });
    console.log('\n📸 Final screenshot saved');
    
    console.log('\n✅ E2E Test completed!');
    console.log('Screenshots saved in: test/e2e/screenshots/');
    console.log('='.repeat(60));
  }, 30000);
});