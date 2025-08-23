import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import del from 'rollup-plugin-delete'

const config = defineConfig([
  {
    // Main build configuration
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
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
      }),
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
      /^\.\/prisma\/client\//,
      './client.js',
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
