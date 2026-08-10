import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import { createRequire } from 'node:module'

const withNonIncrementalTypescriptOptions = createRequire(import.meta.url)(
  '../../packages/util/rollup-typescript-options.cjs'
)

const config = defineConfig([
  {
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
])

export default config
