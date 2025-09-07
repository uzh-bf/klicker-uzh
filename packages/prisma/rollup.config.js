import { nodeResolve } from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'
import esbuild from 'rollup-plugin-esbuild'

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
      esbuild(),
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
