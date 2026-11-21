import { readdirSync, readFileSync } from 'node:fs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

function hostEntries(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory()
      ? hostEntries(path)
      : path.endsWith('.ts')
        ? [path]
        : []
  })
}

export default defineConfig({
  input: ['src/index.ts', 'src/runtime/auth.ts', ...hostEntries('src/host')],
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  plugins: [
    {
      name: 'host-prompt-assets',
      generateBundle() {
        for (const name of readdirSync('src/host/prompts')) {
          if (!name.endsWith('.hbs')) continue
          this.emitFile({
            type: 'asset',
            fileName: `host/prompts/${name}`,
            source: readFileSync(`src/host/prompts/${name}`),
          })
        }
      },
    },
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      rootDir: 'src',
      exclude: ['test/**/*', 'src/**/*.test.ts'],
    }),
  ],
  external: [/@klicker-uzh*/, /node_modules/],
})
