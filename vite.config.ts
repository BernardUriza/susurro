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
    // Include transformers for proper pre-bundling as per HF recommendations
    include: ['@xenova/transformers', 'onnxruntime-web'],
  },
  assetsInclude: ['**/*.wasm', '**/*.onnx'],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless', // More permissive for model loading
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['..'],
    },
    // Model files are served from public/models directory
  },
  // Worker configuration removed - using direct execution instead
});