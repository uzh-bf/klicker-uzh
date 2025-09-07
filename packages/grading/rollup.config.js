// import { nodeResolve } from '@rollup/plugin-node-resolve'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

const config = defineConfig([
  {
    // Main build configuration
    input: ['src/index.ts'],
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
      //   rootDir: 'src',
      // }),
      esbuild(),
    ],
    external: [/^@klicker-uzh\//, /node_modules/], // Exclude node_modules and specific external dependencies
  },
])

export default config
