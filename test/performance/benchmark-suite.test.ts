/**
 * Performance Benchmark Suite - Phase 3 Conversational Evolution
 * Measures v2 vs v3 performance, neural processing effectiveness, and memory usage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSusurro } from '../../packages/susurro/src';
import { latencyMonitor } from '../../packages/susurro/src/lib/latency-monitor';
import { renderHook, act } from '@testing-library/react';

interface BenchmarkResults {
  latency: {
    average: number;
    p95: number;
    p99: number;
    median: number;
    targetMet: boolean;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  performance: {
    audioProcessing: number;
    transcription: number;
    middleware: number;
    totalTime: number;
  };
  neural: {
    vadAccuracy: number;
    noiseReduction: number;
    audioQuality: number;
  };
}

interface ComparisonResults {
  v3: BenchmarkResults;
  v2Legacy: BenchmarkResults;
  improvement: {
    latencyReduction: number;
    memoryEfficiency: number;
    processingSpeedup: number;
    neuralEnhancement: number;
  };
}

describe('Performance Benchmark Suite - Phase 3', () => {
  let mockAudioBlob: Blob;
  let performanceStartTime: number;

  beforeEach(() => {
    // Clear previous metrics
    latencyMonitor.clear();
    
    // Create mock audio data for testing
    const mockAudioData = new ArrayBuffer(44100 * 2 * 5); // 5 seconds of 16-bit audio at 44.1kHz
    mockAudioBlob = new Blob([mockAudioData], { type: 'audio/wav' });
    
    performanceStartTime = performance.now();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    latencyMonitor.clear();
  });

  describe('V3 Performance Benchmarks', () => {
    it('should achieve <300ms average latency', async () => {
      const { result } = renderHook(() => useSusurro({
        chunkDurationMs: 6000,
        conversational: {
          onChunk: (chunk) => {
            // Chunk processing callback for latency measurement
            expect(chunk.processingLatency).toBeDefined();
            if (chunk.processingLatency) {
              expect(chunk.processingLatency).toBeLessThan(300);
            }
          },
          enableInstantTranscription: true,
          chunkTimeout: 3000,
        },
      }));

      await act(async () => {
        // Simulate recording and processing
        await result.current.startRecording();
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        result.current.stopRecording();
      });

      const latencyReport = result.current.latencyReport;
      
      expect(latencyReport.averageLatency).toBeLessThan(300);
      expect(latencyReport.targetMet).toBe(true);
      expect(latencyReport.p95Latency).toBeLessThan(500);
    });

    it('should maintain memory efficiency during long sessions', async () => {
      const initialMemory = process.memoryUsage();
      
      const { result } = renderHook(() => useSusurro({
        conversational: {
          onChunk: () => {},
          enableInstantTranscription: true,
        },
      }));

      // Simulate processing 50 chunks
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          await result.current.transcribeWithWhisper(mockAudioBlob);
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (< 100MB for 50 chunks)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Clear and check for proper cleanup
      act(() => {
        result.current.clearConversationalChunks();
      });

      if (global.gc) {
        global.gc();
      }

      const cleanupMemory = process.memoryUsage();
      const postCleanupIncrease = cleanupMemory.heapUsed - initialMemory.heapUsed;
      
      // After cleanup, memory should be closer to initial
      expect(postCleanupIncrease).toBeLessThan(memoryIncrease * 0.5);
    });

    it('should demonstrate neural processing effectiveness', async () => {
      const { result } = renderHook(() => useSusurro({
        conversational: {
          onChunk: (chunk) => {
            // Neural processing should provide good VAD scores
            expect(chunk.vadScore).toBeGreaterThan(0);
            expect(chunk.vadScore).toBeLessThanOrEqual(1);
            
            // Check for neural enhancement metadata
            if (chunk.metadata?.audioQuality) {
              expect(chunk.metadata.audioQuality).toBeGreaterThan(0.5);
            }
          },
          enableInstantTranscription: true,
        },
      }));

      await act(async () => {
        await result.current.startRecording();
        await new Promise(resolve => setTimeout(resolve, 2000));
        result.current.stopRecording();
      });

      const chunks = result.current.conversationalChunks;
      expect(chunks.length).toBeGreaterThan(0);
      
      // Calculate average VAD score
      const avgVadScore = chunks.reduce((sum, chunk) => sum + chunk.vadScore, 0) / chunks.length;
      expect(avgVadScore).toBeGreaterThan(0.3); // Should have reasonable voice activity
    });
  });

  describe('Middleware Performance Impact', () => {
    it('should measure middleware processing overhead', async () => {
      const middlewareResults: { [key: string]: number[] } = {};

      const { result } = renderHook(() => useSusurro({
        conversational: {
          onChunk: (chunk) => {
            if (chunk.metadata?.middlewareLatencies) {
              Object.entries(chunk.metadata.middlewareLatencies).forEach(([name, latency]) => {
                if (!middlewareResults[name]) {
                  middlewareResults[name] = [];
                }
                middlewareResults[name].push(latency as number);
              });
            }
          },
          enableInstantTranscription: true,
        },
      }));

      // Enable all middleware for testing
      act(() => {
        result.current.middlewarePipeline.enable('quality');
        result.current.middlewarePipeline.enable('sentiment');
        result.current.middlewarePipeline.enable('intent');
      });

      await act(async () => {
        await result.current.startRecording();
        await new Promise(resolve => setTimeout(resolve, 3000));
        result.current.stopRecording();
      });

      // Verify middleware latencies are reasonable
      Object.entries(middlewareResults).forEach(([name, latencies]) => {
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        
        if (name === 'quality') {
          expect(avgLatency).toBeLessThan(10); // Quality middleware should be fast
        } else {
          expect(avgLatency).toBeLessThan(50); // Other middleware should be reasonable
        }
      });
    });

    it('should validate middleware can be disabled for performance', async () => {
      const withMiddlewareResults: number[] = [];
      const withoutMiddlewareResults: number[] = [];

      // Test with middleware enabled
      const { result: withMiddleware } = renderHook(() => useSusurro({
        conversational: {
          onChunk: (chunk) => {
            if (chunk.processingLatency) {
              withMiddlewareResults.push(chunk.processingLatency);
            }
          },
          enableInstantTranscription: true,
        },
      }));

      act(() => {
        withMiddleware.current.middlewarePipeline.enable('sentiment');
        withMiddleware.current.middlewarePipeline.enable('intent');
      });

      await act(async () => {
        await withMiddleware.current.startRecording();
        await new Promise(resolve => setTimeout(resolve, 2000));
        withMiddleware.current.stopRecording();
      });

      // Test with middleware disabled
      const { result: withoutMiddleware } = renderHook(() => useSusurro({
        conversational: {
          onChunk: (chunk) => {
            if (chunk.processingLatency) {
              withoutMiddlewareResults.push(chunk.processingLatency);
            }
          },
          enableInstantTranscription: true,
        },
      }));

      act(() => {
        withoutMiddleware.current.middlewarePipeline.disable('sentiment');
        withoutMiddleware.current.middlewarePipeline.disable('intent');
      });

      await act(async () => {
        await withoutMiddleware.current.startRecording();
        await new Promise(resolve => setTimeout(resolve, 2000));
        withoutMiddleware.current.stopRecording();
      });

      if (withMiddlewareResults.length > 0 && withoutMiddlewareResults.length > 0) {
        const avgWithMiddleware = withMiddlewareResults.reduce((a, b) => a + b, 0) / withMiddlewareResults.length;
        const avgWithoutMiddleware = withoutMiddlewareResults.reduce((a, b) => a + b, 0) / withoutMiddlewareResults.length;

        // Without middleware should be faster
        expect(avgWithoutMiddleware).toBeLessThan(avgWithMiddleware);
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid chunk processing without memory leaks', async () => {
      const initialMemory = process.memoryUsage();
      let processedChunks = 0;

      const { result } = renderHook(() => useSusurro({
        chunkDurationMs: 1000, // Very short chunks for stress testing
        conversational: {
          onChunk: () => {
            processedChunks++;
          },
          enableInstantTranscription: true,
        },
      }));

      await act(async () => {
        await result.current.startRecording();
        
        // Run for 10 seconds to generate many chunks
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        result.current.stopRecording();
      });

      expect(processedChunks).toBeGreaterThan(5); // Should have processed multiple chunks

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory per chunk should be reasonable
      const memoryPerChunk = memoryIncrease / processedChunks;
      expect(memoryPerChunk).toBeLessThan(10 * 1024 * 1024); // < 10MB per chunk
    });

    it('should maintain performance under concurrent operations', async () => {
      const results: Array<{ latency: number; success: boolean }> = [];

      // Create multiple concurrent instances
      const hooks = Array.from({ length: 3 }, () => 
        renderHook(() => useSusurro({
          conversational: {
            onChunk: (chunk) => {
              results.push({
                latency: chunk.processingLatency || 0,
                success: chunk.isComplete,
              });
            },
            enableInstantTranscription: true,
          },
        }))
      );

      // Start all recordings concurrently
      await Promise.all(hooks.map(async ({ result }) => {
        await act(async () => {
          await result.current.startRecording();
        });
      }));

      // Let them run for a bit
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Stop all recordings
      await Promise.all(hooks.map(({ result }) => {
        act(() => {
          result.current.stopRecording();
        });
      }));

      if (results.length > 0) {
        const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
        const successRate = results.filter(r => r.success).length / results.length;

        // Even under load, performance should be reasonable
        expect(avgLatency).toBeLessThan(1000); // 1 second max under stress
        expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate
      }
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance report', async () => {
      const { result } = renderHook(() => useSusurro({
        conversational: {
          onChunk: () => {},
          enableInstantTranscription: true,
        },
      }));

      await act(async () => {
        await result.current.startRecording();
        await new Promise(resolve => setTimeout(resolve, 5000));
        result.current.stopRecording();
      });

      const report = result.current.latencyReport;

      // Report should have all required fields
      expect(report).toHaveProperty('averageLatency');
      expect(report).toHaveProperty('p95Latency');
      expect(report).toHaveProperty('p99Latency');
      expect(report).toHaveProperty('targetMet');
      expect(report).toHaveProperty('breakdown');

      // Breakdown should have timing information
      expect(report.breakdown).toHaveProperty('audioProcessing');
      expect(report.breakdown).toHaveProperty('transcription');
      expect(report.breakdown).toHaveProperty('middleware');

      // Generate benchmark summary
      const benchmarkSummary = {
        timestamp: new Date().toISOString(),
        testDuration: performance.now() - performanceStartTime,
        latencyReport: report,
        memoryUsage: process.memoryUsage(),
        status: report.targetMet ? 'PASS' : 'FAIL',
      };

      expect(benchmarkSummary.status).toBe('PASS');
    });
  });
});

// Utility functions for benchmark comparison
export function generatePerformanceReport(
  v3Results: BenchmarkResults,
  v2Results?: BenchmarkResults
): ComparisonResults | BenchmarkResults {
  if (!v2Results) {
    return v3Results;
  }

  return {
    v3: v3Results,
    v2Legacy: v2Results,
    improvement: {
      latencyReduction: ((v2Results.latency.average - v3Results.latency.average) / v2Results.latency.average) * 100,
      memoryEfficiency: ((v2Results.memory.heapUsed - v3Results.memory.heapUsed) / v2Results.memory.heapUsed) * 100,
      processingSpeedup: ((v2Results.performance.totalTime - v3Results.performance.totalTime) / v2Results.performance.totalTime) * 100,
      neuralEnhancement: ((v3Results.neural.vadAccuracy - v2Results.neural.vadAccuracy) / v2Results.neural.vadAccuracy) * 100,
    },
  };
}

export function exportBenchmarkResults(results: ComparisonResults | BenchmarkResults, format: 'json' | 'csv' = 'json'): string {
  if (format === 'csv') {
    // Simple CSV export for spreadsheet analysis
    const headers = ['Metric', 'v3_Value', 'v2_Value', 'Improvement'];
    const rows = [];

    if ('improvement' in results) {
      rows.push(['Average Latency (ms)', results.v3.latency.average, results.v2Legacy.latency.average, `${results.improvement.latencyReduction.toFixed(1)}%`]);
      rows.push(['Memory Usage (MB)', (results.v3.memory.heapUsed / 1024 / 1024).toFixed(1), (results.v2Legacy.memory.heapUsed / 1024 / 1024).toFixed(1), `${results.improvement.memoryEfficiency.toFixed(1)}%`]);
      rows.push(['Processing Speed', results.v3.performance.totalTime, results.v2Legacy.performance.totalTime, `${results.improvement.processingSpeedup.toFixed(1)}%`]);
    }

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  return JSON.stringify(results, null, 2);
}