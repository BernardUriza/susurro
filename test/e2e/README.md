# Whisper Pipeline E2E Tests

This directory contains comprehensive end-to-end tests for the Whisper pipeline implementation, validating the complete workflow from application launch to transcription completion.

## Test Coverage

The E2E tests validate:

### 🚀 Application Launch and Initialization
- Application loads successfully
- Matrix navigation interface displays
- Critical components render without errors

### 🤖 Whisper Model Loading
- Model loading initiates automatically
- Progress messages appear with percentages
- Model completes loading within 30 seconds
- No critical errors during loading process

### 👷 Worker-Based Implementation
- Web Worker initializes successfully
- Worker communication functions correctly
- No worker-related errors occur

### 🎙️ Audio Processing and Transcription
- File upload functionality works
- Sample audio file processing
- Transcription completes without critical errors
- Audio format validation

### 📊 WhisperEchoLog Component
- Component displays correctly
- Log messages are captured and shown
- Different log types (info, success, warning, error) work
- Auto-scroll functionality

### 🔍 Console Log and Error Validation
- No critical JavaScript errors
- Appropriate informational messages
- Error filtering (ignores non-critical like favicon 404s)

### ⚡ Performance Validation
- Model loads within timeout constraints
- Memory usage stays reasonable
- No resource leaks detected

## Running the Tests

### Prerequisites

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   The server should be running at `http://localhost:5173`

3. **Verify sample audio file exists**:
   ```bash
   ls -la public/sample.wav
   ```

### Run E2E Tests

**Run all E2E tests**:
```bash
npm run test:e2e
```

**Run specific Whisper pipeline test**:
```bash
npm run test:e2e:puppeteer
# or
npx vitest run test/e2e/whisper-pipeline.test.ts
```

**Run E2E tests in headed mode (see browser)**:
```bash
E2E_HEADLESS=false npx vitest run test/e2e/whisper-pipeline.test.ts
```

**Run with custom dev server URL**:
```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

### Debug Mode

For debugging failing tests:

```bash
# Run with verbose output
npx vitest run test/e2e/whisper-pipeline.test.ts --reporter=verbose

# Run single test with browser visible
E2E_HEADLESS=false npx vitest run test/e2e/whisper-pipeline.test.ts -t "should start loading Whisper model"
```

## Test Architecture

### Helper Utilities

**`WhisperEchoLogsHelper`** (`helpers/whisper-echo-logs.helper.ts`):
- Captures WhisperEchoLog messages from the page
- Monitors console output and errors
- Provides utilities to wait for specific log messages
- Extracts progress percentages from log messages
- Validates model loading completion

### Key Features

1. **Log Capture**: Intercepts both DOM-based logs and console messages
2. **Progress Tracking**: Monitors model loading progress with percentage extraction
3. **Error Detection**: Filters and categorizes errors by severity
4. **Timeout Management**: Reasonable timeouts for model loading (30s) and operations
5. **Resource Validation**: Checks memory usage and prevents leaks

### Test Structure

```
test/e2e/
├── helpers/
│   ├── index.ts                     # Helper exports
│   └── whisper-echo-logs.helper.ts  # WhisperEchoLog capture utility
├── setup.ts                        # Global E2E test configuration  
├── whisper-pipeline.test.ts         # Main comprehensive test suite
└── README.md                       # This file
```

## Troubleshooting

### Common Issues

1. **"Dev server not running"**:
   - Make sure `npm run dev` is running
   - Check that port 5173 is available
   - Try: `npm run dev:simple` for basic Vite server

2. **"Model loading timeout"**:
   - Whisper model download may be slow on first run
   - Check network connection
   - Models are cached after first download

3. **"Sample audio file not found"**:
   - Verify `public/sample.wav` exists
   - Check file permissions

4. **Browser launch errors**:
   - Install Chrome/Chromium if missing
   - On CI: Use `--no-sandbox` flag (already configured)
   - Try headed mode: `E2E_HEADLESS=false`

### Expected Test Duration

- **First run**: 45-60 seconds (includes model download)
- **Subsequent runs**: 20-30 seconds (model cached)
- **CI environment**: May take longer due to resource constraints

### Environment Variables

- `E2E_HEADLESS`: Set to `false` to see browser during tests
- `E2E_BASE_URL`: Custom development server URL
- `CI`: Automatically detected, enables headless mode

## Test Data

The tests use:
- **Sample audio**: `public/sample.wav` (included in repository)
- **Model**: Whisper Tiny (downloaded automatically to `public/models/`)
- **Browser**: Chromium (installed via Puppeteer)

## Continuous Integration

These tests are designed to work in CI environments:
- Headless mode by default
- Appropriate timeouts for slower CI
- Memory usage monitoring
- Resource cleanup

Example CI configuration:
```yaml
- name: Run E2E Tests
  run: |
    npm install
    npm run build
    npm run preview &
    sleep 5
    npm run test:e2e
```

## Contributing

When adding new E2E tests:

1. Use the `WhisperEchoLogsHelper` for log capture
2. Set appropriate timeouts (model loading can take 30s)
3. Add proper cleanup in `afterAll`
4. Filter non-critical errors (favicon, manifest, etc.)
5. Test both success and error scenarios
6. Document any new test requirements

## Performance Benchmarks

Expected performance on standard hardware:
- **Model loading**: < 30 seconds
- **File transcription**: < 10 seconds
- **Memory usage**: < 100MB
- **Test execution**: < 60 seconds total