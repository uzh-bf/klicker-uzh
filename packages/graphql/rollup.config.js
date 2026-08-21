import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'

const config = defineConfig([
  {
    // Main build configuration
    input:
      process.env.NODE_ENV === 'test'
        ? ['instrumented/index.ts', 'instrumented/ops.ts']
        : ['src/index.ts', 'src/ops.ts', 'src/server.ts'],
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
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'Bundler',
        },
        rootDir: process.env.NODE_ENV === 'test' ? 'instrumented' : 'src',
        compilerOptions: {
          incremental: false,
          tsBuildInfoFile: undefined,
        },
      }),
      copy({
        targets: [{ src: 'src/public/*', dest: 'dist' }],
      }),
    ],
    external: [/^@klicker-uzh\//, /node_modules/], // Exclude node_modules and workspace packages
  },
])

export default config
