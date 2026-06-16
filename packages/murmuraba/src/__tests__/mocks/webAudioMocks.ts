import { vi } from 'vitest';

console.log('🎭 ========================================= 🎭');
console.log('🚀 INITIALIZING WEB AUDIO MOCKS 2025 EDITION 🚀');
console.log('🎭 ========================================= 🎭');

// 🎵 Mock AudioContext with all the bells and whistles
export const createMockAudioContext = () => {
  console.log('🎼 Creating Mock AudioContext...');
  
  const mockGainNode = {
    gain: { 
      value: 1, 
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      setValueCurveAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      cancelAndHoldAtTime: vi.fn()
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: 'max' as ChannelCountMode,
    channelInterpretation: 'speakers' as ChannelInterpretation,
    context: null as any
  };

  const mockAnalyserNode = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    minDecibels: -100,
    maxDecibels: -30,
    smoothingTimeConstant: 0.8,
    getByteFrequencyData: vi.fn((array: Uint8Array) => {
      // Simulate some frequency data
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 128) + 64;
      }
    }),
    getByteTimeDomainData: vi.fn((array: Uint8Array) => {
      // Simulate waveform data
      for (let i = 0; i < array.length; i++) {
        array[i] = 128 + Math.floor(Math.sin(i * 0.1) * 64);
      }
    }),
    getFloatFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn()
  };

  const mockScriptProcessor = {
    bufferSize: 4096,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    onaudioprocess: null as any,
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn()
  };

  const mockAudioContext = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running' as AudioContextState,
    baseLatency: 0.01,
    outputLatency: 0.02,
    destination: {
      maxChannelCount: 2,
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'max' as ChannelCountMode,
      channelInterpretation: 'speakers' as ChannelInterpretation
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
      upZ: { value: 0 }
    },
    createGain: vi.fn(() => mockGainNode),
    createAnalyser: vi.fn(() => mockAnalyserNode),
    createScriptProcessor: vi.fn((bufferSize, inputChannels, outputChannels) => {
      console.log(`🎛️ Creating ScriptProcessor: ${bufferSize} samples, ${inputChannels} in, ${outputChannels} out`);
      return mockScriptProcessor;
    }),
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      mediaStream: null
    })),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
      numberOfChannels: channels,
      length: length,
      sampleRate: sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn(() => new Float32Array(length))
    })),
    decodeAudioData: vi.fn().mockImplementation((arrayBuffer: ArrayBuffer) => {
      console.log('🎵 Decoding audio data...');
      return Promise.resolve({
        duration: 10,
        length: 480000,
        numberOfChannels: 2,
        sampleRate: 48000,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(480000)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn()
      });
    }),
    close: vi.fn().mockImplementation(() => {
      console.log('🔌 Closing AudioContext...');
      return Promise.resolve();
    }),
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  };

  console.log('✅ AudioContext mock created!');
  return mockAudioContext;
};

// 🎤 Mock MediaStream with realistic behavior
export class MockMediaStream implements MediaStream {
  active = true;
  id = `stream-${crypto.randomUUID()}`;
  private tracks: MediaStreamTrack[] = [];

  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks.length > 0 ? tracks : [createMockAudioTrack()];
    console.log(`🎬 Created MediaStream with ID: ${this.id}`);
  }

  getTracks(): MediaStreamTrack[] {
    return [...this.tracks];
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'audio');
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'video');
  }

  addTrack(track: MediaStreamTrack): void {
    console.log(`➕ Adding track to stream: ${track.id}`);
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack): void {
    console.log(`➖ Removing track from stream: ${track.id}`);
    this.tracks = this.tracks.filter(t => t !== track);
  }

  clone(): MediaStream {
    console.log(`🔄 Cloning stream: ${this.id}`);
    const clonedTracks = this.tracks.map(track => ({
      ...track,
      id: `track-clone-${crypto.randomUUID()}`
    }));
    return new MockMediaStream(clonedTracks as any);
  }

  getTrackById(id: string): MediaStreamTrack | null {
    return this.tracks.find(track => track.id === id) || null;
  }

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
  onaddtrack = null;
  onremovetrack = null;
}

