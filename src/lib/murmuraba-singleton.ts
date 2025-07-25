interface MurmurabaEngine {
  initializeAudioEngine: (config: any) => Promise<void>
  destroyEngine: () => Promise<void>
  processFile: (file: ArrayBuffer, options: any) => Promise<any>
  processFileWithMetrics?: (file: ArrayBuffer, options: any) => Promise<any>
  analyzeVAD?: (file: File | Blob | ArrayBuffer) => Promise<any>
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
          console.log('[Murmuraba] Initializing audio engine...')
          await murmuraba.initializeAudioEngine(config || {
            enableAGC: true,
            enableNoiseSuppression: true,
            enableEchoCancellation: true,
            enableVAD: true
          })
          console.log('[Murmuraba] Audio engine initialized successfully')
        }
      } catch (error: any) {
        if (error.message?.includes('already initialized')) {
          console.warn('[MurmurabaManager] Engine already initialized, continuing...')
        } else {
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
    await this.initialize()
    const murmuraba = await this.getMurmuraba()
    
    // Log for debugging
    console.log('[Murmuraba] processFile called with:', { 
      type: file.constructor.name, 
      size: file.size,
      fileType: file.type 
    })
    
    // Convert File/Blob to ArrayBuffer as murmuraba expects ArrayBuffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      console.log('[Murmuraba] Converted to ArrayBuffer, size:', arrayBuffer.byteLength)
      return await murmuraba.processFile(arrayBuffer, options)
    } catch (error: any) {
      console.error('[Murmuraba] Error processing file:', error)
      throw error
    }
  }

  async processFileWithMetrics(file: File | Blob, options: any): Promise<any> {
    await this.initialize()
    const murmuraba = await this.getMurmuraba()
    
    // Log for debugging
    console.log('[Murmuraba] processFileWithMetrics called with:', { 
      type: file.constructor.name, 
      size: file.size,
      fileType: file.type 
    })
    
    // Convert File/Blob to ArrayBuffer as murmuraba expects ArrayBuffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      console.log('[Murmuraba] Converted to ArrayBuffer for metrics, size:', arrayBuffer.byteLength)
      
      // Extract callback from options if present
      const { onFrameProcessed, ...restOptions } = options || {}
      
      // Check if the method exists, otherwise fall back to processFile
      if (murmuraba.processFileWithMetrics) {
        const result = await murmuraba.processFileWithMetrics(
          arrayBuffer, 
          onFrameProcessed || (() => {})  // Pass callback as second param only
        )
        console.log('[Murmuraba] processFileWithMetrics result:', { 
          hasMetrics: !!result.metrics,
          metricsLength: result.metrics?.length,
          sampleMetric: result.metrics?.[0]
        })
        return result
      } else {
        console.warn('[Murmuraba] processFileWithMetrics not available, using processFile')
        const result = await murmuraba.processFile(arrayBuffer, restOptions)
        // Mock the metrics structure if not provided
        return {
          ...result,
          metrics: result.vadScores ? result.vadScores.map((score: number) => ({ vadScore: score })) : []
        }
      }
    } catch (error: any) {
      console.error('[Murmuraba] Error processing file with metrics:', error)
      throw error
    }
  }
}

export const murmurabaManager = MurmurabaManager.getInstance()