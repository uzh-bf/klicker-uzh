import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/ops.ts'],
  clean: true,
})
