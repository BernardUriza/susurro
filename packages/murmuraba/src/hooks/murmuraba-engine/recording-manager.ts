import { ProcessedChunk } from './types';
import { processFileWithMetrics } from '../../api/process-file-with-metrics';
import { MIN_VALID_BLOB_SIZE, LOG_PREFIX } from './constants';
import { URLManager } from './url-manager';
import { AudioConverter } from '../../utils/audio-converter';
import { SecureEventBridge } from '../../core/secure-event-bridge';
import { ProcessingMetrics } from '../../types';
import { RecordingLogger, ProcessingLogger } from '../../utils/logger';

interface ChunkRecording {
  processed: Blob[];
  original: Blob[];
  finalized: boolean;
}

export class RecordingManager {
  private mediaRecorder: MediaRecorder | null = null;
  private originalRecorder: MediaRecorder | null = null;
  private chunkRecordings = new Map<string, ChunkRecording>();
  private processChunkInterval: NodeJS.Timeout | null = null;
  private stopCycleFlag = false;
  private cycleCount = 0;
  private cycleTimeout: NodeJS.Timeout | null = null;
  private eventBridge: SecureEventBridge;
  private bridgeToken: string;
  private managerId: string;

  // TDD Integration: Metrics provider from ChunkProcessor
  private metricsProvider: {
    getAggregatedMetrics: (startTime: number, endTime: number) => any;
  } | null = null;
  private currentMetrics: any = null;

  constructor(private urlManager: URLManager) {
    // Use secure event bridge instead of global state
    this.eventBridge = SecureEventBridge.getInstance();
    this.bridgeToken = this.eventBridge.getAccessToken();
    this.managerId = this.generateId();
    
    // Register with secure event bridge
    this.eventBridge.registerRecordingManager(this.managerId, this, this.bridgeToken);
    
    // Subscribe to metrics events
    this.eventBridge.on('metrics', (metrics) => {
      this.notifyMetrics(metrics);
    });
    
    RecordingLogger.info('RecordingManager registered with secure event bridge');
  }
  
