import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Only polyfill what murmuraba needs
      include: ['buffer', 'stream', 'util', 'events', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    // Custom plugin to handle onnxruntime-web
    {
      name: 'configure-onnxruntime',
      config() {
        return {
          resolve: {
            alias: {
              'onnxruntime-web': resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.all.min.js'),
            }
          }
        };
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@susurro/core': resolve(__dirname, './packages/susurro/src'),
    },
  },
  optimizeDeps: {
    // Include dependencies that need pre-bundling
    include: [
      '@huggingface/transformers',
      'onnxruntime-web',
      'murmuraba'
    ],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  build: {
    outDir: 'dist',
    target: ['es2020', 'chrome64', 'firefox67', 'safari12'],
    chunkSizeWarningLimit: 1400, // Allow larger chunks for vendor libraries (transformers.js v3: 1396KB and murmuraba: 788KB)
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      // Proper code-splitting configuration  
      output: {
        manualChunks: (id) => {
          // React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          
          // Transformers.js and related ML libraries (loaded dynamically)
          if (id.includes('@huggingface/transformers') || id.includes('onnxruntime-web')) {
            return 'vendor-transformers';
          }
          
          // Murmuraba audio processing (loaded dynamically)  
          if (id.includes('murmuraba')) {
            return 'vendor-murmuraba';
          }
          
          
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
          
          // Our application code - keep together for better caching
          return undefined;
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash].css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
      onwarn: (warning, warn) => {
        // Suppress eval warnings from onnxruntime-web - it's needed for WASM loading
        if (warning.code === 'EVAL' && warning.id?.includes('onnxruntime-web')) {
          return;
        }
        warn(warning);
      },
    },
  },
  server: {
    port: 3000,
    headers: {
      // Required for WASM and SharedArrayBuffer in onnxruntime-web
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
