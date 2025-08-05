/**
 * Performance Analysis Tool - Phase 3 Conversational Evolution
 * Analyzes latency patterns, memory usage, and neural processing effectiveness
 */

import { latencyMonitor, type LatencyReport } from '../../packages/susurro/src/lib/latency-monitor';

export interface PerformanceAnalysis {
  timestamp: string;
  sessionDuration: number;
  totalChunksProcessed: number;
  latencyAnalysis: {
    current: LatencyReport;
    trends: {
      improving: boolean;
      degrading: boolean;
      stable: boolean;
    };
    bottlenecks: string[];
  };
  memoryAnalysis: {
    current: NodeJS.MemoryUsage;
    leakDetection: {
      hasLeak: boolean;
      severity: 'low' | 'medium' | 'high';
      details: string[];
    };
  };
  neuralProcessingAnalysis: {
    vadEffectiveness: number;
    averageQuality: number;
    noiseReductionImpact: number;
  };
  recommendations: string[];
}

export class PerformanceAnalyzer {
  private startTime: number;
  private sessionChunks: number = 0;
  private memorySnapshots: NodeJS.MemoryUsage[] = [];
  private vadScores: number[] = [];
  private qualityScores: number[] = [];

  constructor() {
    this.startTime = performance.now();
    this.captureMemorySnapshot();
  }

  recordChunkProcessed(vadScore?: number, qualityScore?: number): void {
    this.sessionChunks++;
    
    if (vadScore !== undefined) {
      this.vadScores.push(vadScore);
    }
    
    if (qualityScore !== undefined) {
      this.qualityScores.push(qualityScore);
    }

    // Capture memory snapshot every 10 chunks
    if (this.sessionChunks % 10 === 0) {
      this.captureMemorySnapshot();
    }
  }

  private captureMemorySnapshot(): void {
    this.memorySnapshots.push(process.memoryUsage());
    
    // Keep only last 20 snapshots to prevent memory bloat
    if (this.memorySnapshots.length > 20) {
      this.memorySnapshots = this.memorySnapshots.slice(-20);
    }
  }

  generateAnalysis(): PerformanceAnalysis {
    const currentTime = performance.now();
    const sessionDuration = currentTime - this.startTime;
    const latencyReport = latencyMonitor.generateReport();
    const latencyStatus = latencyMonitor.getRealtimeStatus();
    
    return {
      timestamp: new Date().toISOString(),
      sessionDuration,
      totalChunksProcessed: this.sessionChunks,
      latencyAnalysis: {
        current: latencyReport,
        trends: {
          improving: latencyStatus.trend === 'improving',
          degrading: latencyStatus.trend === 'degrading',
          stable: latencyStatus.trend === 'stable',
        },
        bottlenecks: this.identifyBottlenecks(latencyReport),
      },
      memoryAnalysis: {
        current: process.memoryUsage(),
        leakDetection: this.detectMemoryLeaks(),
      },
      neuralProcessingAnalysis: {
        vadEffectiveness: this.calculateVadEffectiveness(),
        averageQuality: this.calculateAverageQuality(),
        noiseReductionImpact: this.estimateNoiseReductionImpact(),
      },
      recommendations: this.generateRecommendations(latencyReport, latencyStatus),
    };
  }

  private identifyBottlenecks(report: LatencyReport): string[] {
    const bottlenecks: string[] = [];
    
    if (report.breakdown.audioProcessing > report.breakdown.transcription * 2) {
      bottlenecks.push('Audio processing is significantly slower than transcription');
    }
    
    if (report.breakdown.middleware > 100) {
      bottlenecks.push('Middleware processing is taking >100ms - consider disabling non-essential middleware');
    }
    
    if (report.breakdown.transcription > report.breakdown.audioProcessing * 3) {
      bottlenecks.push('Transcription is the primary bottleneck - consider model optimization');
    }
    
    if (report.p95Latency > report.averageLatency * 2) {
      bottlenecks.push('High latency variance detected - performance is inconsistent');
    }
    
    return bottlenecks;
  }

