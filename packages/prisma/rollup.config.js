import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import del from 'rollup-plugin-delete'

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
      del({
        targets: ['dist'],
      }),
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
        declaration: true,
        declarationDir: 'dist',
        outputToFilesystem: true,
      }),
      nodeResolve(),
      copy({
        targets: [
          {
            src: 'src/prisma/client',
            dest: 'dist',
            rename: 'client',
          },
        ],
      }),
    ],
    external: [
      // Mark Prisma client imports as external (don't bundle them)
      /^\.\/client/,
      // Exclude node_modules and other external dependencies
      /@klicker-uzh*/,
      /node_modules/,
      '@prisma/adapter-pg',
      '@prisma/client',
      'pg',
    ],
  },
])

export default config
