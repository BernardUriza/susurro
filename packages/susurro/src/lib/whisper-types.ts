export interface WhisperProgress {
  status: 'download' | 'progress' | 'done' | 'loading' | 'ready';
  progress?: number;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
}

export interface WhisperTransformersConfig {
  language?: string;
  task?: 'transcribe' | 'translate';
  return_timestamps?: boolean;
  chunk_length_s?: number;
  stride_length_s?: number;
}

export interface WhisperOutput {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

export interface Pipeline<T extends string = 'automatic-speech-recognition'> {
  (input: string | ArrayBuffer, options?: WhisperTransformersConfig): Promise<WhisperOutput>;
}

export interface TransformersEnvironment {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  remoteURL: string;
  backends: {
    onnx: {
      wasm: {
        wasmPaths: string;
      };
    };
  };
}

export interface TransformersModule {
  pipeline: <T extends string>(
    task: T,
    model?: string,
    options?: {
      progress_callback?: (progress: WhisperProgress) => void;
      quantized?: boolean;
    }
  ) => Promise<Pipeline<T>>;
  env: TransformersEnvironment;
}
