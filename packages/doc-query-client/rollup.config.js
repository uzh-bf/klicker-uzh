import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

const config = defineConfig([
  {
    input: ['src/index.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
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
    // jose and the MCP SDK stay runtime dependencies instead of being inlined.
    external: [
      /@klicker-uzh.*/,
      /^jose$/,
      /^@modelcontextprotocol\//,
      /node_modules/,
    ],
  },
])

export default config
