import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  clean: false,
  format: 'esm',
  dts: true,
  publicDir: 'src/public',
})
