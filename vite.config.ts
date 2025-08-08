import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@susurro/core': resolve(__dirname, './packages/susurro/src'),
    },
  },
  optimizeDeps: {
    // Include dependencies but don't force optimization
    include: ['@xenova/transformers', 'onnxruntime-web'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 3000,
    // No COEP/COOP for now. Add only if you enable WASM multithreading.
  },
});
