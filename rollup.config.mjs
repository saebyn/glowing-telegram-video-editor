import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import tailwindcss from 'tailwindcss';
import tailwindConfig from './tailwind.config.mjs';

/**
 * @type {import('rollup').RollupOptions}
 */
const rollupConfig = {
  input: 'src/index.ts',

  jsx: true,
  external: ['react', 'react-dom'],
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    typescript({
      compilerOptions: {
        declaration: true,
        declarationMap: true,
        outDir: 'dist',
      },
    }),
    nodeResolve({
    }),
    commonjs(),
    json(),
    postcss({
      config: {
        path: './postcss.config.mjs',
      },
      plugins: [tailwindcss(tailwindConfig)],
    }),
  ],
};

export default rollupConfig;
