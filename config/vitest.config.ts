import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './packages/susurro/tests/setup.ts',
    // E2E test specific configuration
    testTimeout: 60000, // 60 seconds for Whisper model loading
    hookTimeout: 60000, // Allow long setup/teardown for browser launch
    include: [
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
  },
  resolve: {
    alias: {
      '/rnnoise.wasm': path.resolve(__dirname, '../node_modules/murmuraba/dist/rnnoise.wasm'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
