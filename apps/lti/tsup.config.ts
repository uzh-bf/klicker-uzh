import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  clean: true,
  format: 'esm',
  target: 'node20',
  dts: true,
})