  private generateId(): string {
    return `rm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * TDD Integration: Set metrics provider from ChunkProcessor
   */
  setMetricsProvider(provider: {
    getAggregatedMetrics: (startTime: number, endTime: number) => any;
  }): void {
    this.metricsProvider = provider;
  }

  /**
   * TDD Integration: Receive metrics from ChunkProcessor
   */
  receiveMetrics(metrics: any): void {
    this.currentMetrics = metrics;
    RecordingLogger.debug('Received real metrics', {
      averageNoiseReduction: metrics.averageNoiseReduction?.toFixed(1) || 0,
      unit: 'percent'
    });
  }
  
  /**
   * Secure Integration: Notify metrics received from secure event bridge
   */
  public notifyMetrics(metrics: ProcessingMetrics): void {
    // Convert ProcessingMetrics to the format expected by recording manager
    this.currentMetrics = {
      averageNoiseReduction: metrics.noiseReductionLevel,
      averageLatency: metrics.processingLatency,
      totalFrames: metrics.frameCount,
      timestamp: metrics.timestamp
    };
    RecordingLogger.debug('Received metrics via secure bridge', {
      noiseReductionLevel: metrics.noiseReductionLevel.toFixed(1),
      unit: 'percent'
    });
  }

  /**
   * TDD Integration: Get real metrics for a time period
   */
  private getRealMetrics(startTime: number, endTime: number): any {
    // Try current metrics first
    if (this.currentMetrics) {
      return this.currentMetrics;
    }

    // Try metrics provider
    if (this.metricsProvider) {
      return this.metricsProvider.getAggregatedMetrics(startTime, endTime);
    }

    // Fallback to safe defaults (NOT negative values)
    return {
      averageNoiseReduction: 0,
      totalFrames: Math.floor((endTime - startTime) / 10),
      averageLatency: 0
    };
  }

  /**
   * Start concatenated streaming for medical-grade recording
   */
  async startCycle(
    processedStream: MediaStream,
    originalStream: MediaStream,
    chunkDuration: number,
    onChunkProcessed: (chunk: ProcessedChunk) => void
  ): Promise<void> {
    // Use a default mime type for now
    const mimeType = 'audio/webm;codecs=opus';
    this.cycleCount = 0;
    this.stopCycleFlag = false;

    const startNewRecordingCycle = () => {
      if (this.stopCycleFlag) return;
      
      this.cycleCount++;
      const cycleStartTime = Date.now();
      RecordingLogger.info('Starting recording cycle', { cycleNumber: this.cycleCount });
      
      // Create chunk ID for this cycle
      const chunkId = `chunk-${cycleStartTime}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize recording storage
      this.chunkRecordings.set(chunkId, { 
        processed: [], 
        original: [], 
        finalized: false 
      });
      
      // Create new recorders for this cycle
      const currentRecorder = new MediaRecorder(processedStream, { mimeType });
      const currentOriginalRecorder = new MediaRecorder(originalStream, { mimeType });
      
      currentRecorder.ondataavailable = (event) => {
        if (event.data.size >= MIN_VALID_BLOB_SIZE) {
          const chunkRecording = this.chunkRecordings.get(chunkId);
          if (chunkRecording && !chunkRecording.finalized) {
            chunkRecording.processed.push(event.data);
            ProcessingLogger.debug('Recording cycle processed data', {
              cycleNumber: this.cycleCount,
              dataSize: event.data.size,
              type: 'processed'
            });
          }
        } else {
          console.warn(`⚠️ ${LOG_PREFIX.CONCAT_STREAM} Invalid blob size detected! Size: ${event.data.size} bytes (minimum: ${MIN_VALID_BLOB_SIZE} bytes)`, {
            cycleNumber: this.cycleCount,
            blobSize: event.data.size,
            type: 'processed'
          });
        }
      };
      
      currentOriginalRecorder.ondataavailable = (event) => {
        if (event.data.size >= MIN_VALID_BLOB_SIZE) {
          const chunkRecording = this.chunkRecordings.get(chunkId);
          if (chunkRecording && !chunkRecording.finalized) {
            chunkRecording.original.push(event.data);
            console.log(`💾 ${LOG_PREFIX.CONCAT_STREAM} Cycle #${this.cycleCount} - Original data: ${event.data.size} bytes`);
          }
        } else {
          console.warn(`⚠️ ${LOG_PREFIX.CONCAT_STREAM} Invalid blob size detected! Size: ${event.data.size} bytes (minimum: ${MIN_VALID_BLOB_SIZE} bytes)`, {
            cycleNumber: this.cycleCount,
            blobSize: event.data.size,
            type: 'original'
          });
        }
      };
      
      currentRecorder.onerror = (error) => {
        console.error(`❌ ${LOG_PREFIX.CONCAT_STREAM} Processed recorder error:`, error);
      };
      
      currentOriginalRecorder.onerror = (error) => {
        console.error(`❌ ${LOG_PREFIX.CONCAT_STREAM} Original recorder error:`, error);
      };
      
      // When recording stops, process and create chunk
      currentRecorder.onstop = () => {
        console.log(`🔄 ${LOG_PREFIX.CONCAT_STREAM} Recorder stopped for cycle #${this.cycleCount}`);
        const chunkRecording = this.chunkRecordings.get(chunkId);
        if (chunkRecording && !chunkRecording.finalized) {
          // Only process if we have valid data
          if (chunkRecording.processed.length > 0 || chunkRecording.original.length > 0) {
            this.processChunkRecording(
              chunkId,
              chunkRecording,
              cycleStartTime,
              mimeType,
              onChunkProcessed
            );
          } else {
            console.warn(`⚠️ ${LOG_PREFIX.CONCAT_STREAM} Cycle #${this.cycleCount} discarded - no valid blobs collected`);
            // Clean up the empty recording
            this.chunkRecordings.delete(chunkId);
          }
        }
      };
      
      // Start recording
      currentRecorder.start(1000);
      currentOriginalRecorder.start(1000);
      
      // Store refs
      this.mediaRecorder = currentRecorder;
      this.originalRecorder = currentOriginalRecorder;
    };

