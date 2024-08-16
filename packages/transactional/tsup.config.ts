import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['index.ts'],
  publicDir: 'out',
  clean: true,
  format: 'esm',
  target: 'node20',
  dts: true,
})
