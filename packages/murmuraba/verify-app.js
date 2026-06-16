#!/usr/bin/env node

/**
 * React App Health Verification Script
 * Run this after fixing main.tsx to verify everything is working
 */

const checks = {
  // 1. Browser Console Checks
  consoleChecks: () => {
    console.log('\n🔍 BROWSER CONSOLE CHECKS:')
    console.log('Look for these in your browser console:')
    console.log('❌ React hook errors (Invalid hook call, Rules of Hooks)')
    console.log('❌ Missing dependencies warnings')
    console.log('❌ Key prop warnings')
    console.log('❌ Unhandled promise rejections')
    console.log('❌ CORS errors')
    console.log('❌ "Cannot read property of undefined"')
    console.log('❌ AudioContext errors')
    console.log('✅ No errors = Good!')
  },

  // 2. Network Tab Checks
  networkChecks: () => {
    console.log('\n🌐 NETWORK TAB CHECKS:')
    console.log('Verify these resources load successfully:')
    console.log('✓ main.js or bundle.js (200 OK)')
    console.log('✓ rnnoise.wasm (200 OK)')
    console.log('✓ CSS files (200 OK)')
    console.log('✓ No 404 errors')
    console.log('✓ No CORS errors on WASM files')
    console.log('✓ Load time < 3 seconds')
  },

  // 3. React DevTools Checks
  devToolsChecks: () => {
    console.log('\n⚛️ REACT DEVTOOLS CHECKS:')
    console.log('In React DevTools, verify:')
    console.log('✓ Component tree renders correctly')
    console.log('✓ No <Suspended> components stuck')
    console.log('✓ Props are passed correctly')
    console.log('✓ State updates work')
    console.log('✓ No excessive re-renders in Profiler')
    console.log('✓ Error boundaries are in place')
  },

  // 4. Functional Checks
  functionalChecks: () => {
    console.log('\n🔧 FUNCTIONAL CHECKS:')
    console.log('Test these features:')
    console.log('✓ Audio engine initializes to "ready" state')
    console.log('✓ File upload/selection works')
    console.log('✓ Audio processing completes without errors')
    console.log('✓ Waveform displays correctly')
    console.log('✓ Playback controls work')
    console.log('✓ Download processed audio works')
  },

  // 5. Performance Checks
  performanceChecks: () => {
    console.log('\n⚡ PERFORMANCE CHECKS:')
    console.log('Run these in browser console:')
    console.log('performance.memory.usedJSHeapSize / 1048576 // MB used')
    console.log('performance.getEntriesByType("navigation")[0].loadEventEnd // Page load time')
    console.log('Check for:')
    console.log('✓ Memory usage < 50MB on idle')
    console.log('✓ No memory leaks after processing')
    console.log('✓ Page loads in < 3 seconds')
    console.log('✓ Smooth UI interactions (60 FPS)')
  },

  // Browser Console Commands
  browserCommands: () => {
    console.log('\n💻 BROWSER CONSOLE COMMANDS:')
    console.log('Copy and run these in your browser console:')
    console.log(`
// Check React version
console.log('React version:', React.version);

// Check for memory leaks
const checkMemory = () => {
  const used = performance.memory.usedJSHeapSize / 1048576;
  console.log(\`Memory used: \${used.toFixed(2)} MB\`);
};
checkMemory();

// Check AudioContext
const checkAudio = () => {
  const ctx = new AudioContext();
  console.log('AudioContext state:', ctx.state);
  console.log('Sample rate:', ctx.sampleRate);
  ctx.close();
};
checkAudio();

// Check for WASM support
console.log('WebAssembly supported:', typeof WebAssembly !== 'undefined');

// List all event listeners
const listeners = getEventListeners(document);
console.log('Document event listeners:', Object.keys(listeners).length);

// Check for React DevTools
console.log('React DevTools installed:', !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__);

// Performance metrics
const perf = performance.getEntriesByType('navigation')[0];
console.log('Page load time:', perf.loadEventEnd - perf.fetchStart, 'ms');
console.log('DOM ready time:', perf.domContentLoadedEventEnd - perf.fetchStart, 'ms');
    `);
  },

  // Quick test script
  quickTest: () => {
    console.log('\n🚀 QUICK TEST SCRIPT:')
    console.log('Run: npm test verify-app-health.test.tsx')
    console.log('This will check:')
    console.log('✓ App renders without crashing')
    console.log('✓ No console errors')
    console.log('✓ Audio engine initializes')
    console.log('✓ WASM loads correctly')
    console.log('✓ No memory leaks')
  }
};

// Run all checks
console.log('🏥 REACT APP HEALTH VERIFICATION CHECKLIST');
console.log('==========================================');

Object.values(checks).forEach(check => check());

console.log('\n📋 MANUAL VERIFICATION STEPS:');
console.log('1. Open your app in browser');
console.log('2. Open DevTools (F12)');
console.log('3. Go through each checklist above');
console.log('4. Run the browser console commands');
console.log('5. Test all functionality');
console.log('6. Run the test suite');

console.log('\n✅ If all checks pass, your React app is healthy!');
console.log('❌ If any checks fail, investigate the specific issue.');