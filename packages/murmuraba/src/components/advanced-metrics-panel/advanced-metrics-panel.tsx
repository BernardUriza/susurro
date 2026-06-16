import React, { useMemo, useCallback } from 'react';
import type { DiagnosticInfo } from '../../types';

export interface IAdvancedMetricsPanelProps {
  /** Controls visibility of the panel */
  isVisible: boolean;
  /** Diagnostic information to display */
  diagnostics: DiagnosticInfo | null;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom aria-label for accessibility */
  'aria-label'?: string;
}

interface IMetricItemProps {
  label: string;
  value: string | React.ReactNode;
  'data-testid'?: string;
}

const MetricItem: React.FC<IMetricItemProps> = ({ label, value, 'data-testid': testId }) => (
  <div className="metric-item" data-testid={testId}>
    <span className="metric-label">{label}</span>
    <span className="metric-value">{value}</span>
  </div>
);

interface IPerformanceIndicatorProps {
  memoryUsage: number;
}

const PerformanceIndicator: React.FC<IPerformanceIndicatorProps> = ({ memoryUsage }) => {
  const performance = useMemo(() => {
    const memoryMB = memoryUsage / (1024 * 1024);
    
    if (memoryMB < 50) return { level: 'good', text: '🟢 Good' };
    if (memoryMB < 100) return { level: 'moderate', text: '🟡 Moderate' };
    return { level: 'high', text: '🔴 High' };
  }, [memoryUsage]);

  return (
    <span className={`performance-indicator performance-indicator--${performance.level}`}>
      {performance.text}
    </span>
  );
};

interface IPanelHeaderProps {
  onClose: () => void;
}

const PanelHeader: React.FC<IPanelHeaderProps> = ({ onClose }) => {
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <header className="panel-header">
      <h2 className="panel-title">🔬 Engine Diagnostics</h2>
      <button
        type="button"
        className="panel-close-button"
        onClick={onClose}
        onKeyDown={handleKeyDown}
        aria-label="Close diagnostics panel"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </header>
  );
};

/**
 * Advanced metrics panel displaying comprehensive engine diagnostics
 * with full accessibility support and clean architecture.
 */
export function AdvancedMetricsPanel({
  isVisible,
  diagnostics,
  onClose,
  className = '',
  'aria-label': ariaLabel,
}: IAdvancedMetricsPanelProps) {
  // Handle escape key at panel level
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Format memory usage safely
  const formatMemoryUsage = useCallback((bytes: number): string => {
    const megabytes = bytes / (1024 * 1024);
    return `${megabytes.toFixed(2)} MB`;
  }, []);

  // Format processing time safely  
  const formatProcessingTime = useCallback((time: number): string => {
    return `${time.toFixed(2)}ms`;
  }, []);

  // Early returns for non-display states
  if (!isVisible || !diagnostics) {
    return null;
  }

  // Safe browser info access
  const browserName = diagnostics.browserInfo?.name || 'Unknown';
  const audioAPIsSupported = diagnostics.browserInfo?.audioAPIsSupported ?? [];

  return (
    <div
      className={`advanced-metrics-panel ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || 'Engine Diagnostics Panel'}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="panel-backdrop" onClick={onClose} aria-hidden="true" />
      
      <div className="panel-container">
        <PanelHeader onClose={onClose} />
        
        <main className="panel-content">
          <div className="metrics-grid" role="grid">
            
            <MetricItem 
              label="Version:" 
              value={diagnostics.engineVersion}
              data-testid="metric-version"
            />
            
            <MetricItem 
              label="WASM Status:" 
              value={diagnostics.wasmLoaded ? '✅ Loaded' : '❌ Not Loaded'}
              data-testid="metric-wasm-status"
            />
            
            <MetricItem 
              label="Active Processors:" 
              value={diagnostics.activeProcessors.toString()}
              data-testid="metric-active-processors"
            />
            
            <MetricItem 
              label="Memory Usage:" 
              value={formatMemoryUsage(diagnostics.memoryUsage)}
              data-testid="metric-memory-usage"
            />
            
            <MetricItem 
              label="Processing Time:" 
              value={formatProcessingTime(diagnostics.processingTime)}
              data-testid="metric-processing-time"
            />
            
            <MetricItem 
              label="Engine State:" 
              value={<span className="engine-state">{diagnostics.engineState}</span>}
              data-testid="metric-engine-state"
            />
            
            <MetricItem 
              label="Browser:" 
              value={browserName}
              data-testid="metric-browser"
            />
            
            <MetricItem 
              label="Audio APIs:" 
              value={audioAPIsSupported.length > 0 ? `✅ ${audioAPIsSupported.join(', ')}` : '❌ Limited'}
              data-testid="metric-audio-apis"
            />
            
            <MetricItem 
              label="Performance:" 
              value={<PerformanceIndicator memoryUsage={diagnostics.memoryUsage} />}
              data-testid="metric-performance"
            />
            
            <MetricItem 
              label="Buffer Usage:" 
              value={diagnostics.bufferUsage ? `${diagnostics.bufferUsage.toFixed(1)}%` : 'N/A'}
              data-testid="metric-buffer-usage"
            />
            
            <MetricItem 
              label="Current Latency:" 
              value={diagnostics.currentLatency ? `${diagnostics.currentLatency.toFixed(1)}ms` : 'N/A'}
              data-testid="metric-current-latency"
            />
            
            <MetricItem 
              label="Frame Rate:" 
              value={diagnostics.frameRate ? `${diagnostics.frameRate.toFixed(1)} fps` : 'N/A'}
              data-testid="metric-frame-rate"
            />
            
            <MetricItem 
              label="Active Streams:" 
              value={diagnostics.activeStreams?.toString() || '0'}
              data-testid="metric-active-streams"
            />
            
            <MetricItem 
              label="Noise Reduction:" 
              value={diagnostics.noiseReductionLevel ? `${(diagnostics.noiseReductionLevel * 100).toFixed(1)}%` : 'N/A'}
              data-testid="metric-noise-reduction"
            />
            
            <MetricItem 
              label="Audio Quality:" 
              value={diagnostics.audioQuality || 'Standard'}
              data-testid="metric-audio-quality"
            />
            
          </div>
        </main>
      </div>
    </div>
  );
}