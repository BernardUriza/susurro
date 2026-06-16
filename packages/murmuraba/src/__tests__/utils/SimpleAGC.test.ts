import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimpleAGC } from '../../utils/simple-agc';

describe('SimpleAGC - TDD Red Phase', () => {
  let mockAudioContext: any;
  let mockAnalyser: any;
  let mockGainNode: any;

  beforeEach(() => {
    // Mock AnalyserNode
    mockAnalyser = {
      connect: vi.fn(),
      fftSize: 256,
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn()
    };

    // Mock GainNode
    mockGainNode = {
      connect: vi.fn(),
      gain: {
        value: 1.0,
        setTargetAtTime: vi.fn()
      }
    };

    // Mock AudioContext
    mockAudioContext = {
      createAnalyser: vi.fn(() => mockAnalyser),
      createGain: vi.fn(() => mockGainNode),
      currentTime: 0
    };
  });

  describe('Critical Volume Fix - 4% to Audible', () => {
    it('should amplify 4% volume (shouting) to at least 25% (audible)', () => {
      // ARRANGE: User reports shouting = 4% volume
      const agc = new SimpleAGC(mockAudioContext, 0.3); // Target 30% level
      
      // Simulate 4% RMS audio data (very quiet)
      const quietData = new Uint8Array(128);
      // 128 = silence, simulate 4% = ~133 (128 + 5)
      quietData.fill(133); 
      mockAnalyser.getByteTimeDomainData.mockImplementation((array: Uint8Array) => {
        array.set(quietData);
      });

      // ACT: Process one AGC update
      agc.updateGain();

      // ASSERT: Gain should be increased significantly
      // 0.3 target / 0.04 current = 7.5x gain needed
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(
        expect.any(Number), // We'll check the exact value
        0, // currentTime
        0.1 // attack time
      );

      // Check that gain is at least 6x (to reach 24%)
      const [targetGain] = mockGainNode.gain.setTargetAtTime.mock.calls[0];
      expect(targetGain).toBeGreaterThanOrEqual(6.0);
      expect(targetGain).toBeLessThanOrEqual(10.0); // Reasonable limit
    });

    it('should not amplify already loud audio', () => {
      const agc = new SimpleAGC(mockAudioContext, 0.3);
      
      // Simulate 80% RMS audio (loud)
      const loudData = new Uint8Array(128);
      loudData.fill(230); // ~80% amplitude
      mockAnalyser.getByteTimeDomainData.mockImplementation((array: Uint8Array) => {
        array.set(loudData);
      });

      agc.updateGain();

      // Should reduce gain (0.3 / 0.8 = 0.375)
      const [targetGain] = mockGainNode.gain.setTargetAtTime.mock.calls[0];
      expect(targetGain).toBeLessThan(1.0);
      expect(targetGain).toBeCloseTo(0.375, 1);
    });

    it('should limit maximum gain to prevent distortion', () => {
      const agc = new SimpleAGC(mockAudioContext, 0.3);
      
      // Simulate extremely quiet audio (0.5%)
      const tinyData = new Uint8Array(128);
      tinyData.fill(129); // Almost silence
      mockAnalyser.getByteTimeDomainData.mockImplementation((array: Uint8Array) => {
        array.set(tinyData);
      });

      agc.updateGain();

      // Even though 0.3/0.005 = 60x, should be limited
      const [targetGain] = mockGainNode.gain.setTargetAtTime.mock.calls[0];
      expect(targetGain).toBeLessThanOrEqual(10.0); // Max gain limit
    });

    it('should handle silence without errors', () => {
      const agc = new SimpleAGC(mockAudioContext, 0.3);
      
      // Complete silence
      const silentData = new Uint8Array(128).fill(128); // 128 = 0 amplitude
      mockAnalyser.getByteTimeDomainData.mockImplementation((array: Uint8Array) => {
        array.set(silentData);
      });

      // Should not throw or call setTargetAtTime
      expect(() => agc.updateGain()).not.toThrow();
      expect(mockGainNode.gain.setTargetAtTime).not.toHaveBeenCalled();
    });

    it('should use smooth transitions with attack time', () => {
      const agc = new SimpleAGC(mockAudioContext, 0.3);
      
      const normalData = new Uint8Array(128).fill(150); // Normal volume
      mockAnalyser.getByteTimeDomainData.mockImplementation((array: Uint8Array) => {
        array.set(normalData);
      });

      agc.updateGain();

      // Check attack time parameter (3rd argument)
      const [, , attackTime] = mockGainNode.gain.setTargetAtTime.mock.calls[0];
      expect(attackTime).toBe(0.1); // 100ms attack time
    });
  });

  describe('Integration with AudioContext', () => {
    it('should connect analyser to gain node', () => {
      const agc = new SimpleAGC(mockAudioContext, 0.3);
      
      expect(mockAnalyser.connect).toHaveBeenCalledWith(mockGainNode);
    });

    it('should configure analyser correctly', () => {
      const agc = new SimpleAGC(mockAudioContext, 0.3);
      
      expect(mockAnalyser.fftSize).toBe(256);
    });
  });
});