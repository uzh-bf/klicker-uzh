import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/util.ts'],
  clean: true,
  format: 'esm',
  dts: true,
})
