import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRNNoiseModule } from '../../utils/rnnoise-loader';

// Mock @jitsi/rnnoise-wasm module
vi.mock('@jitsi/rnnoise-wasm', () => ({
  createRNNWasmModule: vi.fn(() => Promise.resolve({
    _malloc: vi.fn((size: number) => size),
    _free: vi.fn(),
    _rnnoise_create: vi.fn((model: number) => 12345),
    _rnnoise_destroy: vi.fn(),
    _rnnoise_process_frame: vi.fn(() => 0.5),
    HEAPU8: new Uint8Array(1024),
    HEAPF32: new Float32Array(256)
  }))
}));

describe('rnnoise-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load RNNoise module successfully', async () => {
    const module = await loadRNNoiseModule();
    
    expect(module).toBeDefined();
    expect(module._malloc).toBeDefined();
    expect(module._free).toBeDefined();
    expect(module._rnnoise_create).toBeDefined();
    expect(module._rnnoise_destroy).toBeDefined();
    expect(module._rnnoise_process_frame).toBeDefined();
    expect(module.HEAPU8).toBeDefined();
    expect(module.HEAPF32).toBeDefined();
  });

  it('should return the same module instance on multiple calls', async () => {
    const module1 = await loadRNNoiseModule();
    const module2 = await loadRNNoiseModule();
    
    expect(module1).toBe(module2);
  });

  it('should create valid state', async () => {
    const module = await loadRNNoiseModule();
    const state = module._rnnoise_create(0);
    
    expect(state).toBe(12345);
  });

  it('should allocate memory correctly', async () => {
    const module = await loadRNNoiseModule();
    const ptr = module._malloc(480 * 4);
    
    expect(ptr).toBe(480 * 4);
    expect(module._malloc).toHaveBeenCalledWith(480 * 4);
  });
});