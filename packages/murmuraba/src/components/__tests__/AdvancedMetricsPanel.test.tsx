import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdvancedMetricsPanel } from '../advanced-metrics-panel/advanced-metrics-panel';
import type { DiagnosticInfo } from '../../types/audio-types';

// Mock diagnostic data for testing
const createMockDiagnostics = (overrides: Partial<DiagnosticInfo> = {}): DiagnosticInfo => ({
  engineVersion: '1.4.0',
  wasmLoaded: true,
  activeProcessors: 2,
  memoryUsage: 25 * 1024 * 1024, // 25MB
  processingTime: 15.5,
  engineState: 'ready',
  browserInfo: {
    name: 'Chrome',
    version: '91.0',
    audioAPIsSupported: ['AudioContext', 'AudioWorklet'],
  },
  ...overrides,
});

describe('AdvancedMetricsPanel TDD Tests', () => {
  let mockOnClose: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockOnClose = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Visibility and Basic Rendering', () => {
    it('should not render when isVisible is false', () => {
      const { container } = render(
        <AdvancedMetricsPanel
          isVisible={false}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('should not render when diagnostics is null', () => {
      const { container } = render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={null}
          onClose={mockOnClose}
        />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('should render when both isVisible is true and diagnostics exists', () => {
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('🔬 Engine Diagnostics')).toBeInTheDocument();
    });

    it('should render with proper structure', () => {
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      // Check for main dialog container
      const panel = screen.getByRole('dialog', { name: /engine diagnostics/i });
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveClass('advanced-metrics-panel');
    });
  });

  describe('Header and Close Functionality', () => {
    it('should display correct header title', () => {
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('🔬 Engine Diagnostics')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveTextContent('✕');
    });

    it('should call onClose when close button is clicked', () => {
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  describe('Diagnostics Data Display', () => {
    it('should display engine version', () => {
      const diagnostics = createMockDiagnostics({ engineVersion: '1.5.0' });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Version:/)).toBeInTheDocument();
      expect(screen.getByText(/1\.5\.0/)).toBeInTheDocument();
    });

    it('should display WASM status - loaded', () => {
      const diagnostics = createMockDiagnostics({ wasmLoaded: true });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/WASM Status:/)).toBeInTheDocument();
      expect(screen.getByText(/✅ Loaded/)).toBeInTheDocument();
    });

    it('should display WASM status - not loaded', () => {
      const diagnostics = createMockDiagnostics({ wasmLoaded: false });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/❌ Not Loaded/)).toBeInTheDocument();
    });

    it('should display active processors count', () => {
      const diagnostics = createMockDiagnostics({ activeProcessors: 5 });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Active Processors:/)).toBeInTheDocument();
      expect(screen.getByText(/^5$/)).toBeInTheDocument();
    });

    it('should display memory usage in MB', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 42 * 1024 * 1024 // 42MB
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Memory Usage:/)).toBeInTheDocument();
      expect(screen.getByText(/42\.00 MB/)).toBeInTheDocument();
    });

    it('should display processing time with decimal precision', () => {
      const diagnostics = createMockDiagnostics({ processingTime: 123.456 });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Processing Time:/)).toBeInTheDocument();
      expect(screen.getByText(/123\.46ms/)).toBeInTheDocument();
    });

    it('should display engine state', () => {
      const diagnostics = createMockDiagnostics({ engineState: 'processing' });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Engine State:/)).toBeInTheDocument();
      expect(screen.getByText(/^processing$/)).toBeInTheDocument();
    });
  });

  describe('Browser Information', () => {
    it('should display browser name when available', () => {
      const diagnostics = createMockDiagnostics({
        browserInfo: { name: 'Firefox', audioAPIsSupported: ['AudioContext'] }
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Browser:/)).toBeInTheDocument();
      expect(screen.getByText(/^Firefox$/)).toBeInTheDocument();
    });

    it('should display Unknown when browser name is not available', () => {
      const diagnostics = createMockDiagnostics({
        browserInfo: { audioAPIsSupported: ['AudioContext'] }
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/^Unknown$/)).toBeInTheDocument();
    });

    it('should display Unknown when browserInfo is null', () => {
      const diagnostics = createMockDiagnostics({
        browserInfo: null as any
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/^Unknown$/)).toBeInTheDocument();
    });

    it('should display audio APIs supported status - supported', () => {
      const diagnostics = createMockDiagnostics({
        browserInfo: { name: 'Chrome', audioAPIsSupported: ['AudioContext', 'AudioWorklet'] }
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Audio APIs:/)).toBeInTheDocument();
      expect(screen.getByText(/✅ Supported/)).toBeInTheDocument();
    });

    it('should display audio APIs supported status - limited', () => {
      const diagnostics = createMockDiagnostics({
        browserInfo: { name: 'Safari', audioAPIsSupported: [] }
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/❌ Limited/)).toBeInTheDocument();
    });
  });

  describe('Performance Indicators', () => {
    it('should show Good performance for low memory usage', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 30 * 1024 * 1024 // 30MB < 50MB threshold
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/Performance:/)).toBeInTheDocument();
      expect(screen.getByText(/🟢 Good/)).toBeInTheDocument();
    });

    it('should show Moderate performance for medium memory usage', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 75 * 1024 * 1024 // 75MB between 50MB and 100MB
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/🟡 Moderate/)).toBeInTheDocument();
    });

    it('should show High performance warning for high memory usage', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 150 * 1024 * 1024 // 150MB > 100MB threshold
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/🔴 High/)).toBeInTheDocument();
    });

    it('should handle edge case at 50MB threshold', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 50 * 1024 * 1024 // Exactly 50MB
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/🟡 Moderate/)).toBeInTheDocument();
    });

    it('should handle edge case at 100MB threshold', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 100 * 1024 * 1024 // Exactly 100MB
      });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/🔴 High/)).toBeInTheDocument();
    });
  });

  describe('Uptime Display', () => {
    it('should display uptime status as Active', () => {
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('Uptime:')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing browserInfo gracefully', () => {
      const diagnostics = createMockDiagnostics({
        browserInfo: undefined as any
      });
      
      expect(() => {
        render(
          <AdvancedMetricsPanel
            isVisible={true}
            diagnostics={diagnostics}
            onClose={mockOnClose}
          />
        );
      }).not.toThrow();
    });

    it('should handle zero memory usage', () => {
      const diagnostics = createMockDiagnostics({ memoryUsage: 0 });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('0.00 MB')).toBeInTheDocument();
      expect(screen.getByText('🟢 Good')).toBeInTheDocument();
    });

    it('should handle negative memory usage', () => {
      const diagnostics = createMockDiagnostics({ memoryUsage: -1000 });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('-0.00 MB')).toBeInTheDocument();
    });

    it('should handle zero processing time', () => {
      const diagnostics = createMockDiagnostics({ processingTime: 0 });
      
      render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={diagnostics}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('0.00ms')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      const diagnostics = createMockDiagnostics({ 
        memoryUsage: 999999999999,
        processingTime: 999999.999,
        activeProcessors: 999999
      });
      
      expect(() => {
        render(
          <AdvancedMetricsPanel
            isVisible={true}
            diagnostics={diagnostics}
            onClose={mockOnClose}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Component Unmounting', () => {
    it('should unmount cleanly without errors', () => {
      const { unmount } = render(
        <AdvancedMetricsPanel
          isVisible={true}
          diagnostics={createMockDiagnostics()}
          onClose={mockOnClose}
        />
      );
      
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});