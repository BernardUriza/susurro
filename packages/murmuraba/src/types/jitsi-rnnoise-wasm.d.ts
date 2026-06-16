declare module '@jitsi/rnnoise-wasm' {
  interface RNNoiseProcessor {
    process: (inputFrame: Float32Array) => Float32Array;
    getVadProbability: () => number;
    destroy: () => void;
  }

  interface RNNoiseModule {
    createRNNoiseProcessor: () => RNNoiseProcessor;
    destroy: () => void;
  }

  export function createRNNWasmModule(options?: any): Promise<RNNoiseModule>;
}