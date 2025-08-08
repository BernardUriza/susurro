import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to handle onnxruntime-web
    {
      name: 'configure-onnxruntime',
      config() {
        return {
          resolve: {
            alias: {
              'onnxruntime-web': resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort-web.min.js'),
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
      // Fix Node.js modules contamination from murmuraba
      'stream': 'stream-browserify',
      'events': 'events',
      'buffer': 'buffer',
      'util': 'util',
      'process': 'process/browser',
    },
  },
  define: {
    // Required for proper Node.js polyfills
    global: 'globalThis',
    'process.env': {},
    'process.version': '"v16.0.0"',
    'process.versions': '{}',
    'process.platform': '"browser"',
    'process.argv': '[]',
  },
  optimizeDeps: {
    // Force these to be excluded from pre-bundling to enable proper code-splitting
    exclude: ['murmuraba'],
    // Include dependencies that need pre-bundling
    include: [
      'stream-browserify', 
      'events', 
      'buffer', 
      'util', 
      'process',
      '@xenova/transformers',
      'onnxruntime-web'
    ],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  build: {
    outDir: 'dist',
    target: ['es2020', 'chrome64', 'firefox67', 'safari12'],
    chunkSizeWarningLimit: 850, // Allow larger chunks for vendor libraries (transformers.js and murmuraba)
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
          if (id.includes('@xenova/transformers') || id.includes('onnxruntime-web')) {
            return 'vendor-transformers';
          }
          
          // Murmuraba audio processing (loaded dynamically)  
          if (id.includes('murmuraba')) {
            return 'vendor-murmuraba';
          }
          
          // Node.js polyfills
          if (id.includes('stream-browserify') || id.includes('node_modules/events') || 
              id.includes('node_modules/buffer') || id.includes('node_modules/util')) {
            return 'vendor-polyfills';
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
