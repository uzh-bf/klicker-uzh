import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  build: {
    ssr: true,
    lib: {
      entry: {
        index: resolve(
          __dirname,
          process.env.NODE_ENV === 'test'
            ? 'instrumented/index.ts'
            : 'src/index.ts'
        ),
        ops: resolve(
          __dirname,
          process.env.NODE_ENV === 'test' ? 'instrumented/ops.ts' : 'src/ops.ts'
        ),
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
      include: [process.env.NODE_ENV === 'test' ? 'instrumented' : 'src'],
      exclude: ['test'],
      rollupTypes: false,
      insertTypesEntry: true,
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/public/*',
          dest: '.',
        },
      ],
    }),
  ],
})
