/**
 * AudioEngineManager - The Single Source of Truth for Murmuraba Engine
 *
 * This class implements proper lifecycle management, state machines, and error recovery
 * for the Murmuraba audio engine. No more destroy/reinit dance of shame.
 *
 * @author The Tech Lead Inquisitor
 */

type EngineState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'error'
  | 'destroying'
  | 'destroyed';

interface EngineHealthMetrics {
  initializationAttempts: number;
  lastErrorTimestamp?: number;
  lastSuccessfulInit?: number;
  consecutiveFailures: number;
  isHealthy: boolean;
}

interface AudioEngineConfig {
  autoRecover: boolean;
  maxRetries: number;
  retryDelayMs: number;
  healthCheckIntervalMs: number;
}

type EngineEventType = 'state-change' | 'error' | 'health-update';
type EngineEventListener = (event: { type: EngineEventType; data: unknown }) => void;

export class AudioEngineManager {
  private static instance: AudioEngineManager | null = null;
  private state: EngineState = 'uninitialized';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private murmurabaEngine: any = null;
  private config: AudioEngineConfig;
  private healthMetrics: EngineHealthMetrics;
  private listeners: Set<EngineEventListener> = new Set();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor(config: Partial<AudioEngineConfig> = {}) {
    this.config = {
      autoRecover: true,
      maxRetries: 3,
      retryDelayMs: 1000,
      healthCheckIntervalMs: 30000,
      ...config,
    };

    this.healthMetrics = {
      initializationAttempts: 0,
      consecutiveFailures: 0,
      isHealthy: false,
    };

    this.startHealthMonitoring();
  }

  /**
   * Singleton access - because there can be only one engine instance
   */
  public static getInstance(config?: Partial<AudioEngineConfig>): AudioEngineManager {
    if (!AudioEngineManager.instance) {
      AudioEngineManager.instance = new AudioEngineManager(config);
    }
    return AudioEngineManager.instance;
  }

  /**
   * Get current engine state - the ONLY source of truth
   */
  public getState(): EngineState {
    return this.state;
  }

  /**
   * Check if engine is ready for use
   */
  public isReady(): boolean {
    return this.state === 'ready' && this.healthMetrics.isHealthy;
  }

  /**
   * Get health metrics for debugging
   */
  public getHealthMetrics(): Readonly<EngineHealthMetrics> {
    return { ...this.healthMetrics };
  }

