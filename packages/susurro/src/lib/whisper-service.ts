import type {
  Pipeline,
  WhisperProgress,
} from './whisper-types';

interface WhisperServiceConfig {
  model: string;
  task: string;
  onProgress?: (progress: WhisperProgress) => void;
}

export class WhisperService {
  private pipeline: any = null;
  private env: any = null;
  private instance: Pipeline | null = null;
  private isLoading = false;
  private config: WhisperServiceConfig;

  constructor(config: WhisperServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<Pipeline> {
    if (this.instance) {
      return this.instance;
    }

    if (this.isLoading) {
      throw new Error('Service is already initializing');
    }

    this.isLoading = true;

    try {
      // Dynamic import with proper error handling
      const transformers = await import('@xenova/transformers');
      this.pipeline = transformers.pipeline;
      this.env = transformers.env;

      if (this.env) {
        await this.configureEnvironment();
      }

      this.instance = await this.pipeline(this.config.task, this.config.model, {
        progress_callback: this.config.onProgress,
        quantized: true,
        local_files_only: true,
        timeout: 120000,
        retries: 3,
      } as any);

      return this.instance;
    } finally {
      this.isLoading = false;
    }
  }

  private async configureEnvironment(): Promise<void> {
    if (!this.env) return;

    this.env.allowLocalModels = true;
    this.env.allowRemoteModels = false;
    this.env.remoteURL = '/models/';

    if (this.env.backends) {
      this.env.backends.onnx = {
        wasm: {
          wasmPaths: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/',
        },
      };
    }
  }

  getInstance(): Pipeline | null {
    return this.instance;
  }

  reset(): void {
    this.instance = null;
    this.pipeline = null;
    this.env = null;
    this.isLoading = false;
  }
}