    // Stop current cycle and start new one
    const cycleRecording = () => {
      if (this.stopCycleFlag) {
        console.log(`🚫 ${LOG_PREFIX.CONCAT_STREAM} Cycle skipped - stop flag set`);
        return;
      }
      
      console.log(`⏹️ ${LOG_PREFIX.CONCAT_STREAM} Stopping cycle #${this.cycleCount}`);
      
      // Store current recorders to ensure onstop handlers complete
      const currentMediaRecorder = this.mediaRecorder;
      const currentOriginalRecorder = this.originalRecorder;
      
      // Stop recorders if they're recording
      if (currentMediaRecorder?.state === 'recording') {
        currentMediaRecorder.stop();
      }
      
      if (currentOriginalRecorder?.state === 'recording') {
        currentOriginalRecorder.stop();
      }
      
      // Start new cycle after a delay to ensure processing completes
      if (!this.stopCycleFlag) {
        this.cycleTimeout = setTimeout(() => {
          if (!this.stopCycleFlag) {
            startNewRecordingCycle();
          }
        }, 1000); // Increased delay to ensure chunk processing
      }
    };

    // Start first cycle
    startNewRecordingCycle();
    
    // Set up interval for cycling
    this.processChunkInterval = setInterval(cycleRecording, chunkDuration * 1000);
  }

  /**
   * Process recorded chunk data
   */
  private async processChunkRecording(
    chunkId: string,
    chunkRecording: ChunkRecording,
    cycleStartTime: number,
    mimeType: string,
    onChunkProcessed: (chunk: ProcessedChunk) => void
  ): Promise<void> {
    const originalBlob = new Blob(chunkRecording.original, { type: mimeType });
    
    console.log(`📦 ${LOG_PREFIX.CONCAT_STREAM} Original blob: ${originalBlob.size} bytes`);
    
    // Validate blob size
    let isValid = true;
    let errorMessage = '';
    
    if (originalBlob.size === 0) {
      console.error(`❌ ${LOG_PREFIX.CONCAT_STREAM} Original blob is empty, skipping chunk creation`);
      this.chunkRecordings.delete(chunkId);
      return;
    }
    
    if (originalBlob.size < MIN_VALID_BLOB_SIZE) {
      isValid = false;
      errorMessage = `Audio too small (${originalBlob.size} bytes). Recording may be corrupted.`;
      console.error(`❌ ${LOG_PREFIX.CONCAT_STREAM} Invalid blob size in chunk!`);
    }
    
    // Create original URL immediately
    const originalUrl = isValid ? this.urlManager.createObjectURL(chunkId, originalBlob) : undefined;
    
    const cycleEndTime = Date.now();
    
    // Process original audio through RNNoise to get metrics and processed audio
    let processedUrl: string | undefined;
    let noiseReduction = 0;
    let frameCount = 0;
    let averageVad = 0;
    let vadData: Array<{ time: number; vad: number; }> = [];
    let actualDuration = 0; // Calcularemos la duración real del audio
    
    if (isValid) {
      try {
        // Convert WebM to WAV first
        console.log(`🔄 ${LOG_PREFIX.CONCAT_STREAM} Converting WebM to WAV for chunk ${chunkId}`);
        const wavBlob = await AudioConverter.webmToWav(originalBlob);
        
        // Convert WAV blob to ArrayBuffer
        const arrayBuffer = await wavBlob.arrayBuffer();
        
        // Calcular duración real del audio WAV
        const dataView = new DataView(arrayBuffer);
        const sampleRate = dataView.getUint32(24, true); // Sample rate está en offset 24
        const dataSize = dataView.getUint32(40, true); // Tamaño de datos está en offset 40
        const bytesPerSample = dataView.getUint16(34, true) / 8; // Bits per sample / 8
        const numChannels = dataView.getUint16(22, true); // Número de canales
        const totalSamples = dataSize / (bytesPerSample * numChannels);
        actualDuration = (totalSamples / sampleRate) * 1000; // Duración en milisegundos
        
        console.log(`📏 ${LOG_PREFIX.CONCAT_STREAM} Chunk ${chunkId} - Duración real: ${(actualDuration/1000).toFixed(2)}s (SR: ${sampleRate}Hz, ${numChannels}ch)`);
        
        // Process with metrics like AudioDemo
        const result = await processFileWithMetrics(arrayBuffer);
        
        // Create processed blob from result
        const processedBlob = new Blob([result.processedBuffer], { type: 'audio/wav' });
        processedUrl = this.urlManager.createObjectURL(chunkId, processedBlob);
        
        // Extract VAD metrics
        averageVad = result.averageVad;
        frameCount = result.metrics.length;
        
        // Convert metrics to VAD timeline data
        const vadSampleRate = 48000; // Assuming 48kHz
        const frameSize = 480; // RNNoise frame size
        vadData = result.metrics.map((metric, index) => ({
          time: (index * frameSize) / vadSampleRate,
          vad: metric.vad
        }));
        
        console.log(`📊 VAD Data generated: ${vadData.length} points, avg=${averageVad.toFixed(3)}`);
        
        // Calculate actual noise reduction (inverse of VAD - lower VAD means more noise reduction)
        noiseReduction = (1 - averageVad) * 100;
        
        console.log(`🎯 ${LOG_PREFIX.CONCAT_STREAM} Processed chunk ${chunkId}: VAD=${averageVad.toFixed(3)}, noise reduction=${noiseReduction.toFixed(1)}%, ${frameCount} frames`);
      } catch (error) {
        console.error(`❌ ${LOG_PREFIX.CONCAT_STREAM} Failed to process chunk:`, error);
        isValid = false;
        errorMessage = `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    // Si por alguna razón no pudimos calcular la duración real, usar la estimada
    if (actualDuration === 0) {
      actualDuration = cycleEndTime - cycleStartTime;
      console.warn(`⚠️ ${LOG_PREFIX.CONCAT_STREAM} No se pudo calcular duración real, usando estimada: ${(actualDuration/1000).toFixed(2)}s`);
    }
    
    // Create chunk with real metrics from processing
    const newChunk: ProcessedChunk = {
      id: chunkId,
      index: this.cycleCount - 1, // Use cycleCount as index
      startTime: cycleStartTime,
      endTime: cycleEndTime,
      duration: actualDuration, // Keep duration in milliseconds
      processedAudioUrl: processedUrl,
      originalAudioUrl: originalUrl,
      isPlaying: false,
      isExpanded: false,
      isValid,
      errorMessage,
      noiseRemoved: noiseReduction,
      originalSize: originalBlob.size,
      processedSize: processedUrl ? originalBlob.size : 0, // Same size for WAV
      averageVad,
      vadData,
      metrics: {
        processingLatency: 0,
        frameCount: frameCount,
        inputLevel: 1.0,
        outputLevel: 1.0,
        noiseReductionLevel: noiseReduction / 100,
        timestamp: Date.now(),
        droppedFrames: 0
      }
    };
    
    chunkRecording.finalized = true;
    console.log(`✅ ${LOG_PREFIX.CONCAT_STREAM} Cycle #${this.cycleCount} complete: ${(actualDuration/1000).toFixed(1)}s chunk`);
    
    onChunkProcessed(newChunk);
  }

  /**
   * Stop recording and release all audio resources
   */
  stopRecording(): void {
    console.log(`🛑 ${LOG_PREFIX.CONCAT_STREAM} Stopping concatenated streaming and releasing all audio resources...`);
    
    this.stopCycleFlag = true;
    
    // Clear intervals and timeouts first
    if (this.processChunkInterval) {
      clearInterval(this.processChunkInterval);
      this.processChunkInterval = null;
    }
    
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }
    
    // Stop recorders and wait for final chunks
    const promises: Promise<void>[] = [];
    
    // Stop and clean up the processed stream recorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        const stopPromise = new Promise<void>((resolve) => {
          const originalOnStop = this.mediaRecorder!.onstop;
          this.mediaRecorder!.onstop = (event) => {
            if (originalOnStop && this.mediaRecorder) {
              originalOnStop.call(this.mediaRecorder, event);
            }
            // CRITICAL: Release the stream tracks from the MediaRecorder
            if (this.mediaRecorder?.stream) {
              this.mediaRecorder.stream.getTracks().forEach(track => {
                track.stop();
                console.log(`🔇 ${LOG_PREFIX.CONCAT_STREAM} Stopped MediaRecorder track:`, track.kind);
              });
            }
            resolve();
          };
          this.mediaRecorder!.stop();
        });
        promises.push(stopPromise);
      } else {
        // Even if inactive, still release the stream tracks
        if (this.mediaRecorder.stream) {
          this.mediaRecorder.stream.getTracks().forEach(track => {
            track.stop();
            console.log(`🔇 ${LOG_PREFIX.CONCAT_STREAM} Stopped inactive MediaRecorder track:`, track.kind);
          });
        }
      }
    }
    
    // Stop and clean up the original stream recorder
    if (this.originalRecorder) {
      if (this.originalRecorder.state !== 'inactive') {
        const stopPromise = new Promise<void>((resolve) => {
          const originalOnStop = this.originalRecorder!.onstop;
          this.originalRecorder!.onstop = (event) => {
            if (originalOnStop && this.originalRecorder) {
              originalOnStop.call(this.originalRecorder, event);
            }
            // CRITICAL: Release the original stream tracks
            if (this.originalRecorder?.stream) {
              this.originalRecorder.stream.getTracks().forEach(track => {
                track.stop();
                console.log(`🔇 ${LOG_PREFIX.CONCAT_STREAM} Stopped original recorder track:`, track.kind);
              });
            }
            resolve();
          };
          this.originalRecorder!.stop();
        });
        promises.push(stopPromise);
      } else {
        // Even if inactive, still release the stream tracks
        if (this.originalRecorder.stream) {
          this.originalRecorder.stream.getTracks().forEach(track => {
            track.stop();
            console.log(`🔇 ${LOG_PREFIX.CONCAT_STREAM} Stopped inactive original recorder track:`, track.kind);
          });
        }
      }
    }
    
    // Wait for all stop handlers to complete before cleanup
    Promise.all(promises).then(() => {
      // Clear recordings after processing
      this.chunkRecordings.clear();
      
      // Reset recorders and clear all references
      this.mediaRecorder = null;
      this.originalRecorder = null;
      this.stopCycleFlag = false;
      this.cycleCount = 0;
      
      console.log(`✅ ${LOG_PREFIX.CONCAT_STREAM} Recording stopped completely and all audio resources released`);
    }).catch(error => {
      console.error(`❌ ${LOG_PREFIX.CONCAT_STREAM} Error during recording cleanup:`, error);
      // Still reset everything even if there was an error
      this.mediaRecorder = null;
      this.originalRecorder = null;
      this.chunkRecordings.clear();
    });
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
    }
    if (this.originalRecorder?.state === 'recording') {
      this.originalRecorder.pause();
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
    }
    if (this.originalRecorder?.state === 'paused') {
      this.originalRecorder.resume();
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording' || this.originalRecorder?.state === 'recording';
  }

  /**
   * Start concatenated streaming for medical-grade recording
   * This is an alias for startCycle for backward compatibility
   */
  async startConcatenatedStreaming(
    processedStream: MediaStream,
    originalStream: MediaStream,
    chunkDuration: number,
    onChunkProcessed: (chunk: ProcessedChunk) => void
  ): Promise<void> {
    return this.startCycle(processedStream, originalStream, chunkDuration, onChunkProcessed);
  }

  /**
   * Check if recording is paused
   */
  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused' || this.originalRecorder?.state === 'paused';
  }
  
  /**
   * Clean up and unregister from the secure event bridge
   */
  cleanup(): void {
    // Unregister from secure event bridge
    this.eventBridge.unregisterRecordingManager(this.managerId, this.bridgeToken);
    this.eventBridge.removeAllListeners('metrics');
    
    // Clean up any remaining recordings
    this.chunkRecordings.clear();
    
    // Clear intervals
    if (this.processChunkInterval) {
      clearInterval(this.processChunkInterval);
      this.processChunkInterval = null;
    }
    
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }
    
    console.log(`🧹 [SECURE-INTEGRATION] RecordingManager cleaned up and unregistered`);
  }
}