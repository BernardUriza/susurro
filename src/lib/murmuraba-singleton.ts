interface MurmurabaEngine {
  initializeAudioEngine: (config: any) => Promise<void>
  destroyEngine: () => Promise<void>
  processFile: (file: File | Blob, options: any) => Promise<any>
  processFileWithMetrics?: (file: File | Blob, options: any) => Promise<any>
  analyzeVAD?: (file: File | Blob) => Promise<any>
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
    
    // Simply pass the file as is - murmuraba should handle File objects
    return await murmuraba.processFile(file, options)
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
    
    // Check if the method exists, otherwise fall back to processFile
    if (murmuraba.processFileWithMetrics) {
      return await murmuraba.processFileWithMetrics(file, options)
    } else {
      console.warn('[Murmuraba] processFileWithMetrics not available, using processFile')
      const result = await murmuraba.processFile(file, options)
      // Mock the metrics structure if not provided
      return {
        ...result,
        metrics: result.vadScores ? result.vadScores.map((score: number) => ({ vadScore: score })) : []
      }
    }
  }
}

export const murmurabaManager = MurmurabaManager.getInstance()