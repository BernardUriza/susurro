import React from 'react';
import { render, screen } from '@testing-library/react';
import { VadDisplay } from '../vad-display/vad-display';

describe('VadDisplay', () => {
  const mockVadData = [
    { time: 0, vad: 0.2 },
    { time: 1, vad: 0.8 },
    { time: 2, vad: 0.9 },
    { time: 3, vad: 0.7 },
    { time: 4, vad: 0.3 }
  ];

  it('should not render when averageVad is undefined', () => {
    const { container } = render(
      <VadDisplay chunkIndex={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render VAD display with high level styling', () => {
    render(
      <VadDisplay 
        averageVad={0.85} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    const vadDisplay = screen.getByText('Voice Activity Detection').closest('.vad-display');
    expect(vadDisplay).toHaveAttribute('data-vad-level', 'high');
    expect(screen.getByText('0.850')).toBeInTheDocument();
    expect(screen.getByText('🟢 Strong Voice Activity')).toBeInTheDocument();
  });

  it('should render VAD display with medium level styling', () => {
    render(
      <VadDisplay 
        averageVad={0.50} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    const vadDisplay = screen.getByText('Voice Activity Detection').closest('.vad-display');
    expect(vadDisplay).toHaveAttribute('data-vad-level', 'medium');
    expect(screen.getByText('🟡 Moderate Voice Activity')).toBeInTheDocument();
  });

  it('should render VAD display with low level styling', () => {
    render(
      <VadDisplay 
        averageVad={0.15} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    const vadDisplay = screen.getByText('Voice Activity Detection').closest('.vad-display');
    expect(vadDisplay).toHaveAttribute('data-vad-level', 'low');
    expect(screen.getByText('🔴 Low Voice Activity')).toBeInTheDocument();
  });

  it('should display voice detected percentage when vadData is provided', () => {
    render(
      <VadDisplay 
        averageVad={0.60} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    expect(screen.getByText('Voice Detected')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });

  it('should display peak VAD when vadData is provided', () => {
    render(
      <VadDisplay 
        averageVad={0.60} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    expect(screen.getByText('Peak VAD')).toBeInTheDocument();
    expect(screen.getByText('0.900')).toBeInTheDocument();
  });

  it('should render progress bar with correct width', () => {
    const { container } = render(
      <VadDisplay 
        averageVad={0.75} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    const progressBar = container.querySelector('.vad-metric__fill');
    expect(progressBar).toHaveStyle({ width: '75%' });
  });

  it('should have proper accessibility attributes', () => {
    render(
      <VadDisplay 
        averageVad={0.65} 
        vadData={mockVadData}
        chunkIndex={0}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '65');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'Voice activity 65.0%');
  });
});