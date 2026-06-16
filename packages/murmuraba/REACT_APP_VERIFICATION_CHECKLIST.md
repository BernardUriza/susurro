# React App Verification Checklist

After fixing `main.tsx`, use this checklist to verify your React application is working correctly.

## 1. Browser Console Checks ❌

Open DevTools (F12) and check the Console tab for:

### Critical React Errors
- [ ] No "Invalid hook call" errors
- [ ] No "Cannot read properties of undefined" errors  
- [ ] No "Maximum update depth exceeded" errors
- [ ] No "Each child in a list should have a unique key" warnings
- [ ] No "Cannot update component while rendering" errors

### Murmuraba-Specific Errors
- [ ] No "Engine not ready" errors
- [ ] No "Failed to load WASM module" errors
- [ ] No "AudioContext was not allowed to start" errors
- [ ] No "Failed to create AudioWorkletNode" errors

### Run These Commands in Console:
```javascript
// Check React version
React.version

// Check for memory usage
performance.memory.usedJSHeapSize / 1048576 + ' MB'

// Check AudioContext state
new AudioContext().state

// Check WASM support
typeof WebAssembly

// Check React DevTools
!!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
```

## 2. Network Tab Checks 🌐

Open Network tab and reload the page:

- [ ] `main.js` or `bundle.js` loads (200 OK)
- [ ] `rnnoise.wasm` loads (200 OK) 
- [ ] `audio-worklet-processor.js` loads if using worklets (200 OK)
- [ ] No 404 errors for chunks or resources
- [ ] No CORS errors on WASM files
- [ ] Total page load < 3 seconds
- [ ] All fonts and CSS load correctly

## 3. React Developer Tools Checks ⚛️

Install React DevTools extension and check:

### Components Tab
- [ ] Component tree renders without errors
- [ ] ErrorBoundary is wrapping your app
- [ ] No components stuck in <Suspense>
- [ ] Props are being passed correctly
- [ ] State values are not unexpectedly undefined/null

### Profiler Tab  
- [ ] No components rendering > 16ms repeatedly
- [ ] No excessive re-renders (> 5 per interaction)
- [ ] Initial mount time < 100ms
- [ ] Interactions respond < 100ms

### Murmuraba Components Should Show:
- [ ] AudioPlayer with correct engineStatus
- [ ] WaveformAnalyzer with valid audioBuffer
- [ ] ChunkProcessingResults displaying metrics
- [ ] BuildInfo showing version information

## 4. Functional Tests 🔧

Test these features manually:

### Audio Engine
- [ ] Engine initializes from "uninitialized" → "initializing" → "ready"
- [ ] Status indicator shows correct state
- [ ] No errors during initialization

### File Processing
- [ ] File upload/selection works
- [ ] Process button enables when file selected
- [ ] Processing shows progress indicator
- [ ] Processing completes without errors
- [ ] Results display correctly

### Audio Playback
- [ ] Play/pause controls work
- [ ] Seek bar updates during playback  
- [ ] Volume control works
- [ ] Download processed audio works

### UI Components
- [ ] Waveform displays correctly
- [ ] Timeline shows VAD results
- [ ] Metrics panel shows data
- [ ] All tooltips appear on hover

## 5. Performance Checks ⚡

### Memory Usage
- [ ] Initial load < 50MB
- [ ] After processing < 100MB
- [ ] No gradual memory increase (leak)
- [ ] Memory freed after component unmount

### Rendering Performance
- [ ] 60 FPS during interactions
- [ ] No jank during scrolling
- [ ] Smooth waveform rendering
- [ ] Responsive button clicks

## 6. Automated Tests 🧪

Run these test commands:

```bash
# Run health verification tests
npm test verify-app-health.test.tsx

# Run integration tests
npm test example-app-test.tsx

# Run with coverage
npm run test:coverage

# Check coverage report
npm run quality:gate
```

Expected results:
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] No console errors in tests
- [ ] Integration tests complete < 30s

## 7. Cross-Browser Testing 🌍

Test in multiple browsers:

### Chrome/Edge
- [ ] AudioWorklet functions correctly
- [ ] WASM loads without issues
- [ ] Performance is optimal

### Firefox
- [ ] AudioWorklet fallback works
- [ ] No console errors
- [ ] UI renders correctly

### Safari
- [ ] AudioContext handling works
- [ ] No autoplay policy issues
- [ ] Touch interactions work (iOS)

## 8. Error Recovery 🛡️

Test error scenarios:

- [ ] Network failure during WASM load shows error
- [ ] Invalid audio file shows user-friendly error
- [ ] Processing failure allows retry
- [ ] ErrorBoundary catches component errors
- [ ] Browser back/forward navigation works

## Quick Verification Script

Run this Node.js script for a summary:
```bash
node verify-app.js
```

## Troubleshooting Common Issues

### "Cannot find module" errors
- Check import paths in main.tsx
- Verify tsconfig.json paths
- Check package.json dependencies

### WASM loading fails
- Check publicPath in webpack/vite config
- Verify rnnoise.wasm is copied to dist
- Check CORS headers if served from CDN

### AudioContext issues  
- Add user interaction before creating context
- Handle suspended state with resume()
- Check browser autoplay policies

### React 19 specific issues
- Ensure all deps support React 19
- Check for deprecated lifecycle methods
- Verify Suspense boundaries

## Success Criteria ✅

Your app is healthy when:
- No console errors or warnings
- All network resources load successfully  
- React DevTools shows clean component tree
- All features work as expected
- Performance metrics are within limits
- Tests pass with good coverage

If all checks pass, your React application is successfully verified! 🎉