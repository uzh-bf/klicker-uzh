import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/pure.ts'],
  clean: true,
  format: 'esm',
  dts: true,
})
