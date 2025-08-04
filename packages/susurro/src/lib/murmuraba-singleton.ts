interface MurmurabaEngine {
  initializeAudioEngine: (config: any) => Promise<void>
  destroyEngine: () => Promise<void>
  processFile: (file: ArrayBuffer, options: any) => Promise<any>
  processFileWithMetrics?: (file: ArrayBuffer, options: any) => Promise<any>
  analyzeVAD?: (file: File | Blob | ArrayBuffer) => Promise<any>
  processStreamChunked?: (stream: ReadableStream | ArrayBuffer, options: {
    chunkDuration?: number
    onChunkProcessed?: (chunk: any) => void
  }) => Promise<any>
  isInitialized: boolean
}

class MurmurabaManager {
  private static instance: MurmurabaManager
  private murmurabaModule: MurmurabaEngine | null = null
  private initPromise: Promise<void> | null = null
  private isInitializing = false

  private constructor() {}

  static getInstance(): MurmurabaManager {
    if (!MurmurabaManager.instance) {
      MurmurabaManager.instance = new MurmurabaManager()
    }
    return MurmurabaManager.instance
  }

  async getMurmuraba(): Promise<MurmurabaEngine> {
    if (!this.murmurabaModule) {
      // Ensure we're in browser environment
      if (typeof window === 'undefined') {
        throw new Error('Murmuraba can only be used in browser environment')
      }
      
      const m = await import('murmuraba')
      this.murmurabaModule = m as any
    }
    return this.murmurabaModule!
  }

  async initialize(config?: any): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    if (this.isInitializing) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isInitializing) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 50)
      })
    }

    this.isInitializing = true
    
    this.initPromise = (async () => {
      try {
        const murmuraba = await this.getMurmuraba()
        
        if (!murmuraba.isInitialized) {
          
          // Add timeout to prevent hanging
          const initTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Murmuraba initialization timeout')), 10000)
          })
          
          await Promise.race([
            murmuraba.initializeAudioEngine(config || {
              enableAGC: true,
              enableNoiseSuppression: true,
              enableEchoCancellation: true,
              enableVAD: true
            }),
            initTimeout
          ])
          
        }
      } catch (error: any) {
        if (error.message?.includes('already initialized')) {
        } else {
          // Reset state on error to allow retry
          this.initPromise = null
          this.isInitializing = false
          throw error
        }
      } finally {
        this.isInitializing = false
      }
    })()

    return this.initPromise
  }

  async destroy(): Promise<void> {
    if (this.murmurabaModule && this.murmurabaModule.isInitialized) {
      await this.murmurabaModule.destroyEngine()
      this.initPromise = null
      this.isInitializing = false
    }
  }

  async processFile(file: File | Blob, options: any): Promise<any> {
    try {
      await this.initialize()
    } catch (error) {
      throw new Error('Audio engine initialization failed. Please refresh and try again.')
    }
    
    const murmuraba = await this.getMurmuraba()
    
    // Log for debugging
      type: file.constructor.name, 
      size: file.size,
      fileType: file.type 
    })
    
    // Convert File/Blob to ArrayBuffer as murmuraba expects ArrayBuffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // Add timeout for processing
      const processTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('File processing timeout')), 20000)
      })
      
      const result = await Promise.race([
        murmuraba.processFile(arrayBuffer, options),
        processTimeout
      ])
      
      
      // Handle different return formats from murmuraba
      if (result instanceof ArrayBuffer) {
        return {
          processedBuffer: result,
          vadScores: [],
          metrics: [],
          averageVad: 0
        }
      }
      
      // Ensure result has expected structure
      return {
        processedBuffer: result.processedAudio || result.processedBuffer || result,
        vadScores: result.vadScores || [],
        metrics: result.metrics || [],
        averageVad: result.averageVad || 0
      }
    } catch (error: any) {
      throw error
    }
  }

  async processStreamChunked(file: File | Blob, options: {
    chunkDuration?: number
    onChunkProcessed?: (chunk: any) => void
  } = {}): Promise<any[]> {
    await this.initialize()
    const murmuraba = await this.getMurmuraba()
    
    if (!murmuraba.processStreamChunked) {
      throw new Error('processStreamChunked not available in murmuraba')
    }
    
    // Create a ReadableStream from the file
    const stream = file.stream()
    const result = await murmuraba.processStreamChunked(stream, options)
    return result
  }

  async processFileWithMetrics(file: File | Blob, onFrameProcessed?: (metrics: any) => void): Promise<any> {
    await this.initialize()
    const murmuraba = await this.getMurmuraba()
    
    // Log for debugging
      type: file.constructor.name, 
      size: file.size,
      fileType: file.type 
    })
    
    // Convert File/Blob to ArrayBuffer as murmuraba expects ArrayBuffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // Check if the method exists, otherwise fall back to processFile
      if (murmuraba.processFileWithMetrics) {
        const result = await murmuraba.processFileWithMetrics(
          arrayBuffer, 
          onFrameProcessed  // Pass callback as second param
        )
          hasMetrics: !!result.metrics,
          metricsLength: result.metrics?.length,
          averageVad: result.averageVad,
          sampleMetric: result.metrics?.[0]
        })
        
        // Log some VAD values for debugging
        if (result.metrics && result.metrics.length > 0) {
          const vadValues = result.metrics.slice(0, 10).map((m: any) => m.vad)
        }
        
        return result
      } else {
        const result = await murmuraba.processFile(arrayBuffer, {
          enableVAD: true
        })
        
        // Try to analyze VAD if available
        let vadData = null
        if (murmuraba.analyzeVAD) {
          try {
            vadData = await murmuraba.analyzeVAD(arrayBuffer)
          } catch (err) {
          }
        }
        
        // Return combined result
        return {
          processedBuffer: result.processedAudio || result.processedBuffer || result,
          metrics: vadData?.metrics || [],
          averageVad: vadData?.averageVad || vadData?.average || 0,
          vadScores: vadData?.scores || result.vadScores || []
        }
      }
    } catch (error: any) {
      throw error
    }
  }
}

export const murmurabaManager = MurmurabaManager.getInstance()
export const MurmurabaSingleton = MurmurabaManager