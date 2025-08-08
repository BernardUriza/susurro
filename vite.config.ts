import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@susurro/core': resolve(__dirname, './packages/susurro/src'),
      // Fix Node.js modules contamination from murmuraba
      'stream': 'stream-browserify',
      'events': 'events',
      'buffer': 'buffer',
      'util': 'util',
    },
  },
  define: {
    // Required for proper Node.js polyfills
    global: 'globalThis',
  },
  optimizeDeps: {
    // Force these to be excluded from pre-bundling to enable proper code-splitting
    exclude: ['@xenova/transformers', 'murmuraba'],
    // Include polyfills that murmuraba needs
    include: ['stream-browserify', 'events', 'buffer', 'util'],
  },
  build: {
    outDir: 'dist',
    target: ['es2020', 'chrome64', 'firefox67', 'safari12'],
    chunkSizeWarningLimit: 600, // Allow slightly larger chunks for vendor libraries
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
