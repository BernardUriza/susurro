declare module '@jitsi/rnnoise-wasm' {
  interface RNNoiseModule {
    _rnnoise_init(): number;
    _rnnoise_create(): number;
    _rnnoise_destroy(state: number): void;
    _rnnoise_process_frame(state: number, inputPtr: number, outputPtr: number): number;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPF32: Float32Array;
  }

  interface RNNoiseModuleOptions {
    locateFile?: (filename: string) => string;
    instantiateWasm?: (imports: WebAssembly.Imports, successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void) => void;
  }

  function createRNNWasmModule(options?: RNNoiseModuleOptions): Promise<RNNoiseModule>;

  export default createRNNWasmModule;
  export { createRNNWasmModule };
}