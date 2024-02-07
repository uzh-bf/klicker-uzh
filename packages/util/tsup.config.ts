import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/pure.ts'],
  clean: true,
  format: 'esm',
  target: 'node18',
  dts: true,
})
