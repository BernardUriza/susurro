import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { VadTimeline } from '../vad-timeline/vad-timeline';

describe('VadTimeline - Renderizado sin interacción del usuario', () => {
  const mockVadData = [
    { time: 0, vad: 0.1 },
    { time: 0.5, vad: 0.8 },
    { time: 1.0, vad: 0.6 },
    { time: 1.5, vad: 0.2 },
  ];

  it('debe marcar el gráfico como cargado sin depender de onMouseEnter', async () => {
    const { container } = render(
      <VadTimeline vadData={mockVadData} chunkId="test-chunk-1" />
    );

    // Verificar que el loading overlay desaparece después del timeout
    await waitFor(() => {
      const loadingOverlay = container.querySelector('.vad-chart-loading-overlay');
      expect(loadingOverlay).not.toBeInTheDocument();
    }, { timeout: 4000 });

    // Verificar que las estadísticas se muestran
    expect(screen.getByText(/Voice Detected:/)).toBeInTheDocument();
    expect(screen.getByText(/Peak VAD:/)).toBeInTheDocument();
  });

  it('debe renderizar correctamente con datos vacíos', () => {
    render(<VadTimeline vadData={[]} chunkId="test-chunk-2" />);
    
    expect(screen.getByText('Analizando actividad de voz, por favor espera...')).toBeInTheDocument();
  });

  it('debe calcular estadísticas correctamente', () => {
    render(<VadTimeline vadData={mockVadData} chunkId="test-chunk-3" />);
    
    // 2 de 4 puntos tienen vad > 0.5, entonces 50%
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    // Peak VAD debe ser 0.8
    expect(screen.getByText('0.800')).toBeInTheDocument();
  });
});