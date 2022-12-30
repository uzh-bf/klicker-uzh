import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/ops.ts', 'src/util.ts', 'src/pothos.ts'],
  clean: true,
  dts: true,
})
