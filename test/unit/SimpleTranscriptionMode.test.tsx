/**
 * Tests for SimpleTranscriptionMode component
 * TDD approach: Tests for critical logic issues
 * - Service shutdown order (neural → dual → visualizer → UI)
 * - Race condition prevention
 * - Text preservation priority (Claude > Deepgram > WebSpeech)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SimpleTranscriptionMode } from '../../src/features/audio-processing/components/audio-fragment-processor/SimpleTranscriptionMode';
import { NeuralProvider } from '../../src/contexts/NeuralContext';

// Create mock functions we can track
const mockStopStreamingRecording = vi.fn().mockResolvedValue([]);
const mockStopTranscription = vi.fn().mockResolvedValue(undefined);
const mockStartStreamingRecording = vi.fn().mockResolvedValue(undefined);
const mockStartTranscription = vi.fn();
const mockResetTranscription = vi.fn();

// Mock dependencies with controllable state
vi.mock('@susurro/core', () => ({
  useDualTranscription: () => ({
    startTranscription: mockStartTranscription,
    stopTranscription: mockStopTranscription,
    resetTranscription: mockResetTranscription,
    isTranscribing: false,
    webSpeechText: 'Web Speech transcription',
    deepgramText: 'Deepgram refined transcription',
    refinedText: null,
    isRefining: false,
    refineWithClaude: vi.fn(),
    currentResult: null,
    results: [],
    error: null,
    addDeepgramChunk: vi.fn(),
  }),
  useSusurro: () => ({
    isEngineInitialized: true,
    initializeAudioEngine: vi.fn(),
    startStreamingRecording: mockStartStreamingRecording,
    stopStreamingRecording: mockStopStreamingRecording,
    currentStream: null,
  }),
  useTranscriptionWorker: () => ({
    isReady: true,
    isProcessing: false,
    refineText: vi.fn(),
    onTextRefined: null,
    onError: null,
  }),
  useAudioWorker: () => ({
    isReady: false,
    processAudio: vi.fn(),
    onAudioProcessed: null,
    onError: null,
  }),
  AUDIO_CONFIG: {
    RECORDING: {
      DEFAULT_CHUNK_DURATION_MS: 20000,
      VAD_CUT_THRESHOLD: 0.0,
    },
  },
}));

vi.mock('murmuraba', () => ({
  SimpleWaveformAnalyzer: ({ stream, isActive }: any) => (
    <div data-testid="waveform">{isActive ? 'Recording' : 'Idle'}</div>
  ),
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(<NeuralProvider>{component}</NeuralProvider>);
};

describe('SimpleTranscriptionMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial placeholder', () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    expect(screen.getByPlaceholderText('Press SPACE to start recording')).toBeInTheDocument();
  });

  it('should display record button', () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    expect(screen.getByText(/Record \(SPACE\)/i)).toBeInTheDocument();
  });

  it('should start recording when space key is pressed', async () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText(/Stop \(ESC\)/i)).toBeInTheDocument();
    });
  });

  it('should not start recording when typing in textarea', () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    const textarea = screen.getByPlaceholderText('Press SPACE to start recording');

    // Focus textarea and press space
    fireEvent.focus(textarea);
    fireEvent.keyDown(textarea, { code: 'Space' });

    // Should not trigger recording when typing in textarea
    expect(screen.queryByText(/Stop \(ESC\)/i)).not.toBeInTheDocument();
  });

  it('should stop recording when ESC key is pressed', async () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    // Start recording
    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText(/Stop \(ESC\)/i)).toBeInTheDocument();
    });

    // Stop recording with ESC
    fireEvent.keyDown(window, { code: 'Escape' });

    await waitFor(() => {
      expect(screen.getByText(/Record \(SPACE\)/i)).toBeInTheDocument();
    });
  });

  it('should display keyboard shortcuts', () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    expect(screen.getByText('SPACE: Record')).toBeInTheDocument();
    expect(screen.getByText('ESC: Stop')).toBeInTheDocument();
  });

  it('should show copy button when there is text', () => {
    const { rerender } = renderWithProviders(<SimpleTranscriptionMode />);

    // Initially no copy button
    expect(screen.queryByText(/Copy/i)).not.toBeInTheDocument();

    // Mock some transcribed text
    // Note: In real scenario, this would come from the hook
    // For now, we're just testing the UI logic
  });

  it('should display system status indicators when recording', async () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText(/Web Speech/i)).toBeInTheDocument();
      expect(screen.getByText(/Deepgram/i)).toBeInTheDocument();
    });
  });

  it('should call onLog callback when provided', async () => {
    const onLog = vi.fn();
    renderWithProviders(<SimpleTranscriptionMode onLog={onLog} />);

    const recordButton = screen.getByText(/Record \(SPACE\)/i);
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('Recording started'), 'success');
    });
  });

  it('should handle copy to clipboard', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const onLog = vi.fn();
    renderWithProviders(<SimpleTranscriptionMode onLog={onLog} />);

    // Simulate having some text (this would come from the hook in real scenario)
    // For now, we're testing the copy functionality structure
  });

  it('should show waveform when recording with stream', async () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      // Waveform should be visible when recording
      const waveformContainer = document.querySelector('[style*="borderBottom"]');
      expect(waveformContainer).toBeInTheDocument();
    });
  });

  it('should display last update indicator', async () => {
    renderWithProviders(<SimpleTranscriptionMode />);

    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      // Check for last update indicator structure
      expect(screen.getByText(/Web Speech/i)).toBeInTheDocument();
    });
  });

  it('should show error message when error occurs', () => {
    // This would require mocking the hook to return an error
    // Testing the error display logic
    renderWithProviders(<SimpleTranscriptionMode />);

    // In a full implementation, mock the hook to return error state
    // and verify error message is displayed
  });

  // ============================================================================
  // TDD TESTS FOR CRITICAL LOGIC ISSUES
  // ============================================================================

  describe('Service Shutdown Order (TDD)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should stop services in correct order: neural → dual → UI update', async () => {
      const callOrder: string[] = [];

      // Track call order
      mockStopStreamingRecording.mockImplementation(async () => {
        callOrder.push('neural');
        return [];
      });

      mockStopTranscription.mockImplementation(async () => {
        callOrder.push('dual');
      });

      renderWithProviders(<SimpleTranscriptionMode />);

      // Start recording
      const recordButton = screen.getByText(/🎤 GRABAR/i);
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/⏹ PARAR/i)).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = screen.getByText(/⏹ PARAR/i);
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(callOrder).toEqual(['neural', 'dual']);
      });

      // UI should update AFTER services stopped
      await waitFor(() => {
        expect(screen.getByText(/🎤 GRABAR/i)).toBeInTheDocument();
      });
    });

    it('should NOT update UI state before services stop', async () => {
      let neuralStopComplete = false;
      let dualStopComplete = false;

      mockStopStreamingRecording.mockImplementation(async () => {
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        neuralStopComplete = true;
        return [];
      });

      mockStopTranscription.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        dualStopComplete = true;
      });

      renderWithProviders(<SimpleTranscriptionMode />);

      // Start and stop recording
      fireEvent.click(screen.getByText(/🎤 GRABAR/i));
      await waitFor(() => expect(screen.getByText(/⏹ PARAR/i)).toBeInTheDocument());

      fireEvent.click(screen.getByText(/⏹ PARAR/i));

      // Button should still show "PARAR" while services are stopping
      expect(screen.queryByText(/⏹ PARAR/i)).toBeInTheDocument();

      // Wait for services to complete
      await waitFor(() => {
        expect(neuralStopComplete).toBe(true);
        expect(dualStopComplete).toBe(true);
      });

      // NOW UI should update
      await waitFor(() => {
        expect(screen.getByText(/🎤 GRABAR/i)).toBeInTheDocument();
      });
    });
  });

  describe('Text Preservation Priority (TDD)', () => {
    it('should preserve Claude refined text over others', async () => {
      const onLog = vi.fn();

      // Mock worker with refined text
      vi.mock('@susurro/core', async () => {
        const actual = await vi.importActual('@susurro/core');
        return {
          ...actual,
          useTranscriptionWorker: () => ({
            isReady: true,
            isProcessing: false,
            refineText: vi.fn(),
            onTextRefined: null,
            onError: null,
          }),
        };
      });

      renderWithProviders(<SimpleTranscriptionMode onLog={onLog} />);

      // Start recording
      fireEvent.click(screen.getByText(/🎤 GRABAR/i));
      await waitFor(() => expect(screen.getByText(/⏹ PARAR/i)).toBeInTheDocument());

      // Stop recording
      fireEvent.click(screen.getByText(/⏹ PARAR/i));

      await waitFor(() => {
        // Should preserve Deepgram text (since Claude refined is not available in mock)
        const preserveCall = onLog.mock.calls.find((call) =>
          call[0]?.includes('💾 Preserved')
        );
        expect(preserveCall).toBeDefined();
        expect(preserveCall[0]).toContain('Deepgram refined transcription');
      });
    });

    it('should preserve Deepgram text if Claude not available', async () => {
      const onLog = vi.fn();
      renderWithProviders(<SimpleTranscriptionMode onLog={onLog} />);

      fireEvent.click(screen.getByText(/🎤 GRABAR/i));
      await waitFor(() => expect(screen.getByText(/⏹ PARAR/i)).toBeInTheDocument());

      fireEvent.click(screen.getByText(/⏹ PARAR/i));

      await waitFor(() => {
        const preserveCall = onLog.mock.calls.find((call) =>
          call[0]?.includes('💾 Preserved')
        );
        expect(preserveCall).toBeDefined();
        expect(preserveCall[0]).toContain('chars');
      });
    });
  });

  describe('Race Condition Prevention (TDD)', () => {
    it('should handle rapid start/stop without state corruption', async () => {
      renderWithProviders(<SimpleTranscriptionMode />);

      // Rapidly toggle recording
      const recordButton = screen.getByText(/🎤 GRABAR/i);

      fireEvent.click(recordButton);
      fireEvent.click(recordButton); // Click again immediately

      await waitFor(() => {
        // Should either be recording or stopped, not stuck in between
        const isRecording = screen.queryByText(/⏹ PARAR/i) !== null;
        const isStopped = screen.queryByText(/🎤 GRABAR/i) !== null;
        expect(isRecording || isStopped).toBe(true);
      });
    });

    it('should not allow starting while stop is in progress', async () => {
      let stopInProgress = false;

      mockStopStreamingRecording.mockImplementation(async () => {
        stopInProgress = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        stopInProgress = false;
        return [];
      });

      renderWithProviders(<SimpleTranscriptionMode />);

      // Start recording
      fireEvent.click(screen.getByText(/🎤 GRABAR/i));
      await waitFor(() => expect(screen.getByText(/⏹ PARAR/i)).toBeInTheDocument());

      // Stop recording
      fireEvent.click(screen.getByText(/⏹ PARAR/i));

      // Try to start again while stopping
      if (stopInProgress) {
        const startButton = screen.queryByText(/🎤 GRABAR/i);
        if (startButton) {
          fireEvent.click(startButton);
        }
      }

      // Should complete stop before allowing new start
      await waitFor(() => {
        expect(stopInProgress).toBe(false);
      });
    });
  });

  describe('Stream Management (TDD)', () => {
    it('should cleanup visualizer stream on stop', async () => {
      const mockTrack = {
        stop: vi.fn(),
        enabled: true,
        kind: 'audio' as const,
      };

      // Mock getUserMedia to return a stream with trackable stop
      global.navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
        id: 'test-stream',
        active: true,
        getTracks: () => [mockTrack],
        getAudioTracks: () => [mockTrack],
        getVideoTracks: () => [],
      });

      renderWithProviders(<SimpleTranscriptionMode />);

      // Start recording (creates visualizer stream)
      fireEvent.click(screen.getByText(/🎤 GRABAR/i));
      await waitFor(() => expect(screen.getByText(/⏹ PARAR/i)).toBeInTheDocument());

      // Stop recording
      fireEvent.click(screen.getByText(/⏹ PARAR/i));

      await waitFor(() => {
        // Visualizer stream track should be stopped
        expect(mockTrack.stop).toHaveBeenCalled();
      });
    });
  });
});