// 🎚️ Mock MediaStreamTrack
function createMockAudioTrack(): MediaStreamTrack {
  return {
    kind: 'audio' as 'audio',
    id: `track-${crypto.randomUUID()}`,
    label: 'Mock Audio Track',
    enabled: true,
    muted: false,
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(() => {
      console.log('🛑 Track stopped');
    }),
    clone: vi.fn().mockReturnThis(),
    getCapabilities: vi.fn(() => ({
      aspectRatio: { min: 0, max: 0 },
      channelCount: { min: 1, max: 2 },
      deviceId: 'default',
      echoCancellation: [true, false],
      facingMode: [],
      frameRate: { min: 0, max: 0 },
      groupId: 'default-group',
      height: { min: 0, max: 0 },
      noiseSuppression: [true, false],
      sampleRate: { min: 8000, max: 48000 },
      sampleSize: { min: 8, max: 32 },
      width: { min: 0, max: 0 }
    })),
    getConstraints: vi.fn(() => ({})),
    getSettings: vi.fn(() => ({
      deviceId: 'default',
      groupId: 'default-group',
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
      sampleRate: 48000,
      sampleSize: 16
    })),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onended: null,
    onmute: null,
    onunmute: null,
    contentHint: '' as any,
    isolated: false
  } as MediaStreamTrack;
}

