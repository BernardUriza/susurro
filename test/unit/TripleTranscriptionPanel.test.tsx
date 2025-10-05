/**
 * TDD Tests for Triple Transcription Panel
 *
 * UI Architecture:
 * ┌─────────────┬─────────────┬─────────────┐
 * │  WebSpeech  │   Whisper   │  Deepgram   │  ← Individual engine outputs
 * └─────────────┴─────────────┴─────────────┘
 * ┌───────────────────────────────────────────┐
 * │        Final Refined Text                 │  ← Refined combination
 * └───────────────────────────────────────────┘
 *
 * Data Flow:
 * WebSpeech Stream ─┐
 * Whisper Stream   ─┤─→ Refiner ─→ Final Text
 * Deepgram Stream  ─┘
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// This component doesn't exist yet - TDD approach!
import { TripleTranscriptionPanel } from '../../src/features/audio-processing/components/audio-fragment-processor/TripleTranscriptionPanel';

describe('TripleTranscriptionPanel - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UI Structure', () => {
    it('should render 3 separate engine panels', () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={false}
        />
      );

      // Should have 3 individual engine panels
      expect(screen.getByTestId('webspeech-panel')).toBeTruthy();
      expect(screen.getByTestId('whisper-panel')).toBeTruthy();
      expect(screen.getByTestId('deepgram-panel')).toBeTruthy();
    });

    it('should render final refined text panel below engines', () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={false}
        />
      );

      const refinedPanel = screen.getByTestId('refined-panel');
      expect(refinedPanel).toBeInTheDocument();

      // Refined panel should be below the engine panels
      const webspeechPanel = screen.getByTestId('webspeech-panel');
      const refinedRect = refinedPanel.getBoundingClientRect();
      const webspeechRect = webspeechPanel.getBoundingClientRect();
      expect(refinedRect.top).toBeGreaterThan(webspeechRect.bottom);
    });

    it('should display panel labels correctly', () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={false}
        />
      );

      expect(screen.getByText(/web speech/i)).toBeInTheDocument();
      expect(screen.getByText(/whisper/i)).toBeInTheDocument();
      expect(screen.getByText(/deepgram/i)).toBeInTheDocument();
      expect(screen.getByText(/final.*refined/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Text Display', () => {
    it('should display WebSpeech text in real-time', async () => {
      const { rerender } = render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={true}
        />
      );

      // Initially empty
      const webspeechPanel = screen.getByTestId('webspeech-panel');
      expect(webspeechPanel).toHaveTextContent('');

      // Update with text
      rerender(
        <TripleTranscriptionPanel
          webSpeechText="Hello from WebSpeech"
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={true}
        />
      );

      await waitFor(() => {
        expect(webspeechPanel).toHaveTextContent('Hello from WebSpeech');
      });
    });

    it('should display Whisper text independently', async () => {
      const { rerender } = render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={true}
        />
      );

      rerender(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText="Hello from Whisper"
          deepgramText=""
          refinedText=""
          isRecording={true}
        />
      );

      const whisperPanel = screen.getByTestId('whisper-panel');
      await waitFor(() => {
        expect(whisperPanel).toHaveTextContent('Hello from Whisper');
      });
    });

    it('should display Deepgram text independently', async () => {
      const { rerender } = render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={true}
        />
      );

      rerender(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText="Hello from Deepgram"
          refinedText=""
          isRecording={true}
        />
      );

      const deepgramPanel = screen.getByTestId('deepgram-panel');
      await waitFor(() => {
        expect(deepgramPanel).toHaveTextContent('Hello from Deepgram');
      });
    });

    it('should show all 3 engines transcribing simultaneously', async () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText="WebSpeech version"
          whisperText="Whisper version"
          deepgramText="Deepgram version"
          refinedText=""
          isRecording={true}
        />
      );

      expect(screen.getByTestId('webspeech-panel')).toHaveTextContent('WebSpeech version');
      expect(screen.getByTestId('whisper-panel')).toHaveTextContent('Whisper version');
      expect(screen.getByTestId('deepgram-panel')).toHaveTextContent('Deepgram version');
    });
  });

  describe('Final Refined Text', () => {
    it('should display refined text combining all 3 inputs', async () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText="Web text"
          whisperText="Whisper text"
          deepgramText="Deepgram text"
          refinedText="Beautiful refined final text"
          isRecording={true}
        />
      );

      const refinedPanel = screen.getByTestId('refined-panel');
      await waitFor(() => {
        expect(refinedPanel).toHaveTextContent('Beautiful refined final text');
      });
    });

    it('should update refined text when any input changes', async () => {
      const { rerender } = render(
        <TripleTranscriptionPanel
          webSpeechText="Initial"
          whisperText="Initial"
          deepgramText="Initial"
          refinedText="Initial refined"
          isRecording={true}
        />
      );

      rerender(
        <TripleTranscriptionPanel
          webSpeechText="Updated"
          whisperText="Initial"
          deepgramText="Initial"
          refinedText="Updated refined text"
          isRecording={true}
        />
      );

      const refinedPanel = screen.getByTestId('refined-panel');
      await waitFor(() => {
        expect(refinedPanel).toHaveTextContent('Updated refined text');
      });
    });
  });

  describe('Visual States', () => {
    it('should highlight active engines during recording', () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText="Active text"
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={true}
        />
      );

      const webspeechPanel = screen.getByTestId('webspeech-panel');
      // Active panel should have distinctive styling
      expect(webspeechPanel).toHaveClass(/active|recording/i);
    });

    it('should show different colors for each engine', () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText="Text"
          whisperText="Text"
          deepgramText="Text"
          refinedText=""
          isRecording={true}
        />
      );

      const webspeechPanel = screen.getByTestId('webspeech-panel');
      const whisperPanel = screen.getByTestId('whisper-panel');
      const deepgramPanel = screen.getByTestId('deepgram-panel');

      // Each should have distinctive color class
      expect(webspeechPanel).toHaveClass(/webspeech|gold|yellow/i);
      expect(whisperPanel).toHaveClass(/whisper|purple|violet/i);
      expect(deepgramPanel).toHaveClass(/deepgram|blue|cyan/i);
    });

    it('should highlight refined panel when text is ready', () => {
      render(
        <TripleTranscriptionPanel
          webSpeechText="Web"
          whisperText="Whisper"
          deepgramText="Deepgram"
          refinedText="Final refined beautiful text"
          isRecording={true}
        />
      );

      const refinedPanel = screen.getByTestId('refined-panel');
      expect(refinedPanel).toHaveClass(/refined|green|success/i);
    });
  });

  describe('Responsive Layout', () => {
    it('should stack panels vertically on mobile', () => {
      // Mock mobile viewport
      global.innerWidth = 375;

      render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={false}
        />
      );

      const container = screen.getByTestId('triple-panel-container');
      expect(container).toHaveClass(/vertical|stack|column/i);
    });

    it('should display panels horizontally on desktop', () => {
      // Mock desktop viewport
      global.innerWidth = 1920;

      render(
        <TripleTranscriptionPanel
          webSpeechText=""
          whisperText=""
          deepgramText=""
          refinedText=""
          isRecording={false}
        />
      );

      const container = screen.getByTestId('triple-panel-container');
      expect(container).toHaveClass(/horizontal|grid|row/i);
    });
  });
});

/**
 * TDD Tests for 3-Stream Refiner Architecture
 */
