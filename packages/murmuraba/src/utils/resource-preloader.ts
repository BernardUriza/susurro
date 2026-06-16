// Resource Preloader - Intelligent preloading with priority queue
// 2025 best practices: Intersection Observer, requestIdleCallback, Network Information API

export interface PreloadResource {
  url: string;
  type: 'script' | 'style' | 'fetch' | 'image' | 'font';
  priority: 'high' | 'medium' | 'low';
  crossOrigin?: boolean;
}

export class ResourcePreloader {
  private static instance: ResourcePreloader;
  private preloadQueue: PreloadResource[] = [];
  private loadedResources = new Set<string>();
  private isIdle = false;
  private networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
  
  private constructor() {
    this.detectNetworkSpeed();
    this.setupIdleDetection();
  }
  
  static getInstance(): ResourcePreloader {
    if (!ResourcePreloader.instance) {
      ResourcePreloader.instance = new ResourcePreloader();
    }
    return ResourcePreloader.instance;
  }
  
  // Detect network speed using Network Information API
  private detectNetworkSpeed() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const effectiveType = connection.effectiveType;
      
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        this.networkSpeed = 'slow';
      } else if (effectiveType === '3g') {
        this.networkSpeed = 'medium';
      } else {
        this.networkSpeed = 'fast';
      }
      
      // Listen for network changes
      connection.addEventListener('change', () => {
        this.detectNetworkSpeed();
        this.adjustPreloadStrategy();
      });
    }
  }
  
  // Setup idle detection
  private setupIdleDetection() {
    if ('requestIdleCallback' in window) {
      const checkIdle = () => {
        (window as any).requestIdleCallback(() => {
          this.isIdle = true;
          this.processIdleQueue();
        }, { timeout: 2000 });
      };
      
      // Check periodically
      setInterval(checkIdle, 5000);
      checkIdle();
    }
  }
  
  // Add resource to preload queue
  preload(resource: PreloadResource | PreloadResource[]) {
    const resources = Array.isArray(resource) ? resource : [resource];
    
    resources.forEach(res => {
      if (!this.loadedResources.has(res.url)) {
        this.preloadQueue.push(res);
      }
    });
    
    // Sort by priority
    this.preloadQueue.sort((a, b) => {
      const priorityMap = { high: 0, medium: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });
    
    // Process high priority immediately
    this.processHighPriority();
  }
  
  // Process high priority resources immediately
  private processHighPriority() {
    const highPriority = this.preloadQueue.filter(r => r.priority === 'high');
    
    highPriority.forEach(resource => {
      this.loadResource(resource);
      this.removeFromQueue(resource);
    });
  }
  
  // Process queue during idle time
  private processIdleQueue() {
    if (!this.isIdle || this.preloadQueue.length === 0) return;
    
    // Load resources based on network speed
    const loadCount = this.networkSpeed === 'fast' ? 3 : 
                     this.networkSpeed === 'medium' ? 2 : 1;
    
    const toLoad = this.preloadQueue.slice(0, loadCount);
    
    toLoad.forEach(resource => {
      this.loadResource(resource);
      this.removeFromQueue(resource);
    });
    
    // Continue if more resources
    if (this.preloadQueue.length > 0 && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.processIdleQueue();
      });
    }
  }
  
  // Load individual resource
  private loadResource(resource: PreloadResource) {
    if (this.loadedResources.has(resource.url)) return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.url;
    link.as = resource.type;
    
    if (resource.crossOrigin) {
      link.crossOrigin = 'anonymous';
    }
    
    // Add specific attributes based on type
    if (resource.type === 'font') {
      link.type = 'font/woff2';
    }
    
    link.onload = () => {
      this.loadedResources.add(resource.url);
      console.log(`[Preloader] Loaded: ${resource.url}`);
    };
    
    link.onerror = () => {
      console.error(`[Preloader] Failed to load: ${resource.url}`);
      // Retry with lower priority
      if (resource.priority !== 'low') {
        this.preload({
          ...resource,
          priority: 'low'
        });
      }
    };
    
    document.head.appendChild(link);
  }
  
  // Remove from queue
  private removeFromQueue(resource: PreloadResource) {
    this.preloadQueue = this.preloadQueue.filter(r => r.url !== resource.url);
  }
  
  // Adjust strategy based on network
  private adjustPreloadStrategy() {
    if (this.networkSpeed === 'slow') {
      // Cancel low priority preloads
      this.preloadQueue = this.preloadQueue.filter(r => r.priority !== 'low');
    }
  }
  
  // Preload critical resources for Murmuraba
  preloadCriticalResources() {
    this.preload([
      {
        url: '/wasm/rnnoise.wasm',
        type: 'fetch',
        priority: 'high',
        crossOrigin: true
      }
      // Worker file doesn't exist yet
      // {
      //   url: '/src/workers/rnnoise.worker.js',
      //   type: 'script',
      //   priority: 'high'
      // }
    ]);
  }
  
  // Preload based on user interaction patterns
  preloadForRoute(route: string) {
    switch (route) {
      case 'recording':
        this.preload([
          {
            url: '/chunks/audio-processor.js',
            type: 'script',
            priority: 'medium'
          },
          {
            url: '/chunks/waveform-visualizer.js',
            type: 'script',
            priority: 'low'
          }
        ]);
        break;
        
      case 'settings':
        this.preload({
          url: '/chunks/settings-panel.js',
          type: 'script',
          priority: 'medium'
        });
        break;
    }
  }
  
  // Get preload status
  getStatus() {
    return {
      queueLength: this.preloadQueue.length,
      loadedCount: this.loadedResources.size,
      networkSpeed: this.networkSpeed,
      isIdle: this.isIdle
    };
  }
}

// Auto-initialize and export singleton
export const preloader = ResourcePreloader.getInstance();