// 📼 Mock MediaRecorder with realistic events
export class MockMediaRecorder implements MediaRecorder {
  state: RecordingState = 'inactive';
  stream: MediaStream;
  mimeType: string;
  videoBitsPerSecond = 0;
  audioBitsPerSecond = 128000;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;
  onresume: ((event: Event) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;
  
  private intervalId?: NodeJS.Timeout;
  private chunkCount = 0;

  constructor(stream: MediaStream, options: MediaRecorderOptions = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'audio/webm';
    console.log(`🎙️ Created MediaRecorder with mimeType: ${this.mimeType}`);
  }

  start(timeslice?: number): void {
    console.log(`🔴 Starting recording${timeslice ? ` with ${timeslice}ms timeslice` : ''}`);
    this.state = 'recording';
    this.chunkCount = 0;
    
    if (this.onstart) {
      setTimeout(() => this.onstart!({ type: 'start' } as Event), 0);
    }

    if (timeslice) {
      this.intervalId = setInterval(() => {
        this.generateDataChunk();
      }, timeslice);
    }
  }

  stop(): void {
    console.log('⏹️ Stopping recording');
    this.state = 'inactive';
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Generate final chunk
    this.generateDataChunk();

    if (this.onstop) {
      setTimeout(() => this.onstop!({ type: 'stop' } as Event), 10);
    }
  }

  pause(): void {
    console.log('⏸️ Pausing recording');
    this.state = 'paused';
    if (this.onpause) {
      this.onpause({ type: 'pause' } as Event);
    }
  }

  resume(): void {
    console.log('▶️ Resuming recording');
    this.state = 'recording';
    if (this.onresume) {
      this.onresume({ type: 'resume' } as Event);
    }
  }

  requestData(): void {
    console.log('📊 Data requested');
    this.generateDataChunk();
  }

  private generateDataChunk(): void {
    if (this.ondataavailable) {
      this.chunkCount++;
      const size = 1000 + Math.floor(Math.random() * 9000); // 1KB-10KB chunks
      const data = new Uint8Array(size);
      
      // Fill with some pattern to simulate audio data
      for (let i = 0; i < size; i++) {
        data[i] = Math.floor(Math.sin(i * 0.01) * 127 + 128);
      }
      
      const blob = new Blob([data], { type: this.mimeType });
      console.log(`📦 Generated chunk #${this.chunkCount}: ${blob.size} bytes`);
      
      const event: BlobEvent = {
        data: blob,
        timecode: Date.now(),
        type: 'dataavailable',
        bubbles: false,
        cancelBubble: false,
        cancelable: false,
        composed: false,
        currentTarget: this,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: true,
        returnValue: true,
        srcElement: this as any,
        target: this,
        timeStamp: Date.now(),
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
        stopPropagation: vi.fn(),
        composedPath: vi.fn(() => []),
        initEvent: vi.fn(),
        NONE: 0,
        CAPTURING_PHASE: 1,
        AT_TARGET: 2,
        BUBBLING_PHASE: 3
      };
      
      this.ondataavailable(event);
    }
  }

  static isTypeSupported(mimeType: string): boolean {
    const supported = ['audio/webm', 'audio/ogg', 'video/webm', 'video/mp4'];
    const isSupported = supported.includes(mimeType);
    console.log(`🔍 Checking support for ${mimeType}: ${isSupported ? '✅' : '❌'}`);
    return isSupported;
  }

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

// 🌐 Mock navigator.mediaDevices
export const setupMediaDevicesMock = () => {
  console.log('🎮 Setting up navigator.mediaDevices mock...');
  
  if (!global.navigator) {
    (global as any).navigator = {};
  }

  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockImplementation(async (constraints?: MediaStreamConstraints) => {
        console.log('🎤 getUserMedia called with constraints:', constraints);
        
        // Simulate permission check
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const tracks = [];
        if (!constraints || constraints.audio !== false) {
          tracks.push(createMockAudioTrack());
        }
        
        const stream = new MockMediaStream(tracks);
        console.log(`✅ getUserMedia success! Stream ID: ${stream.id}`);
        return stream;
      }),
      
      enumerateDevices: vi.fn().mockImplementation(async () => {
        console.log('📱 Enumerating devices...');
        return [
          {
            deviceId: 'default',
            kind: 'audioinput' as MediaDeviceKind,
            label: 'Default Microphone',
            groupId: 'default-group',
            toJSON: () => ({})
          },
          {
            deviceId: 'communications',
            kind: 'audioinput' as MediaDeviceKind,
            label: 'Communications Microphone',
            groupId: 'communications-group',
            toJSON: () => ({})
          },
          {
            deviceId: 'default-speaker',
            kind: 'audiooutput' as MediaDeviceKind,
            label: 'Default Speaker',
            groupId: 'default-group',
            toJSON: () => ({})
          }
        ] as MediaDeviceInfo[];
      }),
      
      getSupportedConstraints: vi.fn(() => ({
        aspectRatio: true,
        autoGainControl: true,
        channelCount: true,
        deviceId: true,
        echoCancellation: true,
        facingMode: true,
        frameRate: true,
        groupId: true,
        height: true,
        noiseSuppression: true,
        sampleRate: true,
        sampleSize: true,
        width: true
      })),
      
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      ondevicechange: null
    },
    writable: true,
    configurable: true
  });
  
  console.log('✅ navigator.mediaDevices mock setup complete!');
};

// 🔊 Setup all audio mocks
export const setupAllAudioMocks = () => {
  console.log('\n🎪 ====== SETTING UP ALL AUDIO MOCKS ====== 🎪\n');
  
  // Mock AudioContext
  global.AudioContext = vi.fn().mockImplementation(createMockAudioContext) as any;
  (global as any).webkitAudioContext = global.AudioContext;
  
  // Mock MediaStream
  global.MediaStream = MockMediaStream as any;
  
  // Mock MediaRecorder
  global.MediaRecorder = MockMediaRecorder as any;
  
  // Setup navigator.mediaDevices
  setupMediaDevicesMock();
  
  console.log('\n🎉 ====== ALL MOCKS READY TO ROCK! ====== 🎉\n');
};