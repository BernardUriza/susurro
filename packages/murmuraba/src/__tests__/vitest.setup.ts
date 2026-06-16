import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { setupAllAudioMocks } from './mocks/webAudioMocks';

console.log('\n🚀 ========== VITEST SETUP STARTING ========== 🚀\n');

// Override XMLHttpRequest to prevent real network requests
if (typeof global !== 'undefined') {
  global.XMLHttpRequest = vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    send: vi.fn(),
    setRequestHeader: vi.fn(),
    getResponseHeader: vi.fn(),
    getAllResponseHeaders: vi.fn(() => ''),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 4,
    status: 200,
    statusText: 'OK',
    responseText: '// Mock RNNoise WASM module',
    response: '// Mock RNNoise WASM module',
    onreadystatechange: null,
    onload: null,
    onerror: null,
    onabort: null,
    onprogress: null,
    ontimeout: null
  })) as any;
}

// Setup DOM environment for React components
if (typeof global.document === 'undefined' || !global.document.body) {
  // Robust DOM mock that handles ALL appendChild scenarios
  const mockElement = () => ({
    click: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    insertBefore: vi.fn(),
    cloneNode: vi.fn(),
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    tagName: 'DIV',
    parentNode: null,
    childNodes: [],
    firstChild: null,
    lastChild: null,
  });

  global.document = {
    createElement: vi.fn(() => mockElement()),
    createTextNode: vi.fn(() => ({ textContent: '', nodeType: 3 })),
    body: mockElement(),
    head: mockElement(),
    documentElement: mockElement(),
    getElementById: vi.fn(() => mockElement()),
    querySelector: vi.fn(() => mockElement()),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createEvent: vi.fn(() => ({
      initEvent: vi.fn(),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })),
  } as any;

  // Ensure window.document exists too
  if (typeof global.window !== 'undefined') {
    global.window.document = global.document;
  }
}

// Setup all Web Audio mocks
setupAllAudioMocks();

// Modern URL mocks
let urlCounter = 0;
global.URL.createObjectURL = vi.fn(() => {
  // Always return consistent format for tests
  return `blob:mock-url-${urlCounter++}`;
});
global.URL.revokeObjectURL = vi.fn();

// Modern Blob mock
class MockBlob extends Blob {
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(1024));
  }
}
global.Blob = MockBlob as any;

// Modern fetch mock for blob operations
global.fetch = vi.fn().mockImplementation((url) => {
  if (url.startsWith('blob:')) {
    return Promise.resolve({
      ok: true,
      blob: vi.fn().mockResolvedValue(new MockBlob(['mock audio data'], { type: 'audio/webm' })),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
  }
  // Mock for RNNoise WASM file
  if (url.includes('/wasm/rnnoise.wasm')) {
    const mockWasm = new ArrayBuffer(8);
    new Uint8Array(mockWasm).set([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    return Promise.resolve({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockWasm),
      headers: new Map([['Content-Length', '8']]),
    });
  }
  return Promise.reject(new Error('Not found'));
});

// Modern performance.memory mock
Object.defineProperty(global.performance, 'memory', {
  value: {
    usedJSHeapSize: 1000000,
    jsHeapSizeLimit: 2000000,
  },
  writable: true,
  configurable: true,
});

// Mock lamejs for MP3 encoding
vi.mock('lamejs', () => ({
  Mp3Encoder: vi.fn().mockImplementation(() => ({
    encodeBuffer: vi.fn().mockReturnValue(new Int8Array(100)),
    flush: vi.fn().mockReturnValue(new Int8Array(50)),
  })),
}));

// Mock @jitsi/rnnoise-wasm module - CRITICAL FIX
vi.mock('@jitsi/rnnoise-wasm', () => ({
  createRNNWasmModule: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      _malloc: vi.fn().mockReturnValue(1000),
      _free: vi.fn(),
      _rnnoise_create: vi.fn().mockReturnValue(12345),
      _rnnoise_destroy: vi.fn(),
      _rnnoise_process_frame: vi.fn().mockReturnValue(0.7),
      HEAPU8: new Uint8Array(10000),
      HEAPF32: new Float32Array(10000),
      HEAP32: new Int32Array(10000)
    });
  })
}));

// Mock RNNoise loader module
vi.mock('../utils/rnnoise-loader', () => ({
  loadRNNoiseModule: vi.fn().mockResolvedValue({
    _rnnoise_create: vi.fn().mockReturnValue(12345),
    _rnnoise_destroy: vi.fn(),
    _rnnoise_process_frame: vi.fn().mockReturnValue(0.5),
    _malloc: vi.fn().mockReturnValue(1000),
    _free: vi.fn(),
    HEAPF32: new Float32Array(10000),
    HEAPU8: new Uint8Array(10000),
    HEAP32: new Int32Array(10000)
  })
}));

// Mock console methods - but allow them in debug mode
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: vi.fn((...args) => {
      // Only show emoji logs
      if (args.some(arg => typeof arg === 'string' && /[\u{1F300}-\u{1F9FF}]/u.test(arg))) {
        console.info(...args);
      }
    }),
    error: vi.fn((...args) => console.info('❌', ...args)),
    warn: vi.fn((...args) => console.info('⚠️', ...args)),
    info: console.info, // Keep info for our logs
    debug: vi.fn(),
  };
}

// Custom matchers for Vitest
import { expect } from 'vitest';

expect.extend({
  toBeValidChunk(received: any) {
    const pass = 
      received &&
      typeof received.id === 'string' &&
      typeof received.startTime === 'number' &&
      typeof received.endTime === 'number' &&
      received.endTime > received.startTime;
    
    return {
      pass,
      message: () => 
        pass
          ? `expected ${received} not to be a valid chunk`
          : `expected ${received} to be a valid chunk with id, startTime, and endTime`,
    };
  },
});

console.log('✅ ========== VITEST SETUP COMPLETE ========== ✅\n');