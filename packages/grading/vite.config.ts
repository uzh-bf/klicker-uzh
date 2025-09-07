import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: [/@klicker-uzh*/, /node_modules/],
    },
    sourcemap: true,
    target: 'esnext',
    minify: false, // Keep unminified for library
  },
  plugins: [
    dts({
      include: ['src'],
      exclude: ['test'],
      rollupTypes: false,
      insertTypesEntry: true,
    }),
  ],
})
