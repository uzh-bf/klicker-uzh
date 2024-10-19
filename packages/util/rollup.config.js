import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'

const config = defineConfig([
  {
    // Main build configuration
    input: ['src/index.ts', 'src/pure.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js',
    },
    plugins: [
      del({ targets: 'dist/*' }), // Clean the dist folder
      nodeResolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src',
      }),
    ],
    external: ['@klicker-uzh/prisma', /node_modules/], // Exclude node_modules and specific external dependencies
  },
])

export default config