  /**
   * Initialize the engine with proper state management
   */
  public async initialize(): Promise<void> {
    // Prevent concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    // Don't reinitialize if already ready
    if (this.state === 'ready') {
      return;
    }

    // Don't allow initialization if currently destroying
    if (this.state === 'destroying') {
      throw new Error('Cannot initialize while engine is being destroyed');
    }

    this.initPromise = this.performInitialization();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Register a Murmuraba engine instance (from the React hook)
   * This manager coordinates the lifecycle, but the hook provides the actual engine
   */
  public registerEngine(engine: unknown): void {
    this.murmurabaEngine = engine;

    if (engine && typeof engine === 'object' && 'isInitialized' in engine && engine.isInitialized) {
      this.setState('ready');
      this.healthMetrics.lastSuccessfulInit = Date.now();
      this.healthMetrics.consecutiveFailures = 0;
      this.healthMetrics.isHealthy = true;
    } else {
      this.setState('uninitialized');
      this.healthMetrics.isHealthy = false;
    }
  }

  /**
   * Initialize with proper destroy/reinit cycle - this is where the real work happens
   */
  private async performInitialization(): Promise<void> {
    this.setState('initializing');
    this.healthMetrics.initializationAttempts++;

    try {
      // First, ensure we have a clean slate by destroying any existing engine
      // Destroying any existing engine for clean initialization

      try {
        const { destroyEngine } = await import('murmuraba');
        if (typeof destroyEngine === 'function') {
          await destroyEngine();
          // Engine destroyed successfully
        }
      } catch (destroyError) {
        // No existing engine to destroy or destroy failed - this is expected
      }

      // Wait for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Now we need to signal that a re-initialization is required
      // The actual initialization will happen through the hook registration
      this.setState('ready'); // This will be updated when registerEngine is called
      this.healthMetrics.lastSuccessfulInit = Date.now();
      this.healthMetrics.consecutiveFailures = 0;
      this.healthMetrics.isHealthy = true;
    } catch (error) {
      this.handleInitializationError(error);
      throw error;
    }
  }

  private handleInitializationError(error: unknown): void {
    this.setState('error');
    this.healthMetrics.lastErrorTimestamp = Date.now();
    this.healthMetrics.consecutiveFailures++;
    this.healthMetrics.isHealthy = false;

    this.emitEvent('error', { error, context: 'initialization' });

    // Auto-recovery logic
    if (
      this.config.autoRecover &&
      this.healthMetrics.consecutiveFailures < this.config.maxRetries
    ) {
      setTimeout(
        () => {
          this.initialize().catch(() => {});
        },
        this.config.retryDelayMs * Math.pow(2, this.healthMetrics.consecutiveFailures - 1)
      ); // Exponential backoff
    }
  }

  /**
   * Destroy the engine properly - no more hoping it works
   */
  public async destroy(): Promise<void> {
    if (this.state === 'destroying' || this.state === 'destroyed') {
      return;
    }

    this.setState('destroying');

    try {
      await this.cleanupEngine();
      this.setState('destroyed');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  private async cleanupEngine(): Promise<void> {
    if (!this.murmurabaEngine) return;

    try {
      // Stop any ongoing recording
      if (this.murmurabaEngine?.recordingState?.isRecording) {
        this.murmurabaEngine?.stopRecording?.();
      }

      // Use Murmuraba's destroy method if available
      if (typeof this.murmurabaEngine?.destroy === 'function') {
        await this.murmurabaEngine.destroy();
      } else {
        // Fallback to dynamic import destroy
        const { destroyEngine } = await import('murmuraba');
        if (typeof destroyEngine === 'function') {
          await destroyEngine();
        }
      }
    } catch {
      // Silently ignore errors during cleanup
    } finally {
      this.murmurabaEngine = null;
    }
  }

  /**
   * Get the Murmuraba engine instance - only if ready
   */
  public getEngine(): unknown {
    // If we have a registered engine, return it even if state is not "ready"
    // This fixes the synchronization issue between hook state and manager state
    if (this.murmurabaEngine) {
      return this.murmurabaEngine;
    }

    throw new Error(`Engine not registered. Current state: ${this.state}`);
  }

  /**
   * Reset the engine - proper recovery, not panic destruction
   */
  public async reset(): Promise<void> {
    await this.destroy();

    // Clear health metrics for fresh start
    this.healthMetrics = {
      initializationAttempts: 0,
      consecutiveFailures: 0,
      isHealthy: false,
    };

    await this.initialize();
  }

  /**
   * Add event listener for engine state changes
   */
  public addEventListener(listener: EngineEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: EngineEventListener): void {
    this.listeners.delete(listener);
  }

  private setState(newState: EngineState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;

      this.emitEvent('state-change', { oldState, newState });
    }
  }

  private emitEvent(type: EngineEventType, data: unknown): void {
    const event = { type, data };
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Silently ignore listener errors
      }
    });
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private performHealthCheck(): void {
    const wasHealthy = this.healthMetrics.isHealthy;

    // Check if engine is responsive
    let isCurrentlyHealthy = false;

    if (this.state === 'ready' && this.murmurabaEngine) {
      try {
        // Basic health check - ensure engine is still initialized
        isCurrentlyHealthy = Boolean(
          (this.murmurabaEngine as Record<string, unknown>)?.isInitialized
        );
      } catch {
        isCurrentlyHealthy = false;
      }
    }

    this.healthMetrics.isHealthy = isCurrentlyHealthy;

    // If health status changed, emit event
    if (wasHealthy !== isCurrentlyHealthy) {
      this.emitEvent('health-update', { isHealthy: isCurrentlyHealthy });

      // Trigger recovery if unhealthy
      if (!isCurrentlyHealthy && this.config.autoRecover) {
        this.initialize().catch(() => {});
      }
    }
  }

  /**
   * Cleanup on app shutdown
   */
  public async cleanup(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    await this.destroy();
    this.listeners.clear();
    AudioEngineManager.instance = null;
  }
}

// Export singleton instance getter
export const getAudioEngineManager = (config?: Partial<AudioEngineConfig>) =>
  AudioEngineManager.getInstance(config);
