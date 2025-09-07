import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        client: resolve(__dirname, 'src/client.ts'),
      },
      formats: ['es'],
      fileName: '[name]',
    },
    rollupOptions: {
      external: [/@klicker-uzh*/, /node_modules/],
    },
    sourcemap: true,
    target: 'esnext',
    minify: false,
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
