import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: false,
          disableCSSFileLoading: true,
          enableFileSystemHttpRequests: false
        }
      }
    },
    globals: true,
    setupFiles: ['./src/__tests__/vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/core/**/*.ts',
        'src/hooks/**/*.ts',
        'src/engines/**/*.ts',
        'src/managers/**/*.ts',
        'src/utils/**/*.ts',
        'src/components/**/*.tsx'
      ],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/index.ts',
        'dist/',
        'coverage/',
        '**/*.config.ts',
        'src/types/**',
        'src/**/types.ts',
        'src/**/interfaces.ts'
      ],
      thresholds: {
        // Global thresholds (realistic for current 17.54% coverage)
        lines: 25,
        functions: 40,
        branches: 25,
        statements: 25,
        // Per-file thresholds for critical components (gradual improvement)
        'src/core/**/*.ts': {
          lines: 50,
          functions: 50,
          branches: 45,
          statements: 50
        },
        'src/hooks/**/*.ts': {
          lines: 30,
          functions: 35,
          branches: 30,
          statements: 30
        },
        'src/utils/**/*.ts': {
          lines: 20,
          functions: 25,
          branches: 20,
          statements: 20
        }
      },
      reportOnFailure: true,
      skipFull: false,
    },
    // Test timeout for long-running tests
    testTimeout: 10000,
    // Retry failed tests
    retry: 0,
    // Better error output
    reporters: ['default', 'html'],
    // Pool options for better performance (2025 optimizations)
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    // Enable test shuffling for better isolation detection
    shuffle: true,
    // Optimize snapshot handling
    snapshotFormat: {
      escapeString: false,
      printBasicPrototype: false
    },
    // Better change detection in watch mode
    watchExclude: ['**/node_modules/**', '**/dist/**', '**/.git/**']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});