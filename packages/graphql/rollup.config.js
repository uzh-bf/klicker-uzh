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
      typescript({
        tsconfig: './tsconfig.json',
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
    // Workspace packages stay external, except the dependency-free product
    // updates catalog, which is bundled so the transferred graphql dist runs
    // in CI jobs that only ship the allowlisted package outputs.
    external: (id) =>
      !id.startsWith('@klicker-uzh/product-updates') &&
      (/^@klicker-uzh\//.test(id) || /node_modules/.test(id)),
  },
])

export default config
