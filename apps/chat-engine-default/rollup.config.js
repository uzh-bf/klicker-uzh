import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

export default defineConfig({
  input: ['src/index.ts'],
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      rootDir: 'src',
    }),
  ],
  external: [/@klicker-uzh*/, /node_modules/],
})
