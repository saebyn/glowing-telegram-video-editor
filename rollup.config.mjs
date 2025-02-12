import autoprefixer from 'autoprefixer';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import postcssImport from 'postcss-import';
import postcssUrl from 'postcss-url';
import tailwind from 'tailwindcss';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import svg from 'rollup-plugin-svg';

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
    svg({
      base64: true,
    }),
    postcss({
      plugins: [
        postcssImport(),
        postcssUrl({
          url: "inline",
        }),
        tailwind(tailwindConfig),
        autoprefixer(),
      ],
    }),
  ],
};

export default rollupConfig;
