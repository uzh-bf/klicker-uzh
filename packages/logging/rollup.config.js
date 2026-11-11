import { builtinModules } from 'node:module'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
])

export default defineConfig({
  input: ['src/edge.ts', 'src/node.ts', 'src/request.ts'],
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
      // Keep Rollup independent from stale TypeScript incremental metadata.
      compilerOptions: {
        incremental: false,
        tsBuildInfoFile: undefined,
      },
    }),
  ],
  external: (id) =>
    id === 'pino' ||
    id === 'pino-pretty' ||
    id.startsWith('@klicker-uzh/') ||
    nodeBuiltins.has(id),
})
