import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

// Suppress circular dependency warnings for known external libraries
const onwarn = (warning, warn) => {
  if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.message.includes('lamejs')) {
    return; // Suppress lamejs circular dependency warnings
  }
  warn(warning);
};

// CRÍTICO: Externalizar React para evitar conflictos con React 19
const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime'
];

// Configuración para manejar React como peer dependency
const globals = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react/jsx-runtime': 'React',
  'react/jsx-dev-runtime': 'React'
};

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true,
      exports: 'named',
    },
    external,
    onwarn,
    plugins: [
      postcss({
        modules: false,
        extract: false,
        minimize: true,
        inject: true
      }),
      resolve({
        preferBuiltins: false,
        // Evitar bundlear React internals
        dedupe: ['react', 'react-dom']
      }),
      commonjs({
        // Excluir React del bundling
        exclude: ['node_modules/react/**', 'node_modules/react-dom/**']
      }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      copy({
        targets: [
          { 
            src: 'node_modules/@jitsi/rnnoise-wasm/dist/rnnoise.wasm', 
            dest: 'dist' 
          }
        ],
        hook: 'writeBundle'
      })
    ],
  },
  // CJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
      exports: 'named',
    },
    external,
    onwarn,
    plugins: [
      postcss({
        modules: false,
        extract: false,
        minimize: true,
        inject: true
      }),
      resolve({
        preferBuiltins: false,
        // Evitar bundlear React internals
        dedupe: ['react', 'react-dom']
      }),
      commonjs({
        // Excluir React del bundling
        exclude: ['node_modules/react/**', 'node_modules/react-dom/**']
      }),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },
  // UMD build (minified) - temporarily disabled due to timeout issues
  // {
  //   input: 'src/index.ts',
  //   output: {
  //     file: 'dist/index.umd.min.js',
  //     format: 'umd',
  //     name: 'Murmuraba',
  //     sourcemap: true,
  //     inlineDynamicImports: true,
  //     exports: 'named',
  //     globals,
  //   },
  //   external,
  //   onwarn,
  //   plugins: [
  //     postcss({
  //       modules: false,
  //       extract: false,
  //       minimize: true,
  //       inject: true
  //     }),
  //     resolve(),
  //     commonjs(),
  //     typescript({
  //       tsconfig: './tsconfig.json',
  //     }),
  //     terser(),
  //   ],
  // },
];