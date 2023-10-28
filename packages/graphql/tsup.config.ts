import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/ops.ts', 'src/util.ts'],
  clean: false,
  dts: true,
  format: 'esm',
  publicDir: 'src/public',
})
