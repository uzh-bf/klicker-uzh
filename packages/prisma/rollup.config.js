import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'

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
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
        declaration: true,
        declarationDir: 'dist',
        outputToFilesystem: true,
        compilerOptions: {
          incremental: false,
          tsBuildInfoFile: undefined,
        },
      }),
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
