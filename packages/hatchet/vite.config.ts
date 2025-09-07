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
      entry: resolve(
        __dirname,
        process.env.NODE_ENV === 'test'
          ? 'instrumented/index.ts'
          : 'src/index.ts'
      ),
      formats: ['es'],
      fileName: 'index',
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
      include: [process.env.NODE_ENV === 'test' ? 'instrumented' : 'src'],
      exclude: ['test'],
      rollupTypes: false,
      insertTypesEntry: true,
    }),
  ],
})
