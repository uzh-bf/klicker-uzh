import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.tsx'],
  clean: false,
  format: 'esm',
  dts: true,
})
