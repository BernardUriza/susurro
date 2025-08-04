export class SilentThreadProcessor {
  private taskQueue: Array<() => Promise<any>> = []
  private isProcessing = false
  private onLog?: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void

  constructor(onLog?: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void) {
    this.onLog = onLog
  }

  async addTask(task: () => Promise<any>) {
    this.taskQueue.push(task)
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) return
    
    this.isProcessing = true
    
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()
      if (task) {
        await this.processInBackground(task)
      }
    }
    
    this.isProcessing = false
  }

  private processInBackground(task: () => Promise<any>): Promise<void> {
    return new Promise((resolve) => {
      // Use requestIdleCallback to run when browser is idle
      if ('requestIdleCallback' in window) {
        requestIdleCallback(async (deadline) => {
          try {
            // Process in chunks to avoid blocking
            const chunkSize = 50 // ms
            const startTime = performance.now()
            
            // If we have enough idle time, process the task
            if (deadline.timeRemaining() > chunkSize || deadline.didTimeout) {
              await task()
            } else {
              // Otherwise, schedule for next idle period
              await new Promise(resolve => setTimeout(resolve, 0))
              await task()
            }
          } catch (error) {
            this.onLog?.(`Error: ${error}`, 'error')
          }
          resolve()
        }, { timeout: 5000 }) // 5 second timeout
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(async () => {
          try {
            await task()
          } catch (error) {
            this.onLog?.(`Error: ${error}`, 'error')
          }
          resolve()
        }, 0)
      }
    })
  }

  // Process transcription in chunks
  async processTranscriptionAsync(
    blob: Blob,
    transcribe: (blob: Blob) => Promise<any>,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.addTask(async () => {
        try {
          this.onLog?.('Starting transcription...', 'info')
          
          // Simulate processing in smaller chunks
          const chunkSize = 1024 * 1024 // 1MB chunks
          const totalSize = blob.size
          let processed = 0
          
          // For actual implementation, we'd split the blob
          // For now, we'll just process the whole blob
          const result = await transcribe(blob)
          
          processed = totalSize
          onProgress(100)
          
          this.onLog?.('Transcription complete', 'success')
          resolve(result?.text || '')
        } catch (error) {
          this.onLog?.(`Transcription failed: ${error}`, 'error')
          reject(error)
        }
      })
    })
  }
}