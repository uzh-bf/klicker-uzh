import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

const config = defineConfig([
  {
    // Main build configuration
    // participantAccountDataUse is a runtime-dependency-free module that
    // browser bundles import directly; keep it as its own entry chunk so the
    // server barrel (with ioredis and other Node-only code) stays out.
    input: ['src/index.ts', 'src/participantAccountDataUse.ts'],
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
        rootDir: 'src',
        filterRoot: '.',
        // Keep Rollup independent from stale TypeScript incremental metadata.
        compilerOptions: {
          incremental: false,
          tsBuildInfoFile: undefined,
        },
        include: [
          'src/**/*.cts',
          'src/**/*.mts',
          'src/**/*.ts',
          'src/**/*.tsx',
        ],
      }),
    ],
    external: [/@klicker-uzh*/, /node_modules/], // Exclude node_modules and specific external dependencies
  },
])

export default config
