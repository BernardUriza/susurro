import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'src/main.tsx',
    'src/index.css',
    'packages/susurro/src/index.ts',
    'test/**/*.test.ts',
    'examples/**/*.tsx'
  ],
  project: [
    'src/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    'test/**/*.{ts,tsx}',
    'examples/**/*.{ts,tsx}'
  ],
  ignore: [
    'dist/**',
    'node_modules/**',
    '**/*.d.ts',
    'docs/**'
  ],
  ignoreDependencies: [
    // Keep these as they're used in build/dev process
    '@vitejs/plugin-react',
    'vite',
    'vitest',
    'typescript'
  ],
  workspaces: {
    '.': {
      entry: 'src/main.tsx'
    },
    'packages/susurro': {
      entry: 'src/index.ts'
    }
  }
};

export default config;