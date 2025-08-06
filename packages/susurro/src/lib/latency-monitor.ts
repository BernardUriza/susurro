// Latency Monitor - High-precision latency measurement and optimization
// Part of Murmuraba v3 Conversational Evolution - Phase 3

export interface LatencyMetrics {
  audioToEmitLatency: number; // Total audio-to-emit latency
  audioProcessingLatency: number; // Murmuraba processing time
  transcriptionLatency: number; // Whisper transcription time
  middlewareLatency: number; // Middleware processing time
  chunkId: string;
  timestamp: number;
  vadScore?: number;
  audioSize?: number; // Blob size in bytes
}

export interface LatencyReport {
  averageLatency: number;
  medianLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  targetMet: boolean; // <300ms achieved?
  sampleCount: number;
  timeRange: { start: number; end: number };
  breakdown: {
    audioProcessing: number;
    transcription: number;
    middleware: number;
  };
}

export interface PerformanceOptimization {
  name: string;
  description: string;
  expectedLatencyReduction: number; // Expected reduction in ms
  condition: (metrics: LatencyMetrics) => boolean;
  apply: () => Promise<void>;
}

export class LatencyMonitor {
  private metrics: LatencyMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 measurements
  private target = 300; // Target latency in ms
  private optimizations: PerformanceOptimization[] = [];

  constructor(targetLatency = 300) {
    this.target = targetLatency;
    this.setupOptimizations();
  }

  recordMetrics(metrics: Omit<LatencyMetrics, 'timestamp'>): void {
    const fullMetrics: LatencyMetrics = {
      ...metrics,
      timestamp: performance.now(),
    };

    this.metrics.push(fullMetrics);

    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Real-time optimization triggers
    this.checkForOptimizations(fullMetrics);
  }

  generateReport(lastNMinutes = 5): LatencyReport {
    const cutoffTime = performance.now() - lastNMinutes * 60 * 1000;
    const recentMetrics = this.metrics.filter((m) => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return this.getEmptyReport();
    }

    const latencies = recentMetrics.map((m) => m.audioToEmitLatency).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      averageLatency: avgLatency,
      medianLatency: this.getPercentile(latencies, 50),
      p95Latency: this.getPercentile(latencies, 95),
      p99Latency: this.getPercentile(latencies, 99),
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
      targetMet: avgLatency < this.target,
      sampleCount: recentMetrics.length,
      timeRange: {
        start: recentMetrics[0].timestamp,
        end: recentMetrics[recentMetrics.length - 1].timestamp,
      },
      breakdown: {
        audioProcessing: this.calculateAverageBreakdown(recentMetrics, 'audioProcessingLatency'),
        transcription: this.calculateAverageBreakdown(recentMetrics, 'transcriptionLatency'),
        middleware: this.calculateAverageBreakdown(recentMetrics, 'middlewareLatency'),
      },
    };
  }

  getRealtimeStatus(): {
    isHealthy: boolean;
    currentLatency: number;
    trend: 'improving' | 'degrading' | 'stable';
    lastOptimization?: string;
  } {
    if (this.metrics.length < 5) {
      return {
        isHealthy: true,
        currentLatency: 0,
        trend: 'stable',
      };
    }

    const recent = this.metrics.slice(-5);
    const currentLatency = recent[recent.length - 1].audioToEmitLatency;
    const previousLatency = recent[0].audioToEmitLatency;

    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    const trendThreshold = 50; // ms

    if (currentLatency < previousLatency - trendThreshold) {
      trend = 'improving';
    } else if (currentLatency > previousLatency + trendThreshold) {
      trend = 'degrading';
    }

    return {
      isHealthy: currentLatency < this.target,
      currentLatency,
      trend,
    };
  }

  private setupOptimizations(): void {
    // Optimization 1: Disable expensive middleware when latency is high
    this.optimizations.push({
      name: 'middleware-reduction',
      description: 'Disable non-essential middleware when latency > 400ms',
      expectedLatencyReduction: 100,
      condition: (metrics) => metrics.middlewareLatency > 100,
      apply: async () => {
        // Signal to disable non-essential middleware
        this.emit('optimization-trigger', {
          type: 'disable-middleware',
          target: ['sentiment', 'intent', 'translation'],
        });
      },
    });

    // Optimization 2: Reduce chunk size when transcription is slow
    this.optimizations.push({
      name: 'chunk-size-reduction',
      description: 'Reduce chunk size when transcription latency > 200ms',
      expectedLatencyReduction: 80,
      condition: (metrics) => metrics.transcriptionLatency > 200,
      apply: async () => {
        this.emit('optimization-trigger', {
          type: 'reduce-chunk-size',
          newSize: 6000, // Reduce from 8s to 6s
        });
      },
    });

    // Optimization 3: Parallel processing when audio processing is slow
    this.optimizations.push({
      name: 'parallel-processing',
      description: 'Enable parallel processing when audio processing > 150ms',
      expectedLatencyReduction: 60,
      condition: (metrics) => metrics.audioProcessingLatency > 150,
      apply: async () => {
        this.emit('optimization-trigger', {
          type: 'enable-parallel-processing',
        });
      },
    });
  }

  private checkForOptimizations(metrics: LatencyMetrics): void {
    if (metrics.audioToEmitLatency <= this.target) return;

    for (const optimization of this.optimizations) {
      if (optimization.condition(metrics)) {
        console.warn(`Latency optimization triggered: ${optimization.name}`);
        optimization.apply().catch(console.error);
        break; // Apply only one optimization at a time
      }
    }
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private calculateAverageBreakdown(
    metrics: LatencyMetrics[],
    field: keyof LatencyMetrics
  ): number {
    const values = metrics.map((m) => m[field] as number).filter((v) => typeof v === 'number');
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private getEmptyReport(): LatencyReport {
    return {
      averageLatency: 0,
      medianLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      minLatency: 0,
      maxLatency: 0,
      targetMet: true,
      sampleCount: 0,
      timeRange: { start: 0, end: 0 },
      breakdown: {
        audioProcessing: 0,
        transcription: 0,
        middleware: 0,
      },
    };
  }

  // Simple event emitter for optimization triggers
  private listeners: { [event: string]: Function[] } = {};

  private emit(event: string, data: unknown): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => listener(data));
    }
  }

  on(event: string, listener: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
    }
  }

  // Export metrics for analysis
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'chunkId',
        'audioToEmitLatency',
        'audioProcessingLatency',
        'transcriptionLatency',
        'middlewareLatency',
        'timestamp',
        'vadScore',
        'audioSize',
      ].join(',');

      const rows = this.metrics.map((m) =>
        [
          m.chunkId,
          m.audioToEmitLatency,
          m.audioProcessingLatency,
          m.transcriptionLatency,
          m.middlewareLatency,
          m.timestamp,
          m.vadScore || '',
          m.audioSize || '',
        ].join(',')
      );

      return [headers, ...rows].join('\n');
    }

    return JSON.stringify(this.metrics, null, 2);
  }

  // Clear metrics (useful for testing)
  clear(): void {
    this.metrics = [];
  }

  // Get current metrics count
  getMetricsCount(): number {
    return this.metrics.length;
  }
}

/**
 * @deprecated This singleton instance has been replaced with hook-based architecture.
 * Use useLatencyMonitor hook instead of this global instance.
 * This export will be removed in a future version.
 * 
 * Migration: Replace latencyMonitor usage with useLatencyMonitor hook.
 */
export const latencyMonitor = new LatencyMonitor();
