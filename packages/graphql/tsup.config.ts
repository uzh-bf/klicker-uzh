import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/ops.ts', 'src/lib/util.ts'],
  clean: true,
  dts: true,
  format: 'esm',
  target: 'node20',
  publicDir: 'src/public',
})
