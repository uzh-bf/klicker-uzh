import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

function isBundledFeatureFlagDependency(id) {
  return (
    id === '@klicker-uzh/feature-flags/node' ||
    id === '@growthbook/growthbook' ||
    id.includes('/@growthbook/growthbook/')
  )
}

function isExternalDependency(id) {
  if (isBundledFeatureFlagDependency(id)) return false

  return id.startsWith('@klicker-uzh/') || id.includes('/node_modules/')
}

const config = defineConfig([
  {
    // Main build configuration
    input:
      process.env.NODE_ENV === 'test'
        ? ['instrumented/index.ts']
        : ['src/index.ts'],
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
        rootDir: '.',
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
          'instrumented/**/*.cts',
          'instrumented/**/*.mts',
          'instrumented/**/*.ts',
          'instrumented/**/*.tsx',
        ],
      }),
    ],
    external: isExternalDependency,
  },
])

export default config
