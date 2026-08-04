import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

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
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
      }),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
  {
    // CLI binaries: compile the export scripts so production runs need no tsx/esbuild
    input: ['src/scripts/export-course.ts', 'src/scripts/export-chatbots.ts'],
    output: {
      dir: 'dist/scripts',
      format: 'esm',
      sourcemap: true,
      entryFileNames: '[name].js',
      banner: '#!/usr/bin/env node',
    },
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
        outDir: 'dist/scripts',
        declaration: false,
        declarationMap: false,
        tsBuildInfoFile: 'dist/scripts/tsconfig.tsbuildinfo',
      }),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
])

export default config
