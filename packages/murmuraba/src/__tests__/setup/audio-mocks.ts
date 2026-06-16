import { vi } from 'vitest';

// Mock WASM Module
export const mockWasmModule = {
  _rnnoise_create: vi.fn().mockReturnValue(123),
  _rnnoise_destroy: vi.fn(),
  _rnnoise_process_frame: vi.fn().mockReturnValue(1),
  _malloc: vi.fn().mockReturnValue(1000),
  _free: vi.fn(),
  HEAPF32: new Float32Array(10000),
  HEAP32: new Int32Array(10000),
  HEAPU8: new Uint8Array(10000)
};

// Mock AudioContext
export const createMockAudioContext = () => ({
  sampleRate: 48000,
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn()
  }),
  createScriptProcessor: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onaudioprocess: null
  }),
  createAnalyser: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    getByteTimeDomainData: vi.fn(),
    getFloatTimeDomainData: vi.fn()
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 }
  }),
  close: vi.fn().mockResolvedValue(undefined),
  state: 'running',
  suspend: vi.fn(),
  resume: vi.fn()
});

// Mock MediaStream
export const createMockMediaStream = () => {
  const tracks = [{
    stop: vi.fn(),
    kind: 'audio',
    enabled: true
  }];
  
  return {
    getTracks: vi.fn().mockReturnValue(tracks),
    getAudioTracks: vi.fn().mockReturnValue(tracks),
    addTrack: vi.fn(),
    removeTrack: vi.fn()
  };
};

// Mock getUserMedia
export const setupMediaDevicesMock = () => {
  const mockStream = createMockMediaStream();
  global.navigator = {
    ...global.navigator,
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
      ondevicechange: null,
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      getSupportedConstraints: vi.fn().mockReturnValue({}),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(true)
    } as MediaDevices
  };
};

// Mock HTMLAudioElement for AudioPlayer tests
export const createMockAudio = () => {
  const eventListeners: { [key: string]: EventListener[] } = {};
  
  const mockAudio = {
    // Audio properties
    src: '',
    currentTime: 0,
    duration: 0,
    paused: true,
    volume: 1,
    muted: false,
    readyState: 0,
    error: null,
    preload: '',
    
    // DOM Element properties and methods
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    hasAttribute: vi.fn(),
    tagName: 'AUDIO',
    nodeType: 1,
    nodeName: 'AUDIO',
    parentNode: null,
    childNodes: [],
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    cloneNode: vi.fn(() => createMockAudio()),
    ownerDocument: document,
    
    // Audio methods
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    
    // Event handling
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (!eventListeners[type]) {
        eventListeners[type] = [];
      }
      eventListeners[type].push(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (eventListeners[type]) {
        const index = eventListeners[type].indexOf(listener);
        if (index > -1) {
          eventListeners[type].splice(index, 1);
        }
      }
    }),
    dispatchEvent: vi.fn(),
    
    // Helper to trigger events in tests
    _triggerEvent: (type: string, event = {}) => {
      if (eventListeners[type]) {
        eventListeners[type].forEach(listener => listener(event as Event));
      }
    }
  };
  
  return mockAudio;
};

// Setup HTMLAudioElement mock for tests
export const setupAudioElementMock = () => {
  const mockAudio = createMockAudio();
  
  // Mock HTMLAudioElement constructor
  const originalHTMLAudioElement = global.HTMLAudioElement;
  global.HTMLAudioElement = vi.fn(() => mockAudio) as any;
  
  // Mock audio element creation in JSDOM
  Object.defineProperty(window, 'Audio', {
    writable: true,
    value: vi.fn(() => mockAudio)
  });
  
  // Mock createElement to return our mock audio for audio elements
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName.toLowerCase() === 'audio') {
      return mockAudio as any;
    }
    return originalCreateElement(tagName);
  });
  
  // Mock getBoundingClientRect for seek functionality
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 200,
    bottom: 20,
    width: 200,
    height: 20,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
  
  return { mockAudio, originalHTMLAudioElement };
};

// Common test utilities
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

export const createTestConfig = (overrides = {}) => ({
  bufferSize: 4096,
  sampleRate: 48000,
  channelCount: 1,
  enableAnalysis: true,
  enableNoiseSuppression: true,
  enableVAD: true,
  vadThreshold: 0.5,
  vadSensitivity: 0.5,
  enableAGC: false,
  agcTargetLevel: 0.7,
  agcCompressionRate: 0.8,
  workerProcessingEnabled: false,
  ...overrides
});