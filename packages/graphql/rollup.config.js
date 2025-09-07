import { nodeResolve } from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import esbuild from 'rollup-plugin-esbuild'

const config = defineConfig([
  {
    // Main build configuration
    input:
      process.env.NODE_ENV === 'test'
        ? ['instrumented/index.ts', 'instrumented/ops.ts']
        : ['src/index.ts', 'src/ops.ts'],
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
      // typescript({
      //   tsconfig: './tsconfig.json',
      //   rootDir: process.env.NODE_ENV === 'test' ? 'instrumented' : 'src',
      // }),
      esbuild(),
      copy({
        targets: [{ src: 'src/public/*', dest: 'dist' }],
      }),
    ],
    external: [/^@klicker-uzh\//, /node_modules/], // Exclude node_modules and specific external dependencies
  },
])

export default config
