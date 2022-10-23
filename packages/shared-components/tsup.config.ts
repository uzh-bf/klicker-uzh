import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.tsx'],
  clean: true,
  format: 'esm',
  dts: true,
})
