import { render, screen, waitFor } from '@testing-library/react';
import { VADDisplay } from '../VADDisplay';
import * as murmuraba from 'murmuraba';

vi.mock('murmuraba', () => ({
  initializeAudioEngine: vi.fn(),
  processFileWithMetrics: vi.fn(),
  isInitialized: false
}));

describe('VADDisplay', () => {
  const mockFile = new File(['test'], 'test.wav', { type: 'audio/wav' });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display VAD score from processFileWithMetrics', async () => {
    const mockMetrics = {
      audioBuffer: new ArrayBuffer(0),
      metrics: [{
        vadScore: 0.85,
        noiseLevel: -40,
        timestamp: 0,
        chunkIndex: 0
      }]
    };
    
    vi.mocked(murmuraba.processFileWithMetrics).mockResolvedValue(mockMetrics);
    
    const onVADCalculated = vi.fn();
    render(
      <VADDisplay 
        audioFile={mockFile}
        label="Test Audio"
        onVADCalculated={onVADCalculated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/85\.0%/)).toBeTruthy();
    });

    expect(onVADCalculated).toHaveBeenCalledWith(0.85);
  });

  it('should handle missing VAD score', async () => {
    vi.mocked(murmuraba.processFileWithMetrics).mockResolvedValue({
      audioBuffer: new ArrayBuffer(0),
      metrics: []
    });
    
    render(<VADDisplay audioFile={mockFile} label="Test" />);

    await waitFor(() => {
      expect(screen.getByText(/0\.0%/)).toBeTruthy();
    });
  });

  it('should initialize engine if not initialized', async () => {
    vi.mocked(murmuraba.processFileWithMetrics).mockResolvedValue({
      audioBuffer: new ArrayBuffer(0),
      metrics: []
    });
    
    render(<VADDisplay audioFile={mockFile} label="Test" />);

    await waitFor(() => {
      expect(murmuraba.initializeAudioEngine).toHaveBeenCalledWith({
        enableAGC: true,
        enableNoiseSuppression: true,
        enableEchoCancellation: true
      });
    });
  });
});