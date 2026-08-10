import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import { createRequire } from 'node:module'

const withNonIncrementalTypescriptOptions = createRequire(import.meta.url)(
  '../../packages/util/rollup-typescript-options.cjs'
)

const config = defineConfig([
  {
    // Main build configuration
    input:
      process.env.NODE_ENV === 'test'
        ? ['instrumented/index.ts']
        : ['src/index.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
      // preserveModules: true,
      // preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
    },
    plugins: [
      nodeResolve(),
      typescript(
        withNonIncrementalTypescriptOptions({
          tsconfig: './tsconfig.json',
          rootDir: process.env.NODE_ENV === 'test' ? 'instrumented' : 'src',
        })
      ),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
])

export default config
