import { MurmubaraEngine } from './core/murmuraba-engine';
import { MurmubaraConfig } from './types';

let globalEngine: MurmubaraEngine | null = null;

export async function initializeAudioEngine(config?: MurmubaraConfig): Promise<void> {
  if (globalEngine) {
    throw new Error('Audio engine is already initialized. Call destroyEngine() first.');
  }
  
  globalEngine = new MurmubaraEngine(config);
  await globalEngine.initialize();
}

export function getEngine(): MurmubaraEngine {
  if (!globalEngine) {
    throw new Error('Audio engine not initialized. Call initializeAudioEngine() first.');
  }
  return globalEngine;
}

export async function processStream(stream: MediaStream) {
  const engine = getEngine();
  return engine.processStream(stream);
}

export async function processStreamChunked(
  stream: MediaStream,
  config: {
    chunkDuration: number;
    onChunkProcessed?: (chunk: any) => void;
  }
) {
  const engine = getEngine();
  return engine.processStream(stream, config);
}

export async function destroyEngine(options?: { force?: boolean }): Promise<void> {
  if (!globalEngine) {
    return;
  }
  
  await globalEngine.destroy(options?.force || false);
  globalEngine = null;
}

export function getEngineStatus() {
  if (!globalEngine) {
    return 'uninitialized';
  }
  return globalEngine.getDiagnostics().engineState;
}

export function getDiagnostics() {
  const engine = getEngine();
  return engine.getDiagnostics();
}

export function onMetricsUpdate(callback: (metrics: any) => void) {
  const engine = getEngine();
  engine.onMetricsUpdate(callback);
  // Return unsubscribe function
  return () => {
    engine.off('metrics-update', callback);
  };
}

export async function processFile(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const engine = getEngine();
  return engine.processFile(arrayBuffer);
}

export function setInputGain(gain: number): void {
  // Validate input
  if (typeof gain !== 'number') {
    throw new TypeError(`Input gain must be a number, received ${typeof gain}`);
  }
  
  if (isNaN(gain)) {
    throw new TypeError('Input gain cannot be NaN');
  }
  
  if (!isFinite(gain)) {
    throw new TypeError('Input gain must be finite');
  }
  
  if (gain < 0) {
    throw new RangeError('Input gain cannot be negative');
  }
  
  // Clamp to safe range (allowing up to 10x for more noticeable effect)
  const safeGain = Math.max(0.5, Math.min(10.0, gain));
  
  const engine = getEngine();
  engine.setInputGain(safeGain);
}

export function getInputGain(): number {
  const engine = getEngine();
  return engine.getInputGain();
}

export function setAgcEnabled(enabled: boolean): void {
  const engine = getEngine();
  engine.setAGCEnabled(enabled);
}

export function isAgcEnabled(): boolean {
  const engine = getEngine();
  return engine.isAGCEnabled();
}