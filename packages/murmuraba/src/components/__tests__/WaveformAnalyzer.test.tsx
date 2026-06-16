import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { WaveformAnalyzer } from '../waveform-analyzer/waveform-analyzer';

// Mock AudioContext
const mockAudioContext = {
  state: 'suspended',
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  createAnalyser: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn()
  }),
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn()
  }),
  createMediaElementSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn()
  }),
  destination: {}
};

// Mock global AudioContext
global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext) as any;

describe('WaveformAnalyzer - Manejo de errores de AudioContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getBoundingClientRect para simular un canvas visible
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 800,
      height: 200,
      top: 0,
      left: 0,
      right: 800,
      bottom: 200
    });
  });

  it('debe mostrar error cuando no hay tracks de audio en el stream', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([]),
      getAudioTracks: vi.fn().mockReturnValue([])
    } as unknown as MediaStream;

    render(<WaveformAnalyzer stream={mockStream} />);

    await waitFor(() => {
      expect(screen.getByText(/No audio tracks found in stream/)).toBeInTheDocument();
    });
  });

  it('debe mostrar error cuando AudioContext está bloqueado', async () => {
    // Simular error al crear AudioContext
    global.AudioContext = vi.fn().mockImplementation(() => {
      throw new Error('AudioContext creation blocked by browser policy');
    });

    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ kind: 'audio' }]),
      getAudioTracks: vi.fn().mockReturnValue([{
        enabled: true,
        readyState: 'live',
        label: 'Microphone',
        id: '123',
        muted: false
      }])
    } as unknown as MediaStream;

    render(<WaveformAnalyzer stream={mockStream} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to initialize live stream/)).toBeInTheDocument();
    });
  });

  it('debe verificar dimensiones del canvas antes de dibujar', () => {
    // Mock getBoundingClientRect para retornar dimensiones cero
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    });
    
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ kind: 'audio' }]),
      getAudioTracks: vi.fn().mockReturnValue([{
        enabled: true,
        readyState: 'live',
        label: 'Microphone',
        id: '123',
        muted: false
      }])
    } as unknown as MediaStream;

    render(<WaveformAnalyzer stream={mockStream} />);
    
    // Debe mostrar error cuando el canvas no tiene dimensiones válidas
    expect(screen.getByText(/Canvas not visible - cannot render waveform/)).toBeInTheDocument();
  });

  it('debe manejar correctamente cuando el componente está deshabilitado', () => {
    render(<WaveformAnalyzer audioUrl="test.mp3" disabled={true} />);
    
    // Cuando está deshabilitado con audioUrl, el botón debe estar deshabilitado
    const playButton = screen.getByRole('button', { name: /play audio/i });
    expect(playButton).toBeDisabled();
  });
});