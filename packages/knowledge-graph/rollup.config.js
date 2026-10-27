import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

// Rollup ships no JSON loader and this repository installs no JSON plugin, so
// the trusted build-time domain catalog is inlined here to keep the published
// bundle self-contained.
const json = () => ({
  name: 'json',
  transform(code, id) {
    if (!id.endsWith('.json')) return null
    return { code: `export default ${code}`, map: { mappings: '' } }
  },
})

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
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
        include: ['{,**/}*.(cts|mts|ts|tsx|json)'],
      }),
    ],
    external: [/@klicker-uzh*/, /node_modules/],
  },
])

export default config