  private detectMemoryLeaks(): {
    hasLeak: boolean;
    severity: 'low' | 'medium' | 'high';
    details: string[];
  } {
    if (this.memorySnapshots.length < 3) {
      return {
        hasLeak: false,
        severity: 'low',
        details: ['Insufficient data for leak detection'],
      };
    }
    
    const firstSnapshot = this.memorySnapshots[0];
    const lastSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    const heapGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
    const heapGrowthRate = heapGrowth / this.sessionChunks; // Growth per chunk
    
    const details: string[] = [];
    let hasLeak = false;
    let severity: 'low' | 'medium' | 'high' = 'low';
    
    // Check for concerning memory growth patterns
    if (heapGrowthRate > 1024 * 1024) { // > 1MB per chunk
      hasLeak = true;
      severity = 'high';
      details.push(`High memory growth: ${(heapGrowthRate / 1024 / 1024).toFixed(2)}MB per chunk`);
    } else if (heapGrowthRate > 512 * 1024) { // > 512KB per chunk
      hasLeak = true;
      severity = 'medium';
      details.push(`Moderate memory growth detected`);
    }
    
    // Check external memory (native objects, ArrayBuffers)
    const externalGrowth = lastSnapshot.external - firstSnapshot.external;
    if (externalGrowth > heapGrowth) {
      details.push('External memory growth exceeds heap growth - potential native object leak');
    }
    
    // Check ArrayBuffer usage (audio data)
    const arrayBufferGrowth = lastSnapshot.arrayBuffers - firstSnapshot.arrayBuffers;
    if (arrayBufferGrowth > this.sessionChunks * 100 * 1024) { // > 100KB per chunk in ArrayBuffers
      details.push('High ArrayBuffer usage - audio chunks may not be properly cleaned up');
    }
    
    return { hasLeak, severity, details };
  }

  private calculateVadEffectiveness(): number {
    if (this.vadScores.length === 0) return 0;
    
    // Effectiveness based on:
    // 1. Average VAD score (higher is better for speech detection)
    // 2. Score distribution (consistent scores are better)
    const avgScore = this.vadScores.reduce((a, b) => a + b, 0) / this.vadScores.length;
    const variance = this.vadScores.reduce((acc, score) => acc + Math.pow(score - avgScore, 2), 0) / this.vadScores.length;
    const stdDev = Math.sqrt(variance);
    
    // Penalize high variance (inconsistent detection)
    const consistencyPenalty = Math.min(stdDev * 2, 0.3);
    
    return Math.max(0, avgScore - consistencyPenalty);
  }

  private calculateAverageQuality(): number {
    if (this.qualityScores.length === 0) return 0;
    return this.qualityScores.reduce((a, b) => a + b, 0) / this.qualityScores.length;
  }

  private estimateNoiseReductionImpact(): number {
    // Placeholder - would require before/after audio analysis
    // For now, estimate based on processing consistency
    if (this.vadScores.length < 2) return 0;
    
    const scoreStability = 1 - (Math.max(...this.vadScores) - Math.min(...this.vadScores));
    return Math.max(0, scoreStability * 0.8); // Assume good neural processing if scores are stable
  }

