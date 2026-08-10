import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'
import { createRequire } from 'node:module'

const withNonIncrementalTypescriptOptions = createRequire(import.meta.url)(
  '../../util/rollup-typescript-options.cjs'
)

const config = defineConfig([
  {
    input: ['src/index.ts', 'src/client.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
      entryFileNames: '[name].js',
    },
    plugins: [
      del({
        targets: ['dist'],
      }),
      nodeResolve(),
      typescript(
        withNonIncrementalTypescriptOptions({
          tsconfig: './tsconfig.json',
          rootDir: 'src',
          declaration: true,
          declarationDir: 'dist',
          outputToFilesystem: true,
        })
      ),
      // copy({
      //   targets: [
      //     {
      //       src: 'src/prisma/client',
      //       dest: 'dist',
      //       rename: 'client',
      //     },
      //   ],
      // }),
    ],
    external: [
      // Exclude node_modules and other external dependencies
      /^@klicker-uzh\//,
      /node_modules/,
      '@prisma/adapter-pg',
      '@prisma/client',
      'pg',
    ],
  },
])

export default config
