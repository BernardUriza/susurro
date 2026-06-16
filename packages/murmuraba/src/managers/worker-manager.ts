import { Logger } from '../core/logger';
import { MurmubaraError, ErrorCodes } from '../types';

interface WorkerMessage {
  type: string;
  payload?: any;
}

export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  createWorker(id: string, workerPath: string): Worker {
    if (this.workers.has(id)) {
      throw new MurmubaraError(
        ErrorCodes.WORKER_ERROR,
        `Worker with id ${id} already exists`
      );
    }
    
    try {
      const worker = new Worker(workerPath);
      this.workers.set(id, worker);
      this.logger.debug(`Worker created: ${id}`);
      return worker;
    } catch (error) {
      this.logger.error(`Failed to create worker: ${id}`, error);
      throw new MurmubaraError(
        ErrorCodes.WORKER_ERROR,
        `Failed to create worker: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  getWorker(id: string): Worker | undefined {
    return this.workers.get(id);
  }
  
  sendMessage(id: string, message: WorkerMessage): void {
    const worker = this.workers.get(id);
    if (!worker) {
      throw new MurmubaraError(
        ErrorCodes.WORKER_ERROR,
        `Worker ${id} not found`
      );
    }
    
    worker.postMessage(message);
    this.logger.debug(`Message sent to worker ${id}:`, message);
  }
  
  terminateWorker(id: string): void {
    const worker = this.workers.get(id);
    if (worker) {
      worker.terminate();
      this.workers.delete(id);
      this.logger.debug(`Worker terminated: ${id}`);
    }
  }
  
  terminateAll(): void {
    this.logger.info(`Terminating all ${this.workers.size} workers`);
    for (const [id, worker] of this.workers) {
      worker.terminate();
      this.logger.debug(`Worker terminated: ${id}`);
    }
    this.workers.clear();
  }
  
  getActiveWorkerCount(): number {
    return this.workers.size;
  }
  
  getWorkerIds(): string[] {
    return Array.from(this.workers.keys());
  }
}