  private generateRecommendations(report: LatencyReport, status: any): string[] {
    const recommendations: string[] = [];
    
    // Latency recommendations
    if (!report.targetMet) {
      recommendations.push('🎯 CRITICAL: Average latency exceeds 300ms target');
      
      if (report.breakdown.middleware > 50) {
        recommendations.push('💡 Disable non-essential middleware to reduce latency');
      }
      
      if (report.breakdown.audioProcessing > report.breakdown.transcription) {
        recommendations.push('💡 Consider reducing chunk size to speed up audio processing');
      }
    }
    
    // Memory recommendations
    const memoryAnalysis = this.detectMemoryLeaks();
    if (memoryAnalysis.hasLeak) {
      if (memoryAnalysis.severity === 'high') {
        recommendations.push('🚨 HIGH SEVERITY: Memory leak detected - implement aggressive cleanup');
      } else {
        recommendations.push('⚠️ Memory usage growing - monitor and implement cleanup');
      }
    }
    
    // Neural processing recommendations
    const vadEffectiveness = this.calculateVadEffectiveness();
    if (vadEffectiveness < 0.5) {
      recommendations.push('🧠 VAD effectiveness is low - check audio input quality');
    }
    
    // Performance trend recommendations
    if (status.trend === 'degrading') {
      recommendations.push('📈 Performance is degrading - check for resource contention');
    } else if (status.trend === 'improving') {
      recommendations.push('✅ Performance is improving - current optimizations are working');
    }
    
    // General optimization recommendations
    if (this.sessionChunks > 100) {
      recommendations.push('💪 Long session detected - consider periodic cleanup');
    }
    
    if (report.sampleCount > 0 && report.p99Latency > report.averageLatency * 3) {
      recommendations.push('⚡ High latency spikes detected - investigate system resource usage');
    }
    
    return recommendations;
  }

  // Export analysis for external tools
  exportAnalysis(format: 'json' | 'csv' = 'json'): string {
    const analysis = this.generateAnalysis();
    
    if (format === 'csv') {
      const rows = [
        ['Metric', 'Value'],
        ['Session Duration (ms)', analysis.sessionDuration.toString()],
        ['Chunks Processed', analysis.totalChunksProcessed.toString()],
        ['Average Latency (ms)', analysis.latencyAnalysis.current.averageLatency.toString()],
        ['P95 Latency (ms)', analysis.latencyAnalysis.current.p95Latency.toString()],
        ['Target Met', analysis.latencyAnalysis.current.targetMet.toString()],
        ['Memory Usage (MB)', (analysis.memoryAnalysis.current.heapUsed / 1024 / 1024).toFixed(2)],
        ['Memory Leak Detected', analysis.memoryAnalysis.leakDetection.hasLeak.toString()],
        ['VAD Effectiveness', analysis.neuralProcessingAnalysis.vadEffectiveness.toFixed(3)],
        ['Average Quality', analysis.neuralProcessingAnalysis.averageQuality.toFixed(3)],
      ];
      
      return rows.map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(analysis, null, 2);
  }

  // Reset analyzer for new session
  reset(): void {
    this.startTime = performance.now();
    this.sessionChunks = 0;
    this.memorySnapshots = [];
    this.vadScores = [];
    this.qualityScores = [];
    this.captureMemorySnapshot();
  }
}

// Global analyzer instance
export const performanceAnalyzer = new PerformanceAnalyzer();

// Utility function to run comprehensive performance analysis
export async function runPerformanceAnalysis(durationMs: number = 30000): Promise<PerformanceAnalysis> {
  console.log(`🔬 Starting ${durationMs / 1000}s performance analysis...`);
  
  const analyzer = new PerformanceAnalyzer();
  
  // Run for specified duration
  await new Promise(resolve => setTimeout(resolve, durationMs));
  
  const analysis = analyzer.generateAnalysis();
  
  console.log('📊 Performance Analysis Complete:');
  console.log(`✅ Target Met: ${analysis.latencyAnalysis.current.targetMet}`);
  console.log(`⚡ Average Latency: ${analysis.latencyAnalysis.current.averageLatency.toFixed(2)}ms`);
  console.log(`🧠 VAD Effectiveness: ${(analysis.neuralProcessingAnalysis.vadEffectiveness * 100).toFixed(1)}%`);
  console.log(`💾 Memory Status: ${analysis.memoryAnalysis.leakDetection.hasLeak ? 'LEAK DETECTED' : 'HEALTHY'}`);
  
  if (analysis.recommendations.length > 0) {
    console.log('\n📋 Recommendations:');
    analysis.recommendations.forEach(rec => console.log(`  ${rec}`));
  }
  
  return analysis;
}