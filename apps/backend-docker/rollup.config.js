import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import { createRequire } from 'node:module'

const withNonIncrementalTypescriptOptions = createRequire(import.meta.url)(
  '@klicker-uzh/build-config'
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
          rootDir: '.',
          filterRoot: '.',
          include: [
            'src/**/*.cts',
            'src/**/*.mts',
            'src/**/*.ts',
            'src/**/*.tsx',
            'instrumented/**/*.cts',
            'instrumented/**/*.mts',
            'instrumented/**/*.ts',
            'instrumented/**/*.tsx',
          ],
        })
      ),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
])

export default config
