import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@susurro/core': resolve(__dirname, './packages/susurro/src')
    }
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
    include: ['onnxruntime-web']
  },
  assetsInclude: ['**/*.wasm', '**/*.onnx'],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    fs: {
      allow: ['..']
    }
  },
  worker: {
    format: 'es'
  }
})