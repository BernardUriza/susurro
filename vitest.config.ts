import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './test/setup.ts',
  },
  resolve: {
    alias: {
      '/rnnoise.wasm': path.resolve(__dirname, 'node_modules/murmuraba/dist/rnnoise.wasm'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
