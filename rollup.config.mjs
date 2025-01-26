import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import nodeResolve from '@rollup/plugin-node-resolve';
import tailwindcss from 'tailwindcss';
import tailwindConfig from './tailwind.config.mjs';

/**
 * @type {import('rollup').RollupOptions}
 */
const rollupConfig = {
  input: 'src/index.ts',

  jsx: true,

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
      resolveOnly: ['tailwindcss', 'hls.js'],
    }),
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
