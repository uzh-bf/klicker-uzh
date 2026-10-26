import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import { adaptiveSource, isAdaptiveSource } from './adaptive-source-rollup.mjs'

const config = defineConfig([
  {
    // Main build configuration
    input:
      process.env.NODE_ENV === 'test'
        ? [
            'instrumented/index.ts',
            'instrumented/ops.ts',
            'instrumented/participant-data-use.ts',
          ]
        : ['src/index.ts', 'src/ops.ts', 'src/participant-data-use.ts'],
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
      adaptiveSource(),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'Bundler',
          incremental: false,
          tsBuildInfoFile: undefined,
        },
        rootDir: process.env.NODE_ENV === 'test' ? 'instrumented' : 'src',
      }),
      copy({
        targets: [{ src: 'src/public/*', dest: 'dist' }],
      }),
    ],
    external: (id) =>
      !isAdaptiveSource(id) &&
      (/^@klicker-uzh\//.test(id) || /node_modules/.test(id)), // Exclude node_modules and workspace packages
  },
])

export default config
