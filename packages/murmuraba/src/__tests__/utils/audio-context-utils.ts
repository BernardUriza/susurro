import { vi, beforeEach, afterEach } from 'vitest';

/**
 * Centralized Audio Context test utilities
 * Eliminates duplication across test files
 */

export interface AudioContextMockOptions {
  state?: AudioContextState;
  sampleRate?: number;
  currentTime?: number;
  baseLatency?: number;
  outputLatency?: number;
  includeWorklet?: boolean;
  includeAnalyser?: boolean;
  includeBiquadFilter?: boolean;
  includeMediaStreamDestination?: boolean;
}

export interface MockGainNode {
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    setTargetAtTime: ReturnType<typeof vi.fn>;
    setValueCurveAtTime: ReturnType<typeof vi.fn>;
    cancelScheduledValues: ReturnType<typeof vi.fn>;
    cancelAndHoldAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  numberOfInputs: number;
  numberOfOutputs: number;
  channelCount: number;
  channelCountMode: ChannelCountMode;
  channelInterpretation: ChannelInterpretation;
}

export function createMockGainNode(initialValue = 1): MockGainNode {
  return {
    gain: {
      value: initialValue,
      setValueAtTime: vi.fn().mockReturnThis(),
      linearRampToValueAtTime: vi.fn().mockReturnThis(),
      exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
      setTargetAtTime: vi.fn().mockReturnThis(),
      setValueCurveAtTime: vi.fn().mockReturnThis(),
      cancelScheduledValues: vi.fn().mockReturnThis(),
      cancelAndHoldAtTime: vi.fn().mockReturnThis(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: 'max' as ChannelCountMode,
    channelInterpretation: 'speakers' as ChannelInterpretation,
  };
}

export function createMockAnalyserNode() {
  return {
    fftSize: 2048,
    frequencyBinCount: 1024,
    minDecibels: -100,
    maxDecibels: -30,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 128) + 64;
      }
    }),
    getByteTimeDomainData: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = 128 + Math.floor(Math.sin(i * 0.1) * 64);
      }
    }),
    getFloatFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };
}

export function createMockScriptProcessor(
  bufferSize = 4096,
  numberOfInputChannels = 1,
  numberOfOutputChannels = 1
) {
  return {
    bufferSize,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    onaudioprocess: null as any,
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

export function createMockBiquadFilter() {
  return {
    type: 'lowpass' as BiquadFilterType,
    frequency: { value: 350, setValueAtTime: vi.fn() },
    Q: { value: 1, setValueAtTime: vi.fn() },
    gain: { value: 0, setValueAtTime: vi.fn() },
    detune: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    getFrequencyResponse: vi.fn(),
  };
}

export function createMockMediaStreamSource() {
  return {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    mediaStream: null,
    numberOfInputs: 0,
    numberOfOutputs: 1,
  };
}

export function createMockMediaStreamDestination() {
  return {
    stream: {
      id: 'mock-output-stream',
      active: true,
      getTracks: vi.fn().mockReturnValue([]),
      getAudioTracks: vi.fn().mockReturnValue([{ kind: 'audio' }]),
      getVideoTracks: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      clone: vi.fn(),
      getTrackById: vi.fn(),
    },
    numberOfInputs: 1,
    numberOfOutputs: 0,
  };
}

export function createMockAudioBuffer(
  numberOfChannels = 2,
  length = 48000,
  sampleRate = 48000
) {
  return {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  };
}

export function createMockAudioContext(options: AudioContextMockOptions = {}) {
  const {
    state = 'running',
    sampleRate = 48000,
    currentTime = 0,
    baseLatency = 0.01,
    outputLatency = 0.02,
    includeWorklet = false,
    includeAnalyser = false,
    includeBiquadFilter = false,
    includeMediaStreamDestination = false,
  } = options;

  const context: any = {
    state,
    sampleRate,
    currentTime,
    baseLatency,
    outputLatency,
    destination: {
      maxChannelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'max' as ChannelCountMode,
      channelInterpretation: 'speakers' as ChannelInterpretation,
    },
    listener: {
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      forwardX: { value: 0 },
      forwardY: { value: 0 },
      forwardZ: { value: -1 },
      upX: { value: 0 },
      upY: { value: 1 },
      upZ: { value: 0 },
    },
    createGain: vi.fn(() => createMockGainNode()),
    createScriptProcessor: vi.fn((buffer, input, output) =>
      createMockScriptProcessor(buffer, input, output)
    ),
    createMediaStreamSource: vi.fn(() => createMockMediaStreamSource()),
    createBuffer: vi.fn((channels, length, rate) =>
      createMockAudioBuffer(channels, length, rate)
    ),
    decodeAudioData: vi.fn().mockImplementation(() =>
      Promise.resolve(createMockAudioBuffer())
    ),
    close: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  if (includeWorklet) {
    context.audioWorklet = {
      addModule: vi.fn().mockResolvedValue(undefined),
    };
  }

  if (includeAnalyser) {
    context.createAnalyser = vi.fn(() => createMockAnalyserNode());
  }

  if (includeBiquadFilter) {
    context.createBiquadFilter = vi.fn(() => createMockBiquadFilter());
  }

  if (includeMediaStreamDestination) {
    context.createMediaStreamDestination = vi.fn(() =>
      createMockMediaStreamDestination()
    );
  }

  return context;
}

/**
 * Setup AudioContext mock globally
 * Returns the mock instance for further customization
 */
export function setupAudioContextMock(options?: AudioContextMockOptions) {
  const mockContext = createMockAudioContext(options);
  
  // Store original if exists
  const original = (global as any).AudioContext;
  
  // Setup mock
  (global as any).AudioContext = vi.fn(() => mockContext);
  (global as any).webkitAudioContext = (global as any).AudioContext;
  
  // Return cleanup function and mock
  return {
    context: mockContext,
    restore: () => {
      if (original) {
        (global as any).AudioContext = original;
        (global as any).webkitAudioContext = original;
      }
    },
  };
}

/**
 * Helper to use AudioContext mock in beforeEach/afterEach
 */
export function useAudioContextMock(options?: AudioContextMockOptions) {
  let mock: ReturnType<typeof setupAudioContextMock>;

  beforeEach(() => {
    mock = setupAudioContextMock(options);
  });

  afterEach(() => {
    mock?.restore();
    vi.clearAllMocks();
  });

  return () => mock?.context;
}