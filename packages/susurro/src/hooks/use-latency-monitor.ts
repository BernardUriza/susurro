import { useState, useCallback, useEffect, useRef } from 'react';
import { LatencyMonitor, type LatencyMetrics, type LatencyReport } from '../lib/latency-monitor';

interface UseLatencyMonitorReturn {
  latencyReport: LatencyReport;
  latencyStatus: {
    isHealthy: boolean;
    currentLatency: number;
    trend: 'improving' | 'degrading' | 'stable';
    lastOptimization?: string;
  };
  recordMetrics: (metrics: Omit<LatencyMetrics, 'timestamp'>) => void;
  exportMetrics: (format?: 'json' | 'csv') => string;
  clear: () => void;
  getMetricsCount: () => number;
  onOptimization: (listener: (data: any) => void) => void;
  offOptimization: (listener: (data: any) => void) => void;
}

/**
 * Hook-based latency monitor
 * Replaces the singleton latencyMonitor with modern React patterns
 */
export function useLatencyMonitor(targetLatency = 300): UseLatencyMonitorReturn {
  const monitorRef = useRef<LatencyMonitor | null>(null);
  const [latencyReport, setLatencyReport] = useState<LatencyReport>(() => {
    if (!monitorRef.current) {
      monitorRef.current = new LatencyMonitor(targetLatency);
    }
    return monitorRef.current.generateReport();
  });
  const [latencyStatus, setLatencyStatus] = useState(() => {
    if (!monitorRef.current) {
      monitorRef.current = new LatencyMonitor(targetLatency);
    }
    return monitorRef.current.getRealtimeStatus();
  });

  // Initialize monitor if not already done
  useEffect(() => {
    if (!monitorRef.current) {
      monitorRef.current = new LatencyMonitor(targetLatency);
    }
  }, [targetLatency]);

  // Record metrics
  const recordMetrics = useCallback((metrics: Omit<LatencyMetrics, 'timestamp'>) => {
    if (monitorRef.current) {
      monitorRef.current.recordMetrics(metrics);
      // Update status immediately after recording
      setLatencyStatus(monitorRef.current.getRealtimeStatus());
    }
  }, []);

  // Export metrics
  const exportMetrics = useCallback((format: 'json' | 'csv' = 'json'): string => {
    if (monitorRef.current) {
      return monitorRef.current.exportMetrics(format);
    }
    return format === 'json' ? '[]' : '';
  }, []);

  // Clear metrics
  const clear = useCallback(() => {
    if (monitorRef.current) {
      monitorRef.current.clear();
      setLatencyReport(monitorRef.current.generateReport());
      setLatencyStatus(monitorRef.current.getRealtimeStatus());
    }
  }, []);

  // Get metrics count
  const getMetricsCount = useCallback((): number => {
    if (monitorRef.current) {
      return monitorRef.current.getMetricsCount();
    }
    return 0;
  }, []);

  // Optimization event listeners
  const onOptimization = useCallback((listener: (data: any) => void) => {
    if (monitorRef.current) {
      monitorRef.current.on('optimization-trigger', listener);
    }
  }, []);

  const offOptimization = useCallback((listener: (data: any) => void) => {
    if (monitorRef.current) {
      monitorRef.current.off('optimization-trigger', listener);
    }
  }, []);

  // Periodic report updates
  useEffect(() => {
    const updateLatencyReport = () => {
      if (monitorRef.current) {
        setLatencyReport(monitorRef.current.generateReport());
        setLatencyStatus(monitorRef.current.getRealtimeStatus());
      }
    };

    // Update every 10 seconds for real-time monitoring
    const interval = setInterval(updateLatencyReport, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    latencyReport,
    latencyStatus,
    recordMetrics,
    exportMetrics,
    clear,
    getMetricsCount,
    onOptimization,
    offOptimization,
  };
}