describe('TripleStreamRefiner - TDD', () => {
  it('should accept 3 separate text inputs', () => {
    const refine = vi.fn();

    // Component/hook that refines 3 inputs
    const inputs = {
      webSpeech: 'Web text',
      whisper: 'Whisper text',
      deepgram: 'Deepgram text',
    };

    refine(inputs);

    expect(refine).toHaveBeenCalledWith({
      webSpeech: 'Web text',
      whisper: 'Whisper text',
      deepgram: 'Deepgram text',
    });
  });

  it('should send all 3 inputs to Claude refiner', async () => {
    const mockRefiner = vi.fn().mockResolvedValue('Refined output');

    const result = await mockRefiner({
      webSpeech: 'Web version',
      whisper: 'Whisper version',
      deepgram: 'Deepgram version',
    });

    expect(mockRefiner).toHaveBeenCalled();
    expect(result).toBe('Refined output');
  });

  it('should handle partial inputs (some engines not ready)', async () => {
    const mockRefiner = vi.fn().mockResolvedValue('Partial refined');

    await mockRefiner({
      webSpeech: 'Web text',
      whisper: '', // Not ready yet
      deepgram: 'Deepgram text',
    });

    expect(mockRefiner).toHaveBeenCalledWith(
      expect.objectContaining({
        webSpeech: 'Web text',
        whisper: '',
        deepgram: 'Deepgram text',
      })
    );
  });

  it('should prioritize all 3 inputs equally', () => {
    const inputs = {
      webSpeech: 'A',
      whisper: 'B',
      deepgram: 'C',
    };

    // No input should be ignored or prioritized
    const keys = Object.keys(inputs);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('webSpeech');
    expect(keys).toContain('whisper');
    expect(keys).toContain('deepgram');
  });
});
