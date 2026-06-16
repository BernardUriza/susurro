// RNNoise Worker Manager - Manages Web Worker pool for audio processing
// 2025 best practices: Worker pooling, load balancing, zero-copy transfers

export interface WorkerTask {
  id: string;
  buffer: Float32Array;
  resolve: (result: Float32Array) => void;
  reject: (error: Error) => void;
}

export class RNNoiseWorkerManager {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private busyWorkers = new Set<Worker>();
  private workerTasks = new Map<Worker, WorkerTask>();
  private initialized = false;
  private readonly maxWorkers: number;
  private readonly initTimeout: number;
  
  constructor(maxWorkers = navigator.hardwareConcurrency || 4, initTimeout = 30000) {
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
    this.initTimeout = initTimeout;
    console.log(`[RNNoiseWorkerManager] Initializing with ${this.maxWorkers} workers, timeout: ${initTimeout}ms`);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const initPromises: Promise<void>[] = [];
    
    // Create worker pool
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(
        new URL('../workers/rnnoise.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      const initPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${i} initialization timeout after ${this.initTimeout}ms`));
        }, this.initTimeout);
        
        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'initialized') {
            clearTimeout(timeout);
            worker.removeEventListener('message', messageHandler);
            
            if (event.data.success) {
              resolve();
            } else {
              reject(new Error(event.data.error || 'Worker initialization failed'));
            }
          }
        };
        
        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      // Set up permanent message handler
      worker.addEventListener('message', (event) => this.handleWorkerMessage(worker, event));
      worker.addEventListener('error', (error) => this.handleWorkerError(worker, error));
      
      // Initialize worker
      worker.postMessage({ type: 'init' });
      
      this.workers.push(worker);
      initPromises.push(initPromise);
    }
    
    // Wait for all workers to initialize
    await Promise.all(initPromises);
    this.initialized = true;
    
    console.log(`[RNNoiseWorkerManager] All ${this.maxWorkers} workers initialized`);
  }
  
  async processBuffer(buffer: Float32Array): Promise<Float32Array> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: crypto.randomUUID(),
        buffer,
        resolve,
        reject
      };
      
      // Try to find an idle worker
      const idleWorker = this.getIdleWorker();
      
      if (idleWorker) {
        this.assignTask(idleWorker, task);
      } else {
        // Queue task if all workers are busy
        this.taskQueue.push(task);
      }
    });
  }
  
  private getIdleWorker(): Worker | null {
    for (const worker of this.workers) {
      if (!this.busyWorkers.has(worker)) {
        return worker;
      }
    }
    return null;
  }
  
  private assignTask(worker: Worker, task: WorkerTask): void {
    this.busyWorkers.add(worker);
    this.workerTasks.set(worker, task);
    
    // Send task to worker with zero-copy transfer
    worker.postMessage({
      type: 'process',
      id: task.id,
      data: {
        buffer: task.buffer,
        sampleRate: 48000
      }
    }, [task.buffer.buffer]); // Transfer ownership
  }
  
  private handleWorkerMessage(worker: Worker, event: MessageEvent): void {
    const { type, id, data, error } = event.data;
    
    if (type === 'processed') {
      const task = this.workerTasks.get(worker);
      
      if (task && task.id === id) {
        task.resolve(data.buffer);
        this.completeTask(worker);
      }
    } else if (type === 'error') {
      const task = this.workerTasks.get(worker);
      
      if (task && task.id === id) {
        task.reject(new Error(error));
        this.completeTask(worker);
      }
    }
  }
  
  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    console.error('[RNNoiseWorkerManager] Worker error:', error);
    
    const task = this.workerTasks.get(worker);
    if (task) {
      task.reject(new Error(`Worker error: ${error.message}`));
      this.completeTask(worker);
    }
    
    // Replace failed worker
    this.replaceWorker(worker);
  }
  
  private completeTask(worker: Worker): void {
    this.busyWorkers.delete(worker);
    this.workerTasks.delete(worker);
    
    // Process next task in queue
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift()!;
      this.assignTask(worker, nextTask);
    }
  }
  
  private async replaceWorker(failedWorker: Worker): Promise<void> {
    const index = this.workers.indexOf(failedWorker);
    if (index === -1) return;
    
    // Terminate failed worker
    failedWorker.terminate();
    
    // Create new worker
    const newWorker = new Worker(
      new URL('../workers/rnnoise.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    // Initialize new worker
    newWorker.addEventListener('message', (event) => this.handleWorkerMessage(newWorker, event));
    newWorker.addEventListener('error', (error) => this.handleWorkerError(newWorker, error));
    
    newWorker.postMessage({ type: 'init' });
    
    // Replace in array
    this.workers[index] = newWorker;
  }
  
  getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    queueLength: number;
  } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.busyWorkers.size,
      queueLength: this.taskQueue.length
    };
  }
  
  async destroy(): Promise<void> {
    // Clear queue
    for (const task of this.taskQueue) {
      task.reject(new Error('Worker manager destroyed'));
    }
    this.taskQueue = [];
    
    // Terminate all workers
    await Promise.all(
      this.workers.map(worker => {
        worker.postMessage({ type: 'destroy' });
        return new Promise<void>(resolve => {
          setTimeout(() => {
            worker.terminate();
            resolve();
          }, 100);
        });
      })
    );
    
    this.workers = [];
    this.busyWorkers.clear();
    this.workerTasks.clear();
    this.initialized = false;
    
    console.log('[RNNoiseWorkerManager] Destroyed');
  }
}