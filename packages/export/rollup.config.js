import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import { createRequire } from 'node:module'

const withNonIncrementalTypescriptOptions = createRequire(import.meta.url)(
  '@klicker-uzh/build-config'
)

const config = defineConfig([
  {
    // Main build configuration (library entry)
    input: ['src/index.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
      entryFileNames: '[name].js',
    },
    plugins: [
      nodeResolve(),
      typescript(
        withNonIncrementalTypescriptOptions({
          tsconfig: './tsconfig.json',
          rootDir: 'src',
        })
      ),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
  {
    // CLI binary: compile the export script so production runs need no tsx/esbuild
    input: ['src/scripts/export-course.ts'],
    output: {
      dir: 'dist/scripts',
      format: 'esm',
      sourcemap: true,
      entryFileNames: '[name].js',
      banner: '#!/usr/bin/env node',
    },
    plugins: [
      nodeResolve(),
      typescript(
        withNonIncrementalTypescriptOptions({
          tsconfig: './tsconfig.json',
          rootDir: 'src',
          outDir: 'dist/scripts',
          declaration: false,
          declarationMap: false,
        })
      ),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
])

export default config
