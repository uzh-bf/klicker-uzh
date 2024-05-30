import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  clean: false,
  format: 'esm',
  target: 'node20',
  dts: true,
  publicDir: 'src/public',
})
