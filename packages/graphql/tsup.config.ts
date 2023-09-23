import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/ops.ts', 'src/util.ts'],
  clean: false,
  dts: false,
  publicDir: 'src/public',
  format: 'esm',
  target: 'node18